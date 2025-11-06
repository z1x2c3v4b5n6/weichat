import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { v4 as uuid } from 'uuid';

export interface PresignResult {
  objectKey: string;
  putUrl: string;
  getUrl: string;
}

@Injectable()
export class StorageService {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'chat-uploads');
    this.publicUrl = this.configService.get<string>('S3_PUBLIC_URL', 'http://localhost:9000/chat-uploads');
    this.client = new Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.configService.get<number>('MINIO_PORT', 9000),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', '')
    });
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket).catch(async (error: unknown) => {
      if ((error as { code?: string }).code === 'NoSuchBucket') {
        return false;
      }
      throw error;
    });

    if (!exists) {
      await this.client.makeBucket(this.bucket, 'us-east-1');
    }
  }

  async presign(filename: string, contentType: string): Promise<PresignResult> {
    await this.ensureBucket();
    const extension = filename.includes('.') ? filename.split('.').pop() : undefined;
    const objectKey = `${uuid()}${extension ? `.${extension}` : ''}`;

    const putUrl = await this.client.presignedPutObject(this.bucket, objectKey, 60 * 10, {
      'Content-Type': contentType
    });
    const getUrl = `${this.publicUrl}/${objectKey}`;

    return { objectKey, putUrl, getUrl };
  }
}
