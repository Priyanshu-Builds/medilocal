import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay = require('razorpay');

/**
 * Thin Razorpay SDK wrapper with the same disabled-mode convention as
 * Firebase/S3: without keys the API boots and COD keeps working; online
 * payment endpoints return 503.
 */
@Injectable()
export class RazorpayService implements OnModuleInit {
  private readonly logger = new Logger(RazorpayService.name);
  private client: InstanceType<typeof Razorpay> | null = null;
  private _keyId = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      this.logger.warn('Razorpay keys not set — online payments disabled (COD still works)');
      return;
    }
    this._keyId = keyId;
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    this.logger.log(`Razorpay initialized (${keyId.startsWith('rzp_test') ? 'TEST' : 'LIVE'} mode)`);
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Public key id the mobile checkout needs. */
  get keyId(): string {
    return this._keyId;
  }

  get keySecret(): string {
    return this.config.get<string>('RAZORPAY_KEY_SECRET') ?? '';
  }

  get webhookSecret(): string {
    return this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';
  }

  private mustClient() {
    if (!this.client) {
      throw new ServiceUnavailableException('Online payments are not configured; use COD');
    }
    return this.client;
  }

  /** amount is in paise, as Razorpay expects. receipt = our order code. */
  createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
    return this.mustClient().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes,
    });
  }

  /** Full or partial refund of a captured payment. amount in paise. */
  refund(razorpayPaymentId: string, amountPaise: number, notes: Record<string, string> = {}) {
    return this.mustClient().payments.refund(razorpayPaymentId, {
      amount: amountPaise,
      speed: 'normal',
      notes,
    });
  }
}
