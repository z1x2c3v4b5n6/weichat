import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsBoolean()
  isGroup!: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  memberIds!: string[];

  @IsOptional()
  @IsString()
  name?: string;
}
