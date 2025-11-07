import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

export type ConversationWithRelations = Prisma.ConversationGetPayload<{
  include: {
    members: {
      include: {
        user: {
          select: {
            id: true;
            username: true;
            avatarUrl: true;
          };
        };
      };
    };
    messages: true;
  };
}>;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureMembership(conversationId: string, userId: string): Promise<void> {
    const isMember = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId }
    });
    if (!isMember) {
      throw new ForbiddenException('Not a member of this conversation');
    }
  }

  async list(userId: string): Promise<ConversationWithRelations[]> {
    return this.prisma.conversation.findMany({
      where: {
        members: {
          some: { userId }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(userId: string, dto: CreateConversationDto): Promise<ConversationWithRelations> {
    const memberIds = dto.memberIds.includes(userId) ? dto.memberIds : [...dto.memberIds, userId];
    const uniqueMemberIds = Array.from(new Set(memberIds));

    return this.prisma.conversation.create({
      data: {
        isGroup: dto.isGroup,
        members: {
          create: uniqueMemberIds.map((memberId) => ({
            userId: memberId,
            role: memberId === userId ? 'ADMIN' : 'MEMBER'
          }))
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true }
            }
          }
        },
        messages: true
      }
    });
  }

  async getMemberIds(conversationId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true }
    });
    return members.map((member) => member.userId);
  }
}
