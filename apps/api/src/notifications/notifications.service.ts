import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';
import type { OrderState } from '@medilocal/shared';

/**
 * Best-effort FCM pushes. Every method swallows failures — a dead device
 * token must never fail an order transition. (BullMQ queueing comes with
 * scale; direct sends are fine at pilot volume.)
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  async notifyUser(userId: string, title: string, body: string, data: Record<string, string> = {}) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true },
      });
      if (user?.fcmToken) await this.firebase.sendPush(user.fcmToken, { title, body }, data);
    } catch (err) {
      this.logger.warn(`notifyUser failed: ${(err as Error).message}`);
    }
  }

  async notifyRider(riderId: string, title: string, body: string, data: Record<string, string> = {}) {
    try {
      const rider = await this.prisma.rider.findUnique({
        where: { id: riderId },
        select: { fcmToken: true },
      });
      if (rider?.fcmToken) await this.firebase.sendPush(rider.fcmToken, { title, body }, data);
    } catch (err) {
      this.logger.warn(`notifyRider failed: ${(err as Error).message}`);
    }
  }

  /** Customer-facing copy for order lifecycle events. */
  orderStateChanged(
    order: { id: string; code: string; userId: string },
    toState: OrderState,
    extra?: string,
  ) {
    const copy: Partial<Record<OrderState, [string, string]>> = {
      ACCEPTED: ['Order confirmed', `Order ${order.code} is confirmed by the pharmacy.`],
      PACKED: ['Order packed', `Order ${order.code} is packed and ready for pickup.`],
      RIDER_ASSIGNED: ['Rider assigned', `A delivery partner is assigned to order ${order.code}.`],
      PICKED_UP: ['Order picked up', `Order ${order.code} has been picked up.`],
      OUT_FOR_DELIVERY: [
        'Out for delivery',
        `Order ${order.code} is on the way. Share the delivery code from the app with the rider.`,
      ],
      DELIVERED: ['Delivered', `Order ${order.code} was delivered. Get well soon!`],
      RX_REJECTED: [
        'Prescription rejected',
        `Order ${order.code} could not be approved.${extra ? ` Reason: ${extra}` : ''}`,
      ],
      CANCELLED: ['Order cancelled', `Order ${order.code} has been cancelled.${extra ? ` ${extra}` : ''}`],
      UNDELIVERED: [
        'Delivery failed',
        `We could not deliver order ${order.code}.${extra ? ` ${extra}` : ''} Our team will reach out.`,
      ],
    };
    const message = copy[toState];
    if (!message) return;
    // Fire and forget — deliberately not awaited by callers on the hot path.
    void this.notifyUser(order.userId, message[0], message[1], {
      orderId: order.id,
      state: toState,
    });
  }
}
