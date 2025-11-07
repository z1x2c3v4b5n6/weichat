'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Message } from '@chat-app/types';
import { formatTime, cn } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps): JSX.Element {
  const currentUser = useAuthStore((state) => state.user);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const renderMessageBody = useMemo(
    () =>
      (message: Message): JSX.Element => {
        if (message.type === 'TEXT') {
          return <span>{message.content}</span>;
        }

        const fileName = message.content;
        const fileUrl = message.fileUrl ?? '#';
        const lowerName = fileName.toLowerCase();
        const isImage = /(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/.test(lowerName);
        const isAudio = /(\.mp3|\.wav|\.ogg|\.m4a)$/.test(lowerName);

        if (message.type === 'IMAGE' || isImage) {
          return (
            <div className="flex max-w-xs flex-col gap-2">
              <img src={fileUrl} alt={fileName} className="max-h-64 rounded-lg object-cover" />
              <a href={fileUrl} target="_blank" rel="noreferrer" className="text-xs underline">
                预览 / 下载
              </a>
            </div>
          );
        }

        if (message.type === 'AUDIO' || isAudio) {
          return (
            <div className="flex max-w-xs flex-col gap-2">
              <audio controls className="w-full">{fileUrl && <source src={fileUrl} />}</audio>
              <a href={fileUrl} download className="text-xs underline">
                下载 {fileName}
              </a>
            </div>
          );
        }

        return (
          <div className="flex max-w-xs flex-col gap-2">
            <span className="break-all">{fileName}</span>
            <div className="flex flex-wrap gap-3 text-xs underline">
              <a href={fileUrl} target="_blank" rel="noreferrer">
                预览
              </a>
              <a href={fileUrl} download>
                下载
              </a>
            </div>
          </div>
        );
      },
    []
  );

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
              {renderMessageBody(message)}
            </div>
            <span className="mt-1 text-xs text-slate-500">{formatTime(message.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
