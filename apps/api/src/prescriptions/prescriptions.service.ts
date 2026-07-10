import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OrderActionsService } from '../orders/order-actions.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../storage/s3.service';
import type { JwtPayload } from '../common/jwt-payload';
import type { RxStatus } from '@medilocal/shared';

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly orderActions: OrderActionsService,
  ) {}

  /**
   * Customer uploads the Rx image straight to the private bucket via a
   * presigned PUT, then passes the fileKey into order creation. Keys are
   * namespaced per user; nothing about them is guessable.
   */
  async createUploadUrl(userId: string, contentType: string) {
    const ext = EXT_BY_TYPE[contentType];
    if (!ext) throw new BadRequestException('Unsupported file type');
    const fileKey = `rx/${userId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.s3.presignUpload(fileKey, contentType, 300);
    return { fileKey, uploadUrl, expiresInSec: 300, method: 'PUT', contentType };
  }

  /** Time-limited view link for the verifying pharmacist (admin or the order's shop). */
  async createViewUrl(requester: JwtPayload, prescriptionId: string) {
    const rx = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { order: { select: { shopId: true, userId: true } } },
    });
    if (!rx) throw new NotFoundException('Prescription not found');

    const allowed =
      requester.kind === 'admin' ||
      (requester.kind === 'shop' && requester.shopId === rx.order.shopId) ||
      (requester.kind === 'customer' && requester.sub === rx.order.userId);
    if (!allowed) throw new ForbiddenException();

    const url = await this.s3.presignView(rx.fileKey, 300);
    return { url, expiresInSec: 300 };
  }

  /** Pharmacist work queue (admin side). */
  adminQueue(status: RxStatus = 'PENDING') {
    return this.prisma.prescription.findMany({
      where: { status },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            state: true,
            placedAt: true,
            user: { select: { name: true, phone: true } },
            shop: { select: { id: true, name: true } },
            items: { select: { nameSnapshot: true, qty: true, medicineId: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Admin-side verification (PHARMACIST role enforced at the controller). */
  async adminVerify(adminId: string, prescriptionId: string, approve: boolean, rejectionReason?: string) {
    return this.verify({ type: 'ADMIN', id: adminId }, prescriptionId, approve, rejectionReason);
  }

  /** Shop-side verification: only registered pharmacists of the order's own shop. */
  async shopVerify(staffId: string, shopId: string, prescriptionId: string, approve: boolean, rejectionReason?: string) {
    const staff = await this.prisma.shopStaff.findUnique({ where: { id: staffId } });
    if (!staff || !staff.isPharmacist) {
      throw new ForbiddenException('Only a registered pharmacist can verify prescriptions');
    }
    const rx = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { order: { select: { shopId: true } } },
    });
    if (!rx || rx.order.shopId !== shopId) throw new NotFoundException('Prescription not found');
    return this.verify({ type: 'SHOP', id: staffId }, prescriptionId, approve, rejectionReason);
  }

  private async verify(
    actor: { type: 'ADMIN' | 'SHOP'; id: string },
    prescriptionId: string,
    approve: boolean,
    rejectionReason?: string,
  ) {
    const rx = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { order: true },
    });
    if (!rx) throw new NotFoundException('Prescription not found');
    if (rx.status !== 'PENDING') {
      throw new ConflictException(`Prescription already ${rx.status.toLowerCase()}`);
    }
    if (rx.order.state !== 'RX_REVIEW') {
      throw new ConflictException('Order is not awaiting prescription review');
    }
    if (!approve && !rejectionReason) {
      throw new BadRequestException('rejectionReason is required when rejecting');
    }

    await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        verifiedById: actor.id,
        verifiedAt: new Date(),
        rejectionReason: approve ? null : rejectionReason,
      },
    });

    if (!approve) {
      // One rejected Rx sinks the order — the pharmacist saw something wrong.
      await this.orderActions.rejectRx({ type: actor.type, id: actor.id }, rx.orderId, rejectionReason!);
      return { prescriptionId, status: 'REJECTED' as const, orderState: 'RX_REJECTED' as const };
    }

    const pending = await this.prisma.prescription.count({
      where: { orderId: rx.orderId, status: 'PENDING' },
    });
    return {
      prescriptionId,
      status: 'APPROVED' as const,
      // Order stays in RX_REVIEW; the shop's accept flips it to ACCEPTED once all Rx are approved.
      remainingPending: pending,
      readyForShopAccept: pending === 0,
    };
  }
}
