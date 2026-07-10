import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toInr, toPaise } from '../common/money';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from './razorpay.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Idempotently mark a Razorpay payment captured and flip the order to PAID.
   * Reached from BOTH the webhook (authoritative) and the client checkout
   * verify endpoint — whichever lands first wins, the second is a no-op.
   */
  async markCaptured(razorpayOrderId: string, razorpayPaymentId: string, raw?: unknown) {
    const payment = await this.prisma.payment.findUnique({
      where: { razorpayOrderId },
      include: { order: true },
    });
    if (!payment) {
      // Webhook for an order we don't know (e.g. another environment sharing keys).
      this.logger.warn(`payment.captured for unknown razorpay order ${razorpayOrderId}`);
      return null;
    }
    if (payment.status === 'captured') return payment.order; // idempotent replay

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'captured',
          razorpayPaymentId,
          ...(raw !== undefined ? { raw: raw as Prisma.InputJsonValue } : {}),
        },
      }),
      this.prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentState: 'PAID' },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          fromState: payment.order.state,
          toState: payment.order.state, // payment state changed, order state didn't
          actorType: 'SYSTEM',
          note: `Payment captured (₹${payment.amountInr}) via Razorpay ${razorpayPaymentId}`,
        },
      }),
    ]);

    void this.notifications.notifyUser(
      payment.order.userId,
      'Payment received',
      `₹${payment.amountInr} received for order ${payment.order.code}. The pharmacy has been notified.`,
      { orderId: payment.orderId },
    );
    return this.prisma.order.findUnique({ where: { id: payment.orderId } });
  }

  async markFailed(razorpayOrderId: string, raw?: unknown) {
    const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId } });
    // Never regress a captured payment (out-of-order webhook delivery).
    if (!payment || payment.status === 'captured') return;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', ...(raw !== undefined ? { raw: raw as Prisma.InputJsonValue } : {}) },
    });
  }

  async markRefundProcessed(razorpayRefundId: string) {
    await this.prisma.refund.updateMany({
      where: { razorpayRefundId },
      data: { status: 'processed' },
    });
  }

  /**
   * Refund `amountInr` of an order's captured Razorpay payment (partial
   * acceptance / cancellation / Rx rejection / failed delivery). Refund rows
   * are always recorded; the Razorpay API call is skipped in disabled mode so
   * local flows still work (row stays 'initiated' for manual reconciliation).
   * No-op for COD orders — there is nothing to refund.
   */
  async refundOrderAmount(orderId: string, amountInr: number, reason: string) {
    if (amountInr <= 0) return null;
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, method: 'RAZORPAY', status: 'captured' },
      include: { refunds: true, order: true },
    });
    if (!payment) return null;

    const alreadyRefundedPaise = payment.refunds
      .filter((r) => r.status !== 'failed')
      .reduce((sum, r) => sum + toPaise(r.amountInr), 0);
    const paidPaise = toPaise(payment.amountInr);
    const requestedPaise = Math.min(toPaise(amountInr), paidPaise - alreadyRefundedPaise);
    if (requestedPaise <= 0) return null;

    let razorpayRefundId: string | null = null;
    let status = 'initiated';
    if (this.razorpay.enabled && payment.razorpayPaymentId) {
      try {
        const refund = await this.razorpay.refund(payment.razorpayPaymentId, requestedPaise, {
          reason,
          orderCode: payment.order.code,
        });
        razorpayRefundId = String(refund.id);
        status = refund.status === 'processed' ? 'processed' : 'initiated';
      } catch (err) {
        this.logger.error(`Razorpay refund failed for order ${payment.order.code}: ${(err as Error).message}`);
        status = 'failed'; // recorded for finance follow-up; order flow continues
      }
    } else {
      this.logger.warn(
        `Razorpay disabled — refund ₹${toInr(requestedPaise)} for order ${payment.order.code} recorded as initiated (manual)`,
      );
    }

    const refund = await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        amountInr: toInr(requestedPaise),
        status,
        razorpayRefundId,
        reason,
      },
    });

    const totalRefundedPaise =
      alreadyRefundedPaise + (status !== 'failed' ? requestedPaise : 0);
    if (totalRefundedPaise > 0) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentState: totalRefundedPaise >= paidPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });
    }
    return refund;
  }

  /** Webhook fan-out. Unknown events are acknowledged and ignored. */
  async handleWebhookEvent(event: string, payload: Record<string, any>) {
    switch (event) {
      case 'payment.captured': {
        const entity = payload?.payment?.entity;
        if (entity?.order_id && entity?.id) {
          await this.markCaptured(entity.order_id, entity.id, entity);
        }
        break;
      }
      case 'payment.failed': {
        const entity = payload?.payment?.entity;
        if (entity?.order_id) await this.markFailed(entity.order_id, entity);
        break;
      }
      case 'refund.processed': {
        const entity = payload?.refund?.entity;
        if (entity?.id) await this.markRefundProcessed(entity.id);
        break;
      }
      default:
        this.logger.debug(`Ignoring webhook event ${event}`);
    }
  }
}
