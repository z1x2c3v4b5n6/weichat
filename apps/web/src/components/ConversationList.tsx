'use client';

import type { ConversationSummary, PresenceState } from '../types/chat';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  presence: PresenceState;
}

export function ConversationList({ conversations, selectedId, onSelect, presence }: ConversationListProps): JSX.Element {
  const currentUser = useAuthStore((state) => state.user);

  return (
    <div className="flex h-full flex-col divide-y divide-slate-800">
      <div className="p-4 text-lg font-semibold">Conversations</div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const otherMembers = conversation.members.filter((member) => member.userId !== currentUser?.id);
          const title = conversation.isGroup
            ? otherMembers.map((member) => member.user.username).join(', ')
            : otherMembers[0]?.user.username ?? 'Unknown';
          const lastMessagePreview = conversation.lastMessage?.content ?? 'Start chatting';
          const isOnline = !conversation.isGroup && presence[otherMembers[0]?.userId ?? ''] === true;

          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              type="button"
              className={cn(
                'flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-800/60',
                selectedId === conversation.id ? 'bg-slate-800' : 'bg-transparent'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">{title}</span>
                {isOnline && <span className="text-xs text-green-400">Online</span>}
              </div>
              <span className="line-clamp-1 text-sm text-slate-400">{lastMessagePreview}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
