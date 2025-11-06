import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MessageQueryDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
