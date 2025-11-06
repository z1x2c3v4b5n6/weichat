import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUser(userId: string): Promise<{ id: string; username: string; avatarUrl: string | null; createdAt: Date }> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true, createdAt: true }
    });
  }
}
