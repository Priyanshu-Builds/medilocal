import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/**
 * Wraps Firebase Admin. Boots in "disabled" mode when service-account env vars
 * are absent so local development works before a Firebase project exists.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase env vars not set — customer phone login disabled until configured');
      return;
    }

    this.app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    this.logger.log(`Firebase Admin initialized for project ${projectId}`);
  }

  get enabled(): boolean {
    return this.app !== null;
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.app) {
      throw new ServiceUnavailableException('Firebase is not configured on this server');
    }
    return this.app.auth().verifyIdToken(idToken);
  }
}
