'use client';

import { FormEvent, useRef, useState } from 'react';
import { Paperclip, SendHorizonal } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChatInputProps {
  disabled?: boolean;
  onSendText: (text: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
}

export function ChatInput({ disabled, onSendText, onUploadFile, onTyping }: ChatInputProps): JSX.Element {
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }
    setIsSending(true);
    await onSendText(value.trim());
    setValue('');
    setIsSending(false);
    onTyping(false);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return;
    }
    setIsSending(true);
    await onUploadFile(file);
    setIsSending(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-800 p-4">
      <button
        type="button"
        className="rounded-full bg-slate-800 p-2 text-slate-200 transition hover:bg-slate-700"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isSending}
      >
        <Paperclip className="h-5 w-5" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0] ?? null;
          await handleUpload(file);
          event.target.value = '';
        }}
      />
      <textarea
        className="flex-1 resize-none rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none"
        placeholder="Type a message"
        rows={1}
        value={value}
        disabled={disabled || isSending}
        onChange={(event) => {
          setValue(event.target.value);
          onTyping(event.target.value.length > 0);
        }}
      />
      <button
        type="submit"
        className={cn(
          'flex items-center gap-1 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition',
          disabled || isSending || value.trim().length === 0 ? 'opacity-60' : 'hover:bg-brand-500/90'
        )}
        disabled={disabled || isSending || value.trim().length === 0}
      >
        <SendHorizonal className="h-4 w-4" />
        Send
      </button>
    </form>
  );
}
