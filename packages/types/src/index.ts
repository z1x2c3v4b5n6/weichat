export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO';

export interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  createdAt: string;
  members: ConversationMember[];
  lastMessage?: Message;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  user?: User;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  fileUrl?: string | null;
  createdAt: string;
  sender?: User;
}

export interface PaginatedMessages {
  items: Message[];
  nextCursor?: string | null;
}

export interface CallOffer {
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  sdp: string;
}

export interface CallAnswer {
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  sdp: string;
}

export interface CallCandidate {
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  candidate: RTCIceCandidateInit;
}

export interface PresencePayload {
  userId: string;
  online: boolean;
  lastSeen?: string;
}

export interface TypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface ReadAckPayload {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
}
