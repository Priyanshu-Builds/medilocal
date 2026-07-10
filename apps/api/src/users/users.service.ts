import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
