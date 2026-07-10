import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/**
 * Wraps Firebase Admin (Auth for phone-OTP verification, Messaging for FCM).
 * Boots in "disabled" mode when service-account env vars are absent so local
 * development works before a Firebase project exists.
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
      this.logger.warn('Firebase env vars not set — phone login and FCM push disabled until configured');
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

  /**
   * Fire an FCM push to a single device. Returns false (never throws) when
   * Firebase is disabled or the send fails — notifications are best-effort
   * and must never break an order flow.
   */
  async sendPush(
    fcmToken: string,
    notification: { title: string; body: string },
    data: Record<string, string> = {},
  ): Promise<boolean> {
    if (!this.app) return false;
    try {
      await this.app.messaging().send({ token: fcmToken, notification, data });
      return true;
    } catch (err) {
      this.logger.warn(`FCM send failed: ${(err as Error).message}`);
      return false;
    }
  }
}
