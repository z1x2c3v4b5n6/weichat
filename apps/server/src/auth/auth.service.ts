import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private async validatePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private async buildResponse(userId: string, username: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true, createdAt: true }
    });

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, username },
      {
        secret: this.configService.get<string>('JWT_SECRET') ?? 'secret',
        expiresIn: '15m'
      }
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'refresh',
        expiresIn: '7d'
      }
    );

    const refresh = await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return { accessToken, refreshToken, refreshTokenId: refresh.id, user };
  }

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash
      }
    });

    return this.buildResponse(user.id, user.username);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.validatePassword(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildResponse(user.id, user.username);
  }

  async refresh(userId: string, token: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId, token, expiresAt: { gt: new Date() } }
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.buildResponse(user.id, user.username);
  }
}
