import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { MessageType } from '@chat-app/types';
import { MessagesService } from '../messages/messages.service';
import { RedisService } from '../redis/redis.service';
import { ConversationsService } from '../conversations/conversations.service';

type SocketWithUser = Socket & { userId?: string };

interface SendMessagePayload {
  conversationId: string;
  type: MessageType;
  content: string;
  fileUrl?: string;
}

interface TypingPayload {
  conversationId: string;
  isTyping: boolean;
}

interface ReadAckPayload {
  conversationId: string;
  messageId: string;
}

interface CallSignalPayload {
  conversationId: string;
  toUserId: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messagesService: MessagesService,
    private readonly redisService: RedisService,
    private readonly conversationsService: ConversationsService
  ) {
    const subscriber = this.redisService.getSubscriber();
    void subscriber.subscribe('presence', 'typing', 'readAck');
    subscriber.on('message', (channel, message) => {
      const payload = JSON.parse(message) as Record<string, unknown>;
      this.server.emit(channel, payload);
    });
  }

  async handleConnection(client: SocketWithUser): Promise<void> {
    try {
      const token = (client.handshake.auth.token as string | undefined) ?? undefined;
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET') ?? 'secret'
      });
      client.userId = payload.sub;
      await client.join(payload.sub);
      await this.redisService.getClient().set(`presence:${payload.sub}`, 'online', 'EX', 30);
      await this.redisService
        .getPublisher()
        .publish('presence', JSON.stringify({ userId: payload.sub, online: true }));
    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: SocketWithUser): Promise<void> {
    if (client.userId) {
      await this.redisService.getClient().del(`presence:${client.userId}`);
      await this.redisService
        .getPublisher()
        .publish('presence', JSON.stringify({ userId: client.userId, online: false }));
    }
  }

  private getUserId(client: SocketWithUser): string {
    if (!client.userId) {
      throw new Error('Unauthorized socket');
    }
    return client.userId;
  }

  @SubscribeMessage('joinConversation')
  async onJoin(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() conversationId: string
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.conversationsService.ensureMembership(conversationId, userId);
    await client.join(conversationId);
  }

  @SubscribeMessage('leaveConversation')
  async onLeave(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() conversationId: string
  ): Promise<void> {
    await client.leave(conversationId);
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: SendMessagePayload
  ): Promise<void> {
    const userId = this.getUserId(client);
    const message = await this.messagesService.createMessage(
      payload.conversationId,
      userId,
      payload.type,
      payload.content,
      payload.fileUrl
    );
    this.server.to(payload.conversationId).emit('messageCreated', message);
  }

  @SubscribeMessage('typing')
  async onTyping(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: TypingPayload
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.redisService
      .getPublisher()
      .publish('typing', JSON.stringify({ conversationId: payload.conversationId, userId, isTyping: payload.isTyping }));
  }

  @SubscribeMessage('readAck')
  async onReadAck(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: ReadAckPayload
  ): Promise<void> {
    const userId = this.getUserId(client);
    await this.redisService
      .getPublisher()
      .publish('readAck', JSON.stringify({ conversationId: payload.conversationId, userId, lastReadMessageId: payload.messageId }));
  }

  @SubscribeMessage('presence')
  async onPresence(@ConnectedSocket() client: SocketWithUser): Promise<void> {
    const userId = this.getUserId(client);
    await this.redisService.getClient().set(`presence:${userId}`, 'online', 'EX', 30);
    await this.redisService
      .getPublisher()
      .publish('presence', JSON.stringify({ userId, online: true }));
  }

  @SubscribeMessage('call:offer')
  async onCallOffer(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: CallSignalPayload
  ): Promise<void> {
    const userId = this.getUserId(client);
    this.server.to(payload.toUserId).emit('call:offer', { ...payload, fromUserId: userId });
  }

  @SubscribeMessage('call:answer')
  async onCallAnswer(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: CallSignalPayload
  ): Promise<void> {
    const userId = this.getUserId(client);
    this.server.to(payload.toUserId).emit('call:answer', { ...payload, fromUserId: userId });
  }

  @SubscribeMessage('call:candidate')
  async onCallCandidate(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: CallSignalPayload
  ): Promise<void> {
    const userId = this.getUserId(client);
    this.server.to(payload.toUserId).emit('call:candidate', { ...payload, fromUserId: userId });
  }

  @SubscribeMessage('call:hangup')
  async onCallHangup(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() payload: { toUserId: string; conversationId: string }
  ): Promise<void> {
    const userId = this.getUserId(client);
    this.server.to(payload.toUserId).emit('call:hangup', { ...payload, fromUserId: userId });
  }
}
