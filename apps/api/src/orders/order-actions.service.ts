import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';
import { CUSTOMER_CANCELLABLE_STATES, canTransition, type OrderState } from '@medilocal/shared';
import { toInr, toPaise } from '../common/money';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ItemDecisionDto } from './dto';

interface Actor {
  type: ActorType;
  id?: string;
}

/**
 * The order state machine. Every state change funnels through transition():
 * shared-package rules decide legality, an atomic guarded update prevents
 * double-transitions, and every hop lands in OrderStatusHistory.
 */
@Injectable()
export class OrderActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Core engine ───────────────────────────────────────────────────────

  private assertCan(from: OrderState, to: OrderState) {
    if (!canTransition(from, to)) {
      throw new ConflictException(`Order cannot move from ${from} to ${to}`);
    }
  }

  /**
   * Atomically move an order from `from` to `to`. The updateMany state guard
   * makes concurrent transitions lose cleanly (409) instead of corrupting the
   * machine.
   */
  private async transition(
    tx: Prisma.TransactionClient,
    order: { id: string; state: string },
    to: OrderState,
    actor: Actor,
    note?: string,
  ) {
    const from = order.state as OrderState;
    this.assertCan(from, to);
    const result = await tx.order.updateMany({
      where: { id: order.id, state: from },
      data: { state: to },
    });
    if (result.count === 0) {
      throw new ConflictException('Order was updated by someone else — refresh and retry');
    }
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromState: from, toState: to, actorType: actor.type, actorId: actor.id, note },
    });
  }

  private async loadOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, prescriptions: true, assignment: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private notify(order: { id: string; code: string; userId: string }, to: OrderState, extra?: string) {
    this.notifications.orderStateChanged({ id: order.id, code: order.code, userId: order.userId }, to, extra);
  }

  // ── Shop actions ──────────────────────────────────────────────────────

  /**
   * Item-by-item acceptance (partial acceptance is the small-town norm).
   * Dropped items are removed from the totals and auto-refunded for prepaid
   * orders. Accepting zero items cancels the order outright.
   */
  async shopAccept(shopId: string, staffId: string, orderId: string, decisions: ItemDecisionDto[]) {
    const order = await this.loadOrder(orderId);
    if (order.shopId !== shopId) throw new NotFoundException('Order not found');
    if (order.paymentState === 'PENDING') {
      throw new ConflictException('Payment not completed yet — wait for it to turn PAID');
    }
    this.assertCan(order.state as OrderState, 'ACCEPTED');
    if (order.requiresRx) {
      const allApproved =
        order.prescriptions.length > 0 && order.prescriptions.every((p) => p.status === 'APPROVED');
      if (!allApproved) {
        throw new ConflictException('Prescription not verified yet — the pharmacist must approve it first');
      }
    }

    const decisionByItem = new Map(decisions.map((d) => [d.orderItemId, d.accepted]));
    if (decisionByItem.size !== order.items.length || order.items.some((i) => !decisionByItem.has(i.id))) {
      throw new BadRequestException('Provide a decision for every item on the order');
    }

    const acceptedItems = order.items.filter((i) => decisionByItem.get(i.id));
    const droppedItems = order.items.filter((i) => !decisionByItem.get(i.id));
    const actor: Actor = { type: 'SHOP', id: staffId };

    if (acceptedItems.length === 0) {
      await this.prisma.$transaction(async (tx) => {
        await this.transition(tx, order, 'CANCELLED', actor, 'Shop has none of the items in stock');
        await tx.orderItem.updateMany({ where: { orderId }, data: { accepted: false } });
      });
      await this.refundIfPaid(order, Number(order.grandTotalInr), 'No items available at the shop');
      this.notify(order, 'CANCELLED', 'The pharmacy had none of the items in stock. Any payment will be refunded.');
      return this.loadOrder(orderId);
    }

    const acceptedTotalPaise = acceptedItems.reduce(
      (sum, item) => sum + toPaise(item.priceInrSnapshot) * item.qty,
      0,
    );
    const newGrandTotalPaise = acceptedTotalPaise + toPaise(order.deliveryFeeInr) - toPaise(order.discountInr);
    const droppedAmountPaise = toPaise(order.grandTotalInr) - newGrandTotalPaise;
    const droppedNote =
      droppedItems.length > 0
        ? `Unavailable items dropped: ${droppedItems.map((i) => i.nameSnapshot).join(', ')}`
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, 'ACCEPTED', actor, droppedNote ?? 'All items available');
      for (const item of order.items) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { accepted: decisionByItem.get(item.id) },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: {
          itemsTotalInr: toInr(acceptedTotalPaise),
          grandTotalInr: toInr(newGrandTotalPaise),
        },
      });
    });

    if (droppedAmountPaise > 0) {
      await this.refundIfPaid(order, toInr(droppedAmountPaise), 'Items unavailable (partial acceptance)');
    }
    this.notify(order, 'ACCEPTED', droppedNote);
    return this.loadOrder(orderId);
  }

  async shopPack(shopId: string, staffId: string, orderId: string) {
    const order = await this.loadOrder(orderId);
    if (order.shopId !== shopId) throw new NotFoundException('Order not found');
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, 'PACKED', { type: 'SHOP', id: staffId });
    });
    this.notify(order, 'PACKED');
    return this.loadOrder(orderId);
  }

  // ── Admin actions ─────────────────────────────────────────────────────

  /** PACKED → RIDER_ASSIGNED, or re-assign a different rider while still RIDER_ASSIGNED. */
  async adminAssignRider(adminId: string, orderId: string, riderId: string) {
    const order = await this.loadOrder(orderId);
    const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider || !rider.isActive) throw new BadRequestException('Rider not found or inactive');
    if (!rider.isOnDuty) {
      throw new BadRequestException(`${rider.name} is off duty — they must go on duty before a task can be assigned`);
    }
    const actor: Actor = { type: 'ADMIN', id: adminId };

    if (order.state === 'RIDER_ASSIGNED') {
      // Reassignment — no state change, but it goes in the audit trail.
      await this.prisma.$transaction([
        this.prisma.deliveryAssignment.update({
          where: { orderId },
          data: { riderId, status: 'OFFERED', offeredAt: new Date(), acceptedAt: null },
        }),
        this.prisma.orderStatusHistory.create({
          data: {
            orderId,
            fromState: 'RIDER_ASSIGNED',
            toState: 'RIDER_ASSIGNED',
            actorType: 'ADMIN',
            actorId: adminId,
            note: `Reassigned to rider ${rider.name}`,
          },
        }),
      ]);
    } else {
      await this.prisma.$transaction(async (tx) => {
        await this.transition(tx, order, 'RIDER_ASSIGNED', actor, `Assigned to rider ${rider.name}`);
        await tx.deliveryAssignment.upsert({
          where: { orderId },
          update: { riderId, status: 'OFFERED', offeredAt: new Date(), acceptedAt: null },
          create: { orderId, riderId, status: 'OFFERED' },
        });
      });
      this.notify(order, 'RIDER_ASSIGNED');
    }

    const codDue = order.paymentState === 'COD_DUE';
    void this.notifications.notifyRider(
      riderId,
      'New delivery task',
      `Order ${order.code}${codDue ? ` — collect ₹${order.grandTotalInr} (COD)` : ''}. Open the app for pickup details.`,
      { orderId },
    );
    return this.loadOrder(orderId);
  }

  /**
   * Ops manual override ("control everything from admin" is the launch safety
   * net). Still obeys the transition map; side effects (refunds, COD ledger)
   * are applied exactly as if the normal actor had done it.
   */
  async adminTransition(adminId: string, orderId: string, to: OrderState, note: string) {
    if (to === 'RIDER_ASSIGNED') {
      throw new BadRequestException('Use the assign-rider endpoint so a rider is attached');
    }
    const order = await this.loadOrder(orderId);
    const actor: Actor = { type: 'ADMIN', id: adminId };

    if (to === 'DELIVERED') {
      await this.completeDelivery(order, actor, `Ops override: ${note}`);
      this.notify(order, 'DELIVERED');
      return this.loadOrder(orderId);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, to, actor, note);
      if (to === 'PICKED_UP' && order.assignment) {
        await tx.deliveryAssignment.update({
          where: { orderId },
          data: { status: 'PICKED_UP', pickedUpAt: new Date() },
        });
      }
      if ((to === 'CANCELLED' || to === 'UNDELIVERED' || to === 'RX_REJECTED') && order.assignment) {
        await tx.deliveryAssignment.update({ where: { orderId }, data: { status: 'CANCELLED' } });
      }
    });

    if (to === 'CANCELLED' || to === 'UNDELIVERED' || to === 'RX_REJECTED') {
      await this.refundIfPaid(order, Number(order.grandTotalInr), `Ops: ${note}`);
    }
    this.notify(order, to, note);
    return this.loadOrder(orderId);
  }

  // ── Rider actions ─────────────────────────────────────────────────────

  private async loadRiderOrder(riderId: string, orderId: string) {
    const order = await this.loadOrder(orderId);
    if (!order.assignment || order.assignment.riderId !== riderId) {
      throw new ForbiddenException('This order is not assigned to you');
    }
    return order;
  }

  /**
   * Rider accepts an offered task. The atomic guard on status='OFFERED' makes
   * this first-accept-wins if the same order was ever broadcast to several
   * riders — a losing accept gets a clean 409 instead of stealing the task.
   * The order stays RIDER_ASSIGNED; only the assignment is stamped ACCEPTED.
   */
  async riderAccept(riderId: string, orderId: string) {
    const order = await this.loadRiderOrder(riderId, orderId);
    // Off-duty riders can finish tasks they've already taken, but can't pick up new ones.
    const rider = await this.prisma.rider.findUnique({
      where: { id: riderId },
      select: { isOnDuty: true },
    });
    if (!rider?.isOnDuty) {
      throw new ForbiddenException('You are off duty — go on duty to accept new tasks');
    }
    if (order.state !== 'RIDER_ASSIGNED') {
      throw new ConflictException('This task can no longer be accepted');
    }
    const result = await this.prisma.deliveryAssignment.updateMany({
      where: { orderId, riderId, status: 'OFFERED' },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    if (result.count === 0) {
      // Already accepted (idempotent no-op) or taken by someone else.
      if (order.assignment?.status === 'ACCEPTED') return this.loadOrder(orderId);
      throw new ConflictException('Task already taken');
    }
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromState: 'RIDER_ASSIGNED',
        toState: 'RIDER_ASSIGNED',
        actorType: 'RIDER',
        actorId: riderId,
        note: 'Rider accepted the task',
      },
    });
    return this.loadOrder(orderId);
  }

  async riderPickup(riderId: string, orderId: string) {
    const order = await this.loadRiderOrder(riderId, orderId);
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, 'PICKED_UP', { type: 'RIDER', id: riderId });
      await tx.deliveryAssignment.update({
        where: { orderId },
        data: { status: 'PICKED_UP', acceptedAt: order.assignment!.acceptedAt ?? new Date(), pickedUpAt: new Date() },
      });
    });
    this.notify(order, 'PICKED_UP');
    return this.loadOrder(orderId);
  }

  async riderOutForDelivery(riderId: string, orderId: string) {
    const order = await this.loadRiderOrder(riderId, orderId);
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, 'OUT_FOR_DELIVERY', { type: 'RIDER', id: riderId });
    });
    this.notify(order, 'OUT_FOR_DELIVERY');
    return this.loadOrder(orderId);
  }

  /**
   * Delivery handoff: the rider must enter the 4-digit OTP from the
   * customer's app. Wrong code = no DELIVERED, no exceptions — this is the
   * "delivered but never received" dispute killer.
   */
  async riderDeliver(riderId: string, orderId: string, otp: string) {
    const order = await this.loadRiderOrder(riderId, orderId);
    this.assertCan(order.state as OrderState, 'DELIVERED');
    if (otp !== order.deliveryOtp) {
      throw new BadRequestException('Invalid delivery code — ask the customer for the code in their app');
    }
    await this.completeDelivery(order, { type: 'RIDER', id: riderId });
    this.notify(order, 'DELIVERED');
    return this.loadOrder(orderId);
  }

  async riderUndelivered(riderId: string, orderId: string, reason: string) {
    const order = await this.loadRiderOrder(riderId, orderId);
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, 'UNDELIVERED', { type: 'RIDER', id: riderId }, reason);
      await tx.deliveryAssignment.update({ where: { orderId }, data: { status: 'CANCELLED' } });
    });
    await this.refundIfPaid(order, Number(order.grandTotalInr), `Undelivered: ${reason}`);
    this.notify(order, 'UNDELIVERED', reason);
    return this.loadOrder(orderId);
  }

  // ── Customer actions ──────────────────────────────────────────────────

  async customerCancel(userId: string, orderId: string, reason?: string) {
    const order = await this.loadOrder(orderId);
    if (order.userId !== userId) throw new NotFoundException('Order not found');
    if (!(CUSTOMER_CANCELLABLE_STATES as readonly string[]).includes(order.state)) {
      throw new ConflictException('This order can no longer be cancelled — contact support');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, 'CANCELLED', { type: 'CUSTOMER', id: userId }, reason ?? 'Cancelled by customer');
    });
    await this.refundIfPaid(order, Number(order.grandTotalInr), 'Order cancelled by customer');
    this.notify(order, 'CANCELLED', order.paymentState === 'PAID' ? 'Your refund is on its way.' : undefined);
    return this.loadOrder(orderId);
  }

  // ── Prescription outcome (called by the prescriptions module) ─────────

  async rejectRx(actor: Actor, orderId: string, reason: string) {
    const order = await this.loadOrder(orderId);
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, 'RX_REJECTED', actor, reason);
    });
    await this.refundIfPaid(order, Number(order.grandTotalInr), `Prescription rejected: ${reason}`);
    this.notify(order, 'RX_REJECTED', reason);
  }

  // ── Shared side effects ───────────────────────────────────────────────

  /** DELIVERED effects: assignment bookkeeping + COD collection into the rider cash ledger. */
  private async completeDelivery(
    order: Awaited<ReturnType<OrderActionsService['loadOrder']>>,
    actor: Actor,
    note?: string,
  ) {
    const collectingCod = order.paymentState === 'COD_DUE';
    await this.prisma.$transaction(async (tx) => {
      await this.transition(tx, order, 'DELIVERED', actor, note);
      if (order.assignment) {
        await tx.deliveryAssignment.update({
          where: { orderId: order.id },
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
            ...(collectingCod ? { codCollectedInr: order.grandTotalInr } : {}),
          },
        });
      }
      if (collectingCod) {
        await tx.order.update({ where: { id: order.id }, data: { paymentState: 'COD_COLLECTED' } });
        await tx.payment.updateMany({
          where: { orderId: order.id, method: 'COD' },
          data: { status: 'cod_collected' },
        });
        const riderId = actor.type === 'RIDER' ? actor.id : order.assignment?.riderId;
        if (riderId) {
          // Cash-in-hand ledger — reconciled daily in admin (M2).
          await tx.rider.update({
            where: { id: riderId },
            data: { cashInHandInr: { increment: order.grandTotalInr } },
          });
        }
      }
    });
  }

  /** Refund helper: only prepaid (PAID / partially refunded) orders have anything to refund. */
  private async refundIfPaid(order: { id: string; paymentState: string }, amountInr: number, reason: string) {
    if (order.paymentState === 'PAID' || order.paymentState === 'PARTIALLY_REFUNDED') {
      await this.payments.refundOrderAmount(order.id, amountInr, reason);
    }
  }
}
