import { Controller, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { MessagesService, PaginatedMessages } from './messages.service';
import { MessageQueryDto } from './dto/message-query.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async list(@Req() req: Request, @Query() query: MessageQueryDto): Promise<PaginatedMessages> {
    if (!req.user) {
      throw new UnauthorizedException('Missing user');
    }
    return this.messagesService.list(query.conversationId, req.user.id, query.cursor);
  }
}
