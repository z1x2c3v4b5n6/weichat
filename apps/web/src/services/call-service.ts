'use client';

import type { Socket } from 'socket.io-client';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected';

export interface CallState {
  status: CallStatus;
  partnerName: string | null;
  isCaller: boolean;
  isMuted: boolean;
  error?: string;
}

export interface CallContext {
  conversationId: string;
  peerUserId: string;
  isCaller: boolean;
}

export interface CallSnapshot {
  state: CallState;
  context: CallContext | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

interface CallServiceOptions {
  socket: Socket;
  currentUserId: string;
  resolvePeer: (conversationId: string, peerUserId: string) => { partnerName: string } | undefined;
}

interface OfferPayload {
  conversationId: string;
  fromUserId: string;
  sdp: string;
}

interface AnswerPayload {
  conversationId: string;
  fromUserId: string;
  sdp: string;
}

interface CandidatePayload {
  conversationId: string;
  fromUserId: string;
  candidate: RTCIceCandidateInit;
}

interface HangupPayload {
  conversationId: string;
  fromUserId: string;
}

type Listener = (snapshot: CallSnapshot) => void;

export class CallService {
  private readonly socket: Socket;

  private readonly resolvePeer: CallServiceOptions['resolvePeer'];

  private readonly currentUserId: string;

  private peer: RTCPeerConnection | null = null;

  private context: CallContext | null = null;

  private state: CallState = {
    status: 'idle',
    partnerName: null,
    isCaller: false,
    isMuted: false
  };

  private localStream: MediaStream | null = null;

  private remoteStream: MediaStream | null = null;

  private timeoutHandle: number | null = null;

  private retryAttempts = 0;

  private readonly maxRetries = 2;

  private readonly listeners = new Set<Listener>();

  private pendingOffer: OfferPayload | null = null;

  public constructor(options: CallServiceOptions) {
    this.socket = options.socket;
    this.currentUserId = options.currentUserId;
    this.resolvePeer = options.resolvePeer;
    this.registerSocketEvents();
    this.emitSnapshot();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async startCall(conversationId: string, peerUserId: string): Promise<void> {
    const resolved = this.resolvePeer(conversationId, peerUserId);
    if (!resolved) {
      this.updateState({ error: 'Unable to locate participant information.' });
      return;
    }

    try {
      await this.ensurePeer();
      await this.prepareLocalStream();
      this.context = { conversationId, peerUserId, isCaller: true };
      this.retryAttempts = 0;
      this.updateState({
        status: 'calling',
        partnerName: resolved.partnerName,
        isCaller: true,
        isMuted: false,
        error: undefined
      });
      const offer = await this.peer!.createOffer();
      await this.peer!.setLocalDescription(offer);
      this.socket.emit('call:offer', {
        conversationId,
        toUserId: peerUserId,
        sdp: offer.sdp
      });
      this.startTimeout();
    } catch (error) {
      this.handleFailure('Unable to start the call. Check microphone permissions.', error instanceof Error ? error : undefined);
    }
  }

  public async acceptCall(): Promise<void> {
    if (!this.pendingOffer) {
      return;
    }

    const { conversationId, fromUserId, sdp } = this.pendingOffer;
    try {
      await this.ensurePeer();
      await this.prepareLocalStream();
      this.context = { conversationId, peerUserId: fromUserId, isCaller: false };
      this.retryAttempts = 0;
      await this.peer!.setRemoteDescription({ type: 'offer', sdp });
      const answer = await this.peer!.createAnswer();
      await this.peer!.setLocalDescription(answer);
      this.socket.emit('call:answer', {
        conversationId,
        toUserId: fromUserId,
        sdp: answer.sdp
      });
      this.pendingOffer = null;
      this.updateState({
        status: 'connecting',
        isCaller: false,
        isMuted: false,
        error: undefined
      });
      this.startTimeout();
    } catch (error) {
      this.handleFailure('Failed to answer the call.', error instanceof Error ? error : undefined);
    }
  }

  public hangup(notifyPeer: boolean = true): void {
    if (notifyPeer && this.context) {
      this.socket.emit('call:hangup', {
        conversationId: this.context.conversationId,
        toUserId: this.context.peerUserId
      });
    }
    this.endCall('Call ended.', true);
  }

  public toggleMute(): void {
    if (!this.localStream) {
      return;
    }
    const nextMuted = !this.state.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    this.updateState({ isMuted: nextMuted });
  }

  public dispose(): void {
    this.cleanupPeer();
    this.clearTimeout();
    this.listeners.clear();
    this.unregisterSocketEvents();
  }

  private getSnapshot(): CallSnapshot {
    return {
      state: this.state,
      context: this.context,
      localStream: this.localStream,
      remoteStream: this.remoteStream
    };
  }

  private emitSnapshot(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private updateState(partial: Partial<CallState>): void {
    this.state = { ...this.state, ...partial };
    this.emitSnapshot();
  }

  private registerSocketEvents(): void {
    this.socket.on('call:offer', this.handleOffer);
    this.socket.on('call:answer', this.handleAnswer);
    this.socket.on('call:candidate', this.handleCandidate);
    this.socket.on('call:hangup', this.handleRemoteHangup);
  }

  private unregisterSocketEvents(): void {
    this.socket.off('call:offer', this.handleOffer);
    this.socket.off('call:answer', this.handleAnswer);
    this.socket.off('call:candidate', this.handleCandidate);
    this.socket.off('call:hangup', this.handleRemoteHangup);
  }

  private handleOffer = (payload: OfferPayload): void => {
    if (payload.fromUserId === this.currentUserId) {
      return;
    }
    const resolved = this.resolvePeer(payload.conversationId, payload.fromUserId);
    if (!resolved) {
      return;
    }
    this.pendingOffer = payload;
    this.context = { conversationId: payload.conversationId, peerUserId: payload.fromUserId, isCaller: false };
    this.updateState({
      status: 'incoming',
      partnerName: resolved.partnerName,
      isCaller: false,
      isMuted: false,
      error: undefined
    });
    this.startTimeout();
  };

  private handleAnswer = async (payload: AnswerPayload): Promise<void> => {
    if (!this.context || !this.peer || !this.context.isCaller) {
      return;
    }
    if (payload.conversationId !== this.context.conversationId || payload.fromUserId !== this.context.peerUserId) {
      return;
    }
    try {
      await this.peer.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
      this.updateState({ status: 'connecting' });
    } catch (error) {
      this.handleFailure('Failed to establish the call.', error instanceof Error ? error : undefined);
    }
  };

  private handleCandidate = async (payload: CandidatePayload): Promise<void> => {
    if (!this.peer || !this.context) {
      return;
    }
    if (payload.conversationId !== this.context.conversationId || payload.fromUserId !== this.context.peerUserId) {
      return;
    }
    try {
      await this.peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (error) {
      this.handleFailure('Unable to process network candidate.', error instanceof Error ? error : undefined);
    }
  };

  private handleRemoteHangup = (payload: HangupPayload): void => {
    if (!this.context) {
      return;
    }
    if (payload.conversationId !== this.context.conversationId || payload.fromUserId !== this.context.peerUserId) {
      return;
    }
    this.endCall('The caller has ended the call.', false);
  };

  private async ensurePeer(): Promise<void> {
    if (this.peer) {
      return;
    }
    const configuration: RTCConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    this.peer = new RTCPeerConnection(configuration);
    this.peer.onicecandidate = (event) => {
      if (!event.candidate || !this.context) {
        return;
      }
      this.socket.emit('call:candidate', {
        conversationId: this.context.conversationId,
        toUserId: this.context.peerUserId,
        candidate: event.candidate.toJSON()
      });
    };
    this.peer.ontrack = (event) => {
      const [stream] = event.streams;
      this.remoteStream = stream;
      this.emitSnapshot();
    };
    this.peer.onconnectionstatechange = () => {
      if (!this.peer) {
        return;
      }
      if (this.peer.connectionState === 'connected') {
        this.clearTimeout();
        this.updateState({ status: 'connected' });
      } else if (this.peer.connectionState === 'failed') {
        void this.retryConnection();
      }
    };
  }

  private async retryConnection(): Promise<void> {
    if (!this.peer || !this.context || !this.context.isCaller) {
      this.handleFailure('Call connection failed.');
      return;
    }
    if (this.retryAttempts >= this.maxRetries) {
      this.handleFailure('Unable to recover the call after multiple attempts.');
      return;
    }
    this.retryAttempts += 1;
    try {
      const offer = await this.peer.createOffer({ iceRestart: true });
      await this.peer.setLocalDescription(offer);
      this.socket.emit('call:offer', {
        conversationId: this.context.conversationId,
        toUserId: this.context.peerUserId,
        sdp: offer.sdp
      });
      this.startTimeout();
    } catch (error) {
      this.handleFailure('Failed to retry the call.', error instanceof Error ? error : undefined);
    }
  }

  private async prepareLocalStream(): Promise<void> {
    if (this.localStream) {
      return;
    }
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    await this.attachLocalTracks();
    this.emitSnapshot();
  }

  private async attachLocalTracks(): Promise<void> {
    if (!this.peer || !this.localStream) {
      return;
    }
    const existingSenders = this.peer.getSenders();
    const trackIds = new Set(existingSenders.map((sender) => sender.track?.id));
    for (const track of this.localStream.getTracks()) {
      if (trackIds.has(track.id)) {
        continue;
      }
      this.peer.addTrack(track, this.localStream);
    }
  }

  private startTimeout(): void {
    this.clearTimeout();
    this.timeoutHandle = window.setTimeout(() => {
      this.handleFailure('Call timed out.');
    }, 30000);
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) {
      window.clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  private handleFailure(message: string, error?: Error): void {
    // eslint-disable-next-line no-console
    console.error(message, error);
    if (this.context) {
      this.socket.emit('call:hangup', {
        conversationId: this.context.conversationId,
        toUserId: this.context.peerUserId
      });
    }
    this.endCall(message);
  }

  private endCall(message: string, resetError: boolean = false): void {
    this.pendingOffer = null;
    this.clearTimeout();
    this.cleanupPeer();
    this.context = null;
    if (resetError) {
      this.updateState({ status: 'idle', partnerName: null, isCaller: false, isMuted: false, error: undefined });
    } else {
      this.updateState({ status: 'idle', partnerName: null, isCaller: false, isMuted: false, error: message });
    }
  }

  private cleanupPeer(): void {
    if (this.peer) {
      this.peer.onicecandidate = null;
      this.peer.ontrack = null;
      this.peer.onconnectionstatechange = null;
      this.peer.close();
      this.peer = null;
    }
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.emitSnapshot();
  }
}
