import { Controller, Get } from '@nestjs/common';
import { WebrtcService } from './webrtc.service';

@Controller('webrtc')
export class WebrtcController {
  constructor(private readonly webrtcService: WebrtcService) {}

  @Get('ice-servers')
  getIceServers(): { urls: string }[] {
    return this.webrtcService.getIceServers();
  }
}
