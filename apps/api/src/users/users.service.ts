import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TERMINAL_ORDER_STATES } from '@medilocal/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto, UpdateMeDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        createdAt: true,
        addresses: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  updateMe(userId: string, dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, email: dto.email },
      select: { id: true, phone: true, name: true, email: true },
    });
  }

  /**
   * Right-to-erasure (DPDP Act) account deletion. Orders are financial/tax
   * records we must retain, so we don't hard-delete the row — we scrub every
   * piece of personal data instead:
   *   - saved addresses are deleted outright (live PII, no retention need),
   *   - each order's frozen addressSnapshot is redacted (the order keeps its
   *     own zoneId column for reporting, so no analytics value is lost),
   *   - the user row is anonymised: identity fields nulled, phone replaced with
   *     a unique tombstone, and the account blocked so it can never log in again.
   * Blocked while any order is still in flight — those need a real address to
   * be delivered; the customer must let them finish or cancel them first.
   */
  async deleteMe(userId: string) {
    const activeOrders = await this.prisma.order.count({
      where: { userId, state: { notIn: [...TERMINAL_ORDER_STATES] } },
    });
    if (activeOrders > 0) {
      throw new BadRequestException(
        `You have ${activeOrders} order(s) still in progress. Wait for them to be delivered or cancel them before deleting your account.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.address.deleteMany({ where: { userId } }),
      this.prisma.order.updateMany({
        where: { userId },
        data: { addressSnapshot: { redacted: true } },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          name: null,
          email: null,
          firebaseUid: null,
          fcmToken: null,
          phone: `deleted:${userId}`, // keep the @unique constraint satisfied
          isBlocked: true,
        },
      }),
    ]);

    return { ok: true, deletedAt: new Date().toISOString() };
  }

  /** Customer and rider tokens both land here; each kind has its own row/table. */
  async saveFcmToken(kind: 'customer' | 'rider', id: string, token: string) {
    if (kind === 'rider') {
      await this.prisma.rider.update({ where: { id }, data: { fcmToken: token } });
    } else {
      await this.prisma.user.update({ where: { id }, data: { fcmToken: token } });
    }
    return { ok: true };
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    await this.assertActiveZone(dto.zoneId);
    return this.prisma.address.create({
      data: {
        userId,
        zoneId: dto.zoneId,
        label: dto.label ?? 'Home',
        line1: dto.line1,
        line2: dto.line2,
        landmark: dto.landmark,
        pincode: dto.pincode,
        lat: dto.lat,
        lng: dto.lng,
      },
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.assertOwnAddress(userId, addressId);
    if (dto.zoneId) await this.assertActiveZone(dto.zoneId);
    return this.prisma.address.update({ where: { id: addressId }, data: { ...dto } });
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.assertOwnAddress(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
    return { ok: true };
  }

  private async assertOwnAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== userId) throw new NotFoundException('Address not found');
  }

  private async assertActiveZone(zoneId: string) {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone || !zone.isActive) {
      throw new BadRequestException('Zone does not exist or is not serviceable');
    }
  }
}
