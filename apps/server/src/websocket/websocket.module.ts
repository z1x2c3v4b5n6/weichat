import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [JwtModule.register({}), MessagesModule, ConversationsModule],
  providers: [ChatGateway]
})
export class WebsocketModule {}
