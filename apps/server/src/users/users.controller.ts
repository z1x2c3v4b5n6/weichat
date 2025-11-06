import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(
    @Req() req: Request
  ): Promise<{ id: string; username: string; avatarUrl: string | null; createdAt: Date }> {
    if (!req.user) {
      throw new UnauthorizedException('Missing user in request');
    }
    return this.usersService.getCurrentUser(req.user.id);
  }
}
