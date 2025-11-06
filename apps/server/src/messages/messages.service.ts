import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MessageType } from '@chat-app/types';
import { PrismaService } from '../prisma.service';

export type MessageWithSender = Prisma.MessageGetPayload<{
  include: {
    sender: {
      select: {
        id: true;
        username: true;
        avatarUrl: true;
      };
    };
  };
}>;

export interface PaginatedMessages {
  items: MessageWithSender[];
  nextCursor?: string;
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(conversationId: string, userId: string, cursor?: string): Promise<PaginatedMessages> {
    const isMember = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId }
    });
    if (!isMember) {
      throw new ForbiddenException('Not a member of this conversation');
    }

    const take = 30;
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });

    const nextCursor = messages.length === take ? messages[messages.length - 1]?.id : undefined;

    return { items: messages.reverse(), nextCursor };
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    type: MessageType,
    content: string,
    fileUrl?: string | null
  ): Promise<MessageWithSender> {
    const member = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId: senderId }
    });
    if (!member) {
      throw new ForbiddenException('Not a member of conversation');
    }

    return this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type,
        content,
        fileUrl
      },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true }
        }
      }
    });
  }
}
