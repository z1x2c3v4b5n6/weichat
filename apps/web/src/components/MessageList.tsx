'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@chat-app/types';
import { formatTime, cn } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps): JSX.Element {
  const currentUser = useAuthStore((state) => state.user);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto space-y-3 p-4">
      {messages.map((message) => {
        const isSelf = message.senderId === currentUser?.id;
        return (
          <div key={message.id} className={cn('flex flex-col', isSelf ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'rounded-2xl px-4 py-2 text-sm shadow',
                isSelf ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-100'
              )}
            >
              {message.type === 'TEXT' ? (
                <span>{message.content}</span>
              ) : (
                <a
                  href={message.fileUrl ?? '#'}
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {message.content}
                </a>
              )}
            </div>
            <span className="mt-1 text-xs text-slate-500">{formatTime(message.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
