import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { toPaise } from '../common/money';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
import { CreateOrderDto } from './dto';
import { formatOrderCode, generateDeliveryOtp, startOfDay } from './order-code';
import type { OrderState } from '@medilocal/shared';

/** Detail payload for the customer app: includes the delivery OTP (theirs to share). */
const CUSTOMER_ORDER_INCLUDE = {
  items: true,
  statusHistory: { orderBy: { createdAt: 'asc' } },
  prescriptions: { select: { id: true, status: true, rejectionReason: true, createdAt: true } },
  payments: { select: { method: true, status: true, amountInr: true, razorpayOrderId: true } },
  assignment: { include: { rider: { select: { name: true, phone: true } } } },
  shop: { select: { id: true, name: true, addressLine: true, phone: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly razorpay: RazorpayService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Checkout. Everything the client sent is re-validated and re-priced
   * server-side; the client's displayed total is never trusted.
   * Razorpay orders start unpaid (paymentState PENDING) and only become
   * visible to the shop once the payment webhook lands.
   */
  async create(userId: string, dto: CreateOrderDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.isBlocked) throw new BadRequestException('Account cannot place orders');

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) throw new NotFoundException('Address not found');
    if (!address.zoneId) {
      throw new BadRequestException('This address is outside our delivery zones');
    }

    const { zone, shop, quote } = await this.cart.buildQuote(address.zoneId, dto.shopId, dto.items);
    if (!shop) {
      throw new BadRequestException('No pharmacy in your zone currently stocks these items');
    }
    if (quote.unavailable.length > 0) {
      throw new BadRequestException({
        message: 'Some items are unavailable — refresh your cart',
        unavailable: quote.unavailable,
      });
    }
    if (!quote.meetsMinOrder) {
      throw new BadRequestException(`Minimum order is ₹${quote.minOrderInr} (excluding delivery fee)`);
    }
    if (dto.paymentMethod === 'COD' && !quote.codAllowed) {
      throw new BadRequestException(`Cash on delivery is limited to ₹${quote.codCapInr}; pay online instead`);
    }
    if (quote.requiresRx && !(dto.rxFileKeys && dto.rxFileKeys.length > 0)) {
      throw new BadRequestException(
        'This order contains prescription medicines — upload a prescription first',
      );
    }
    if (dto.paymentMethod === 'RAZORPAY' && !this.razorpay.enabled) {
      throw new ServiceUnavailableException('Online payments are not configured; use COD');
    }

    const deliveryOtp = generateDeliveryOtp();
    const addressSnapshot = {
      label: address.label,
      line1: address.line1,
      line2: address.line2,
      landmark: address.landmark,
      pincode: address.pincode,
      lat: address.lat,
      lng: address.lng,
      zoneId: address.zoneId,
    };

    // Order-code sequence is racy by nature; retry on the unique constraint.
    let order: { id: string; code: string } | null = null;
    for (let attempt = 0; order === null; attempt++) {
      const code = await this.nextOrderCode(attempt);
      const razorpayOrder =
        dto.paymentMethod === 'RAZORPAY'
          ? await this.razorpay.createOrder(toPaise(quote.grandTotalInr), code, { orderCode: code })
          : null;
      try {
        order = await this.prisma.$transaction(async (tx) => {
          const initialState: OrderState = quote.requiresRx ? 'RX_REVIEW' : 'PLACED';
          const created = await tx.order.create({
            data: {
              code,
              userId,
              shopId: shop.id,
              zoneId: zone.id,
              state: initialState,
              paymentState: dto.paymentMethod === 'COD' ? 'COD_DUE' : 'PENDING',
              paymentMethod: dto.paymentMethod,
              requiresRx: quote.requiresRx,
              deliveryOtp,
              addressSnapshot,
              itemsTotalInr: quote.itemsTotalInr,
              deliveryFeeInr: quote.deliveryFeeInr,
              discountInr: 0,
              grandTotalInr: quote.grandTotalInr,
              items: {
                create: quote.items.map((line) => ({
                  medicineId: line.medicineId,
                  nameSnapshot: line.name,
                  priceInrSnapshot: line.unitPriceInr,
                  qty: line.qty,
                })),
              },
            },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: created.id,
              fromState: null,
              toState: 'PLACED',
              actorType: 'CUSTOMER',
              actorId: userId,
              note: `Order placed (${dto.paymentMethod})`,
            },
          });
          if (quote.requiresRx) {
            await tx.orderStatusHistory.create({
              data: {
                orderId: created.id,
                fromState: 'PLACED',
                toState: 'RX_REVIEW',
                actorType: 'SYSTEM',
                note: 'Contains prescription medicines — pharmacist verification required',
              },
            });
            await tx.prescription.createMany({
              data: (dto.rxFileKeys ?? []).map((fileKey) => ({ orderId: created.id, fileKey })),
            });
          }
          await tx.payment.create({
            data: {
              orderId: created.id,
              method: dto.paymentMethod,
              amountInr: quote.grandTotalInr,
              status: dto.paymentMethod === 'COD' ? 'cod_due' : 'created',
              razorpayOrderId: razorpayOrder ? String(razorpayOrder.id) : null,
            },
          });
          return created;
        });

        void this.notifications.notifyUser(
          userId,
          'Order placed',
          dto.paymentMethod === 'COD'
            ? `Order ${code} placed. Pay ₹${quote.grandTotalInr} on delivery.`
            : `Order ${code} created. Complete the payment to confirm it.`,
          { orderId: order.id },
        );

        return {
          order: await this.getForCustomer(userId, order.id),
          razorpayCheckout: razorpayOrder
            ? {
                keyId: this.razorpay.keyId,
                razorpayOrderId: String(razorpayOrder.id),
                amountPaise: toPaise(quote.grandTotalInr),
                currency: 'INR',
                orderCode: code,
              }
            : null,
        };
      } catch (err) {
        const isCodeCollision =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (!isCodeCollision || attempt >= 3) throw err;
      }
    }
    throw new Error('unreachable');
  }

  private async nextOrderCode(bump: number): Promise<string> {
    const now = new Date();
    const todayCount = await this.prisma.order.count({
      where: { placedAt: { gte: startOfDay(now) } },
    });
    return formatOrderCode(now, todayCount + 1 + bump);
  }

  // ── Customer views ────────────────────────────────────────────────────

  listForCustomer(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        code: true,
        state: true,
        paymentState: true,
        paymentMethod: true,
        grandTotalInr: true,
        placedAt: true,
        shop: { select: { name: true } },
        items: { select: { nameSnapshot: true, qty: true, accepted: true } },
      },
      orderBy: { placedAt: 'desc' },
      take: 50,
    });
  }

  async getForCustomer(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: CUSTOMER_ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ── Shop views (no delivery OTP — the customer hands that to the rider) ─

  async listForShop(shopId: string, state?: OrderState) {
    return this.prisma.order.findMany({
      where: {
        shopId,
        // Unpaid online orders stay invisible until the payment webhook lands.
        paymentState: { not: 'PENDING' },
        ...(state ? { state } : {}),
      },
      omit: { deliveryOtp: true },
      include: {
        items: true,
        user: { select: { name: true, phone: true } },
        prescriptions: { select: { id: true, status: true } },
      },
      orderBy: { placedAt: 'desc' },
      take: 100,
    });
  }

  async getForShop(shopId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, shopId, paymentState: { not: 'PENDING' } },
      omit: { deliveryOtp: true },
      include: {
        items: true,
        user: { select: { name: true, phone: true } },
        prescriptions: { select: { id: true, status: true, rejectionReason: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        assignment: { include: { rider: { select: { name: true, phone: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ── Admin views ───────────────────────────────────────────────────────

  listForAdmin(filters: { state?: OrderState; shopId?: string }) {
    return this.prisma.order.findMany({
      where: {
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.shopId ? { shopId: filters.shopId } : {}),
      },
      include: {
        user: { select: { name: true, phone: true } },
        shop: { select: { name: true } },
        assignment: { include: { rider: { select: { name: true } } } },
      },
      orderBy: { placedAt: 'desc' },
      take: 100,
    });
  }

  async getForAdmin(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        ...CUSTOMER_ORDER_INCLUDE,
        user: { select: { id: true, name: true, phone: true } },
        payments: { include: { refunds: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ── Rider views (no OTP — rider must get it from the customer) ─────────

  listRiderTasks(riderId: string) {
    return this.prisma.deliveryAssignment.findMany({
      where: {
        riderId,
        order: { state: { in: ['RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] } },
      },
      include: {
        order: {
          omit: { deliveryOtp: true },
          include: {
            items: { where: { accepted: { not: false } } },
            shop: { select: { name: true, addressLine: true, phone: true, lat: true, lng: true } },
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { offeredAt: 'desc' },
    });
  }
}
