import { Injectable } from '@nestjs/common';

@Injectable()
export class WebrtcService {
  getIceServers(): { urls: string }[] {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}
