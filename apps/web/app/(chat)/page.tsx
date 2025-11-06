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
import { CallService, type CallSnapshot } from '@/services/call-service';

interface PaginatedMessagesResponse {
  items: Message[];
  nextCursor?: string;
}

const createInitialCallSnapshot = (): CallSnapshot => ({
  state: { status: 'idle', partnerName: null, isCaller: false, isMuted: false },
  context: null,
  localStream: null,
  remoteStream: null
});

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
  const [callSnapshot, setCallSnapshot] = useState<CallSnapshot>(() => createInitialCallSnapshot());

  const callServiceRef = useRef<CallService | null>(null);
  const conversationsRef = useRef<ConversationSummary[]>([]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

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
      if (message.conversationId === selectedConversationId) {
        setMessages((prev) => [...prev, message]);
      }
    },
    [selectedConversationId]
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

  const handleReadAck = useCallback((payload: ReadAckPayload) => {
    setTypingState((prev) => ({ ...prev, [payload.userId]: false }));
  }, []);

  const { socket } = useChatSocket({
    onMessage: handleMessageCreated,
    onPresence: handlePresence,
    onTyping: handleTyping,
    onReadAck: handleReadAck
  });

  useEffect(() => {
    if (!socket) {
      if (callServiceRef.current) {
        callServiceRef.current.dispose();
        callServiceRef.current = null;
      }
      setCallSnapshot(createInitialCallSnapshot());
      return;
    }
    if (!user) {
      return;
    }
    const service = new CallService({
      socket,
      currentUserId: user.id,
      resolvePeer: (conversationId: string, peerUserId: string) => {
        const conversation = conversationsRef.current.find((item) => item.id === conversationId);
        if (!conversation) {
          return undefined;
        }
        const member = conversation.members.find((entry) => entry.userId === peerUserId);
        if (!member) {
          return undefined;
        }
        return { partnerName: member.user.username };
      }
    });
    callServiceRef.current = service;
    const unsubscribe = service.subscribe((snapshot) => {
      setCallSnapshot(snapshot);
    });
    return () => {
      unsubscribe();
      service.dispose();
      callServiceRef.current = null;
    };
  }, [socket, user]);

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

  const incomingConversationId = callSnapshot.context?.conversationId ?? null;
  useEffect(() => {
    if (
      callSnapshot.state.status === 'incoming' &&
      incomingConversationId &&
      incomingConversationId !== selectedConversationId
    ) {
      setSelectedConversationId(incomingConversationId);
    }
  }, [callSnapshot.state.status, incomingConversationId, selectedConversationId]);

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
    const response = await api.get<{ objectKey: string; putUrl: string; getUrl: string }>(
      '/storage/presign',
      {
        params: {
          filename: file.name,
          contentType: file.type
        }
      }
    );
    return response.data;
  }, []);

  const handleUploadFile = useCallback(
    async (file: File) => {
      const presign = await requestPresign(file);
      await fetch(presign.putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });
      const type: MessageType = file.type.startsWith('audio') ? 'AUDIO' : file.type.startsWith('image') ? 'IMAGE' : 'FILE';
      await sendMessage(type, file.name, presign.getUrl);
    },
    [requestPresign, sendMessage]
  );

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

  const handleStartCall = useCallback(() => {
    const service = callServiceRef.current;
    if (!service || !currentConversation || !user) {
      return;
    }
    if (currentConversation.isGroup) {
      return;
    }
    const peerMember = currentConversation.members.find((member) => member.userId !== user.id);
    if (!peerMember) {
      return;
    }
    void service.startCall(currentConversation.id, peerMember.userId);
  }, [currentConversation, user]);

  const handleAcceptCall = useCallback(() => {
    void callServiceRef.current?.acceptCall();
  }, []);

  const handleHangupCall = useCallback(() => {
    callServiceRef.current?.hangup();
  }, []);

  const handleToggleMute = useCallback(() => {
    callServiceRef.current?.toggleMute();
  }, []);

  const callStatusLabel = useMemo(() => {
    const { status, partnerName } = callSnapshot.state;
    if (status === 'idle') {
      return null;
    }
    if (status === 'calling') {
      return `Calling ${partnerName ?? 'participant'}…`;
    }
    if (status === 'incoming') {
      return `Incoming call from ${partnerName ?? 'participant'}`;
    }
    if (status === 'connecting') {
      return 'Connecting voice call…';
    }
    if (status === 'connected') {
      return `In call with ${partnerName ?? 'participant'}`;
    }
    return null;
  }, [callSnapshot.state]);

  const isCallConversation = callSnapshot.context?.conversationId === currentConversation?.id;
  const isDirectConversation = Boolean(currentConversation && !currentConversation.isGroup);

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
          onSelect={setSelectedConversationId}
          presence={presence}
        />
        <div className="border-t border-slate-800 p-4 text-sm text-slate-400">
          Logged in as <span className="font-medium text-slate-100">{user.username}</span>
          <button onClick={logout} className="ml-2 text-xs text-red-400 hover:underline" type="button">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
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
            {callStatusLabel && (
              <p className="mt-1 text-xs font-medium text-emerald-300">{callStatusLabel}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDirectConversation && callSnapshot.state.status === 'idle' && (
              <button
                type="button"
                onClick={handleStartCall}
                disabled={!callServiceRef.current}
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500/90 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                Start voice call
              </button>
            )}
            {callSnapshot.state.status === 'incoming' && isCallConversation && (
              <>
                <button
                  type="button"
                  onClick={handleAcceptCall}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500/90"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={handleHangupCall}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                >
                  Decline
                </button>
              </>
            )}
            {callSnapshot.state.status !== 'idle' && callSnapshot.state.status !== 'incoming' && isCallConversation && (
              <>
                <button
                  type="button"
                  onClick={handleHangupCall}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                >
                  Hang up
                </button>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
                >
                  {callSnapshot.state.isMuted ? 'Unmute mic' : 'Mute mic'}
                </button>
              </>
            )}
          </div>
        </div>
        {selectedConversationId ? (
          <>
            <MessageList messages={messages} />
            <ChatInput
              disabled={loadingMessages}
              onSendText={handleSendText}
              onUploadFile={handleUploadFile}
              onTyping={handleTypingEmit}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-slate-500">
            Choose a conversation to begin chatting.
          </div>
        )}
      </main>
      <CallModal snapshot={callSnapshot} />
    </div>
  );
}
