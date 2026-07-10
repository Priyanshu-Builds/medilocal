import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Private S3 bucket access via time-limited signed URLs — prescriptions are
 * sensitive health data (DPDP Act) and are NEVER publicly readable.
 * Disabled-mode when env vars are absent, like FirebaseService.
 * S3_ENDPOINT allows an S3-compatible store (MinIO) for local dev.
 */
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private client: S3Client | null = null;
  private bucket = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const region = this.config.get<string>('S3_REGION');
    const bucket = this.config.get<string>('S3_BUCKET');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      this.logger.warn('S3 env vars not set — prescription upload disabled until configured');
      return;
    }

    const endpoint = this.config.get<string>('S3_ENDPOINT'); // e.g. http://localhost:9000 for MinIO
    this.bucket = bucket;
    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
    this.logger.log(`S3 ready: bucket ${bucket} (${endpoint ?? region})`);
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  private mustClient(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException('File storage is not configured on this server');
    }
    return this.client;
  }

  /** Presigned PUT the client uploads the file to directly (API never proxies bytes). */
  presignUpload(key: string, contentType: string, expiresInSec = 300): Promise<string> {
    return getSignedUrl(
      this.mustClient(),
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSec },
    );
  }

  /** Presigned GET for pharmacist/admin viewing. Short-lived by design. */
  presignView(key: string, expiresInSec = 300): Promise<string> {
    return getSignedUrl(
      this.mustClient(),
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSec },
    );
  }
}
