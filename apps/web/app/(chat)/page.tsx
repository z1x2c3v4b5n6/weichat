'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Message, MessageType, PresencePayload, ReadAckPayload, TypingPayload } from '@chat-app/types';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { ConversationResponse, ConversationSummary, PresenceState } from '@/types/chat';
import { ConversationList } from '@/components/ConversationList';
import { MessageList } from '@/components/MessageList';
import { ChatInput } from '@/components/ChatInput';
import { useChatSocket } from '@/hooks/useChatSocket';
import { CallModal } from '@/components/CallModal';

interface CallContext {
  conversationId: string;
  peerUserId: string;
  partnerName: string;
  isCaller: boolean;
}

interface PaginatedMessagesResponse {
  items: Message[];
  nextCursor?: string;
}

interface PresignResponse {
  objectKey: string;
  putUrl: string;
  getUrl: string;
  headers: Record<string, string>;
}

export default function ChatPage(): JSX.Element {
  const router = useRouter();
  const { user, isHydrated, bootstrap, logout } = useAuthStore((state) => ({
    user: state.user,
    isHydrated: state.isHydrated,
    bootstrap: state.bootstrap,
    logout: state.logout
  }));

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<PresenceState>({});
  const [typingState, setTypingState] = useState<Record<string, boolean>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [callUi, setCallUi] = useState<{ visible: boolean; isCaller: boolean; partnerName: string }>({
    visible: false,
    isCaller: true,
    partnerName: ''
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const callContextRef = useRef<CallContext | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (!user) {
      router.replace('/login');
    }
  }, [user, isHydrated, router]);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      return;
    }
    const response = await api.get<ConversationResponse[]>('/conversations');
    const mapped: ConversationSummary[] = response.data.map((conversation) => ({
      id: conversation.id,
      isGroup: conversation.isGroup,
      createdAt: conversation.createdAt,
      members: conversation.members,
      lastMessage: conversation.messages[0]
    }));
    setConversations(mapped);
    setUnreadCounts((prev) => {
      const next: Record<string, number> = { ...prev };
      mapped.forEach((conversation) => {
        if (typeof next[conversation.id] !== 'number') {
          next[conversation.id] = 0;
        }
      });
      return next;
    });
    if (mapped.length > 0 && !selectedConversationId) {
      setSelectedConversationId(mapped[0].id);
    }
  }, [user, selectedConversationId]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void fetchConversations();
  }, [user, fetchConversations]);

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      try {
        const response = await api.get<PaginatedMessagesResponse>('/messages', {
          params: { conversationId }
        });
        setMessages(response.data.items);
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedConversationId) {
      void fetchMessages(selectedConversationId);
      setTypingState({});
    }
  }, [selectedConversationId, fetchMessages]);

  const handleMessageCreated = useCallback(
    (message: Message) => {
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === message.conversationId
            ? { ...conversation, lastMessage: message }
            : conversation
        )
      );
      const isSelected = message.conversationId === selectedConversationId;
      const isSelf = message.senderId === user?.id;
      const isVisible = typeof document === 'undefined' ? true : document.visibilityState === 'visible';

      if (isSelected) {
        setMessages((prev) => [...prev, message]);
      }

      if (!isSelf && (!isSelected || !isVisible)) {
        setUnreadCounts((prev) => ({
          ...prev,
          [message.conversationId]: (prev[message.conversationId] ?? 0) + 1
        }));
      }
    },
    [selectedConversationId, user?.id]
  );

  const handlePresence = useCallback((payload: PresencePayload) => {
    setPresence((prev) => ({ ...prev, [payload.userId]: payload.online }));
  }, []);

  const handleTyping = useCallback(
    (payload: TypingPayload) => {
      if (payload.conversationId !== selectedConversationId) {
        return;
      }
      setTypingState((prev) => ({ ...prev, [payload.userId]: payload.isTyping }));
    },
    [selectedConversationId]
  );

  const handleReadAck = useCallback(
    (payload: ReadAckPayload) => {
      setTypingState((prev) => ({ ...prev, [payload.userId]: false }));
      if (payload.userId === user?.id) {
        setUnreadCounts((prev) => ({ ...prev, [payload.conversationId]: payload.unreadCount ?? 0 }));
      }
    },
    [user?.id]
  );

  const { socket } = useChatSocket({
    onMessage: handleMessageCreated,
    onPresence: handlePresence,
    onTyping: handleTyping,
    onReadAck: handleReadAck
  });

  useEffect(() => {
    if (!socket) {
      return;
    }
    const interval = window.setInterval(() => {
      socket.emit('presence');
    }, 20000);
    socket.emit('presence');
    return () => {
      window.clearInterval(interval);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !selectedConversationId) {
      return;
    }
    socket.emit('joinConversation', selectedConversationId);
    return () => {
      socket.emit('leaveConversation', selectedConversationId);
    };
  }, [socket, selectedConversationId]);

  const ensurePeer = useCallback(async (): Promise<RTCPeerConnection> => {
    if (peerRef.current) {
      return peerRef.current;
    }
    const config: RTCConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    const peer = new RTCPeerConnection(config);
    peer.onicecandidate = (event) => {
      if (event.candidate && callContextRef.current && socket) {
        socket.emit('call:candidate', {
          conversationId: callContextRef.current.conversationId,
          toUserId: callContextRef.current.peerUserId,
          candidate: event.candidate.toJSON()
        });
      }
    };
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    };
    peerRef.current = peer;
    return peer;
  }, [socket]);

  const startLocalStream = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const cleanupCall = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    callContextRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallUi((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleCallOffer = useCallback(
    async (payload: { conversationId: string; fromUserId: string; sdp: string }) => {
      if (!socket) {
        return;
      }
      const conversation = conversations.find((item) => item.id === payload.conversationId);
      if (!conversation) {
        return;
      }
      const partnerName =
        conversation.members.find((member) => member.userId === payload.fromUserId)?.user.username ??
        'Unknown';
      callContextRef.current = {
        conversationId: payload.conversationId,
        peerUserId: payload.fromUserId,
        partnerName,
        isCaller: false
      };
      const peer = await ensurePeer();
      await peer.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
      const stream = await startLocalStream();
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      setCallUi({ visible: true, isCaller: false, partnerName });
      socket.emit('call:answer', {
        conversationId: payload.conversationId,
        toUserId: payload.fromUserId,
        sdp: answer.sdp
      });
    },
    [socket, conversations, ensurePeer, startLocalStream]
  );

  const handleCallAnswer = useCallback(
    async (payload: { conversationId: string; fromUserId: string; sdp: string }) => {
      if (!peerRef.current) {
        return;
      }
      await peerRef.current.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
    },
    []
  );

  const handleCallCandidate = useCallback(
    async (payload: { candidate: RTCIceCandidateInit }) => {
      if (!peerRef.current || !payload.candidate) {
        return;
      }
      await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
    },
    []
  );

  const handleCallHangup = useCallback(() => {
    cleanupCall();
  }, [cleanupCall]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    socket.on('call:offer', handleCallOffer);
    socket.on('call:answer', handleCallAnswer);
    socket.on('call:candidate', handleCallCandidate);
    socket.on('call:hangup', handleCallHangup);
    return () => {
      socket.off('call:offer', handleCallOffer);
      socket.off('call:answer', handleCallAnswer);
      socket.off('call:candidate', handleCallCandidate);
      socket.off('call:hangup', handleCallHangup);
    };
  }, [socket, handleCallOffer, handleCallAnswer, handleCallCandidate, handleCallHangup]);

  const initiateCall = useCallback(
    async (conversationId: string, peerUserId: string, partnerName: string) => {
      if (!socket) {
        return;
      }
      callContextRef.current = { conversationId, peerUserId, partnerName, isCaller: true };
      const peer = await ensurePeer();
      const stream = await startLocalStream();
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      setCallUi({ visible: true, isCaller: true, partnerName });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('call:offer', { conversationId, toUserId: peerUserId, sdp: offer.sdp });
    },
    [socket, ensurePeer, startLocalStream]
  );

  const hangupCall = useCallback(() => {
    if (socket && callContextRef.current) {
      socket.emit('call:hangup', {
        conversationId: callContextRef.current.conversationId,
        toUserId: callContextRef.current.peerUserId
      });
    }
    cleanupCall();
  }, [socket, cleanupCall]);

  const sendMessage = useCallback(
    async (type: MessageType, content: string, fileUrl?: string) => {
      if (!socket || !selectedConversationId) {
        return;
      }
      socket.emit('sendMessage', {
        conversationId: selectedConversationId,
        type,
        content,
        fileUrl
      });
    },
    [socket, selectedConversationId]
  );

  const handleSendText = useCallback(
    async (text: string) => {
      await sendMessage('TEXT', text);
    },
    [sendMessage]
  );

  const handleTypingEmit = useCallback(
    (isTyping: boolean) => {
      if (!socket || !selectedConversationId) {
        return;
      }
      socket.emit('typing', { conversationId: selectedConversationId, isTyping });
    },
    [socket, selectedConversationId]
  );

  const requestPresign = useCallback(async (file: File) => {
    const response = await api.get<PresignResponse>('/storage/presign', {
      params: {
        filename: file.name,
        contentType: file.type
      }
    });
    return response.data;
  }, []);

  const handleUploadFile = useCallback(
    async (file: File) => {
      if (uploadAbortRef.current) {
        uploadAbortRef.current.abort();
      }
      const presign = await requestPresign(file);
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      setUploadingFileName(file.name);
      setUploadProgress(0);

      const reader = file.stream().getReader();
      const total = file.size || 1;
      let uploaded = 0;

      const monitoredStream = new ReadableStream<Uint8Array>({
        async pull(control) {
          const { done, value } = await reader.read();
          if (done) {
            control.close();
            return;
          }
          if (value) {
            uploaded += value.length;
            setUploadProgress(Math.min(uploaded / total, 1));
            control.enqueue(value);
          }
        },
        cancel(reason) {
          return reader.cancel(reason);
        }
      });

      try {
        const response = await fetch(presign.putUrl, {
          method: 'PUT',
          headers: presign.headers,
          body: monitoredStream,
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('Upload failed');
        }
        setUploadProgress(1);
        await sendMessage('FILE', file.name, presign.getUrl);
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') {
          console.error('Upload failed', error);
        }
      } finally {
        if (uploadAbortRef.current === controller) {
          uploadAbortRef.current = null;
        }
        setUploadProgress(null);
        setUploadingFileName(null);
      }
    },
    [requestPresign, sendMessage]
  );

  const cancelUpload = useCallback(() => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    setUploadProgress(null);
    setUploadingFileName(null);
  }, []);

  const currentConversation = useMemo(() => {
    if (!selectedConversationId) {
      return undefined;
    }
    return conversations.find((conversation) => conversation.id === selectedConversationId);
  }, [selectedConversationId, conversations]);

  const currentTyping = useMemo(() => {
    if (!selectedConversationId) {
      return null;
    }
    const activeUserId = Object.entries(typingState).find(([, active]) => active)?.[0];
    if (!activeUserId) {
      return null;
    }
    const member = currentConversation?.members.find((conversationMember) => conversationMember.userId === activeUserId);
    return member?.user.username ?? null;
  }, [typingState, currentConversation, selectedConversationId]);

  const lastMessageId = useMemo(() => messages[messages.length - 1]?.id, [messages]);

  const emitReadAck = useCallback(() => {
    if (!socket || !selectedConversationId || !lastMessageId) {
      return;
    }
    socket.emit('readAck', { conversationId: selectedConversationId, messageId: lastMessageId });
    setUnreadCounts((prev) => ({ ...prev, [selectedConversationId]: 0 }));
  }, [socket, selectedConversationId, lastMessageId]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const handler = () => {
      if (document.visibilityState === 'visible') {
        emitReadAck();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
    };
  }, [emitReadAck]);

  useEffect(() => {
    emitReadAck();
  }, [emitReadAck]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }));
  }, []);

  if (!isHydrated) {
    return <div className="flex h-full items-center justify-center">Loading…</div>;
  }

  if (!user) {
    return <div className="flex h-full items-center justify-center">Redirecting…</div>;
  }

  return (
    <div className="flex h-full">
      <aside className="w-72 border-r border-slate-800 bg-slate-900">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          presence={presence}
          unreadCounts={unreadCounts}
        />
        <div className="border-t border-slate-800 p-4 text-sm text-slate-400">
          Logged in as <span className="font-medium text-slate-100">{user.username}</span>
          <button onClick={logout} className="ml-2 text-xs text-red-400 hover:underline" type="button">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {currentConversation
                ? currentConversation.isGroup
                  ? 'Group chat'
                  : currentConversation.members.find((member) => member.userId !== user.id)?.user.username ??
                    'Conversation'
                : 'Select a conversation'}
            </h2>
            {currentTyping && <p className="text-xs text-slate-400">{currentTyping} is typing…</p>}
          </div>
          {currentConversation && !currentConversation.isGroup && (
            <button
              type="button"
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500/90"
              onClick={() => {
                const peerMember = currentConversation.members.find((member) => member.userId !== user.id);
                if (peerMember) {
                  void initiateCall(currentConversation.id, peerMember.userId, peerMember.user.username);
                }
              }}
            >
              Start voice call
            </button>
          )}
        </div>
        {selectedConversationId ? (
          <>
            <MessageList messages={messages} />
            <ChatInput
              disabled={loadingMessages}
              onSendText={handleSendText}
              onUploadFile={handleUploadFile}
              onTyping={handleTypingEmit}
              isUploading={uploadProgress !== null}
              uploadProgress={uploadProgress}
              uploadingFileName={uploadingFileName}
              onCancelUpload={cancelUpload}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-slate-500">
            Choose a conversation to begin chatting.
          </div>
        )}
      </main>
      <CallModal
        visible={callUi.visible}
        isCaller={callUi.isCaller}
        partnerName={callUi.partnerName}
        localStream={localStream}
        remoteStream={remoteStream}
        onHangup={hangupCall}
      />
    </div>
  );
}
