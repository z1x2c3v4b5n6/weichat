'use client';

import { FormEvent, useRef, useState } from 'react';
import { Paperclip, SendHorizonal } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChatInputProps {
  disabled?: boolean;
  onSendText: (text: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  isUploading?: boolean;
  uploadProgress?: number | null;
  uploadingFileName?: string | null;
  onCancelUpload?: () => void;
}

export function ChatInput({
  disabled,
  onSendText,
  onUploadFile,
  onTyping,
  isUploading = false,
  uploadProgress = null,
  uploadingFileName = null,
  onCancelUpload
}: ChatInputProps): JSX.Element {
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
    await onUploadFile(file);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-slate-800 p-4">
      {isUploading && uploadingFileName && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-200">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">{uploadingFileName}</span>
              <span>{Math.round((uploadProgress ?? 0) * 100)}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-slate-700">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${Math.round((uploadProgress ?? 0) * 100)}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-red-400 transition hover:text-red-300"
            onClick={onCancelUpload}
          >
            取消
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-full bg-slate-800 p-2 text-slate-200 transition hover:bg-slate-700"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSending || isUploading}
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
          disabled={disabled || isSending || isUploading}
        />
        <textarea
          className="flex-1 resize-none rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-100 focus:outline-none"
          placeholder="Type a message"
          rows={1}
          value={value}
          disabled={disabled || isSending || isUploading}
          onChange={(event) => {
            setValue(event.target.value);
            onTyping(event.target.value.length > 0);
          }}
        />
        <button
          type="submit"
          className={cn(
            'flex items-center gap-1 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition',
            disabled || isSending || isUploading || value.trim().length === 0 ? 'opacity-60' : 'hover:bg-brand-500/90'
          )}
          disabled={disabled || isSending || isUploading || value.trim().length === 0}
        >
          <SendHorizonal className="h-4 w-4" />
          Send
        </button>
      </div>
    </form>
  );
}
