import { Controller, Get, Query, UnauthorizedException, Req } from '@nestjs/common';
import { Request } from 'express';
import { StorageService, PresignResult } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('presign')
  async presign(
    @Req() req: Request,
    @Query('filename') filename: string,
    @Query('contentType') contentType: string
  ): Promise<PresignResult> {
    if (!req.user) {
      throw new UnauthorizedException('Missing user');
    }
    return this.storageService.presign(filename, contentType);
  }
}
