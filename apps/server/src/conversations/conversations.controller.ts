import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ConversationsService, ConversationWithRelations } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async list(@Req() req: Request): Promise<ConversationWithRelations[]> {
    if (!req.user) {
      throw new UnauthorizedException('Missing user');
    }
    return this.conversationsService.list(req.user.id);
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateConversationDto): Promise<ConversationWithRelations> {
    if (!req.user) {
      throw new UnauthorizedException('Missing user');
    }
    return this.conversationsService.create(req.user.id, dto);
  }
}
