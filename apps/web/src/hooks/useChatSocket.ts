'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message, PresencePayload, TypingPayload, ReadAckPayload } from '@chat-app/types';
import { useAuthStore } from '../store/useAuthStore';

interface SocketEvents {
  onMessage: (message: Message) => void;
  onPresence: (payload: PresencePayload) => void;
  onTyping: (payload: TypingPayload) => void;
  onReadAck: (payload: ReadAckPayload) => void;
}

export const useChatSocket = ({ onMessage, onPresence, onTyping, onReadAck }: SocketEvents): {
  socket: Socket | null;
  connected: boolean;
} => {
  const token = useAuthStore((state) => state.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  const socketUrl = useMemo(
    () => `${process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001'}/chat`,
    []
  );

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const instance = io(socketUrl, {
      transports: ['websocket'],
      auth: { token }
    });

    socketRef.current = instance;

    instance.on('connect', () => setConnected(true));
    instance.on('disconnect', () => setConnected(false));
    instance.on('messageCreated', onMessage);
    instance.on('presence', onPresence);
    instance.on('typing', onTyping);
    instance.on('readAck', onReadAck);

    return () => {
      instance.off('messageCreated', onMessage);
      instance.off('presence', onPresence);
      instance.off('typing', onTyping);
      instance.off('readAck', onReadAck);
      instance.disconnect();
    };
  }, [token, socketUrl, onMessage, onPresence, onTyping, onReadAck]);

  return { socket: socketRef.current, connected };
};
