import type { Conversation, ConversationMember, Message, User } from '@chat-app/types';

export interface ConversationResponse extends Conversation {
  members: (ConversationMember & { user: User })[];
  messages: Message[];
}

export interface ConversationSummary extends Conversation {
  members: (ConversationMember & { user: User })[];
  lastMessage?: Message;
}

export interface PresenceState {
  [userId: string]: boolean;
}
