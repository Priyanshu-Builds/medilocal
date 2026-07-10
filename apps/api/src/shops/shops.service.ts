import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRiderDto,
  CreateShopDto,
  CreateShopStaffDto,
  UpdateInventoryDto,
  UpdateShopDto,
  UpsertInventoryDto,
} from './dto';

const PUBLIC_SHOP_SELECT = {
  id: true,
  name: true,
  addressLine: true,
  lat: true,
  lng: true,
  openTime: true,
  closeTime: true,
  zoneId: true,
} satisfies Prisma.ShopSelect;

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public ────────────────────────────────────────────────────────────

  listPublic(zoneId?: string) {
    return this.prisma.shop.findMany({
      where: { status: 'ACTIVE', ...(zoneId ? { zoneId } : {}) },
      select: PUBLIC_SHOP_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async getPublic(id: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { id, status: 'ACTIVE' },
      select: PUBLIC_SHOP_SELECT,
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  // ── Shop staff: own inventory ─────────────────────────────────────────

  listInventory(shopId: string, q?: string) {
    const query = q?.trim();
    return this.prisma.shopInventory.findMany({
      where: {
        shopId,
        ...(query
          ? { medicine: { name: { contains: query, mode: 'insensitive' } } }
          : {}),
      },
      include: { medicine: true },
      orderBy: { medicine: { name: 'asc' } },
    });
  }

  async upsertInventory(shopId: string, dto: UpsertInventoryDto) {
    const medicine = await this.prisma.medicine.findUnique({ where: { id: dto.medicineId } });
    if (!medicine || !medicine.isActive) throw new NotFoundException('Medicine not found');
    this.assertPriceWithinMrp(dto.priceInr, medicine.mrpInr);

    return this.prisma.shopInventory.upsert({
      where: { shopId_medicineId: { shopId, medicineId: dto.medicineId } },
      update: { priceInr: dto.priceInr, inStock: dto.inStock ?? true },
      create: {
        shopId,
        medicineId: dto.medicineId,
        priceInr: dto.priceInr,
        inStock: dto.inStock ?? true,
      },
      include: { medicine: true },
    });
  }

  async updateInventory(shopId: string, medicineId: string, dto: UpdateInventoryDto) {
    const row = await this.prisma.shopInventory.findUnique({
      where: { shopId_medicineId: { shopId, medicineId } },
      include: { medicine: true },
    });
    if (!row) throw new NotFoundException('This medicine is not in the shop inventory');
    if (dto.priceInr !== undefined) this.assertPriceWithinMrp(dto.priceInr, row.medicine.mrpInr);

    return this.prisma.shopInventory.update({
      where: { shopId_medicineId: { shopId, medicineId } },
      data: { priceInr: dto.priceInr, inStock: dto.inStock },
      include: { medicine: true },
    });
  }

  // ── Admin ─────────────────────────────────────────────────────────────

  adminList() {
    return this.prisma.shop.findMany({
      include: {
        zone: { select: { id: true, name: true } },
        _count: { select: { inventory: true, staff: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminCreate(dto: CreateShopDto) {
    const zone = await this.prisma.zone.findUnique({ where: { id: dto.zoneId } });
    if (!zone || zone.cityId !== dto.cityId) {
      throw new BadRequestException('Zone does not exist in the given city');
    }
    return this.prisma.shop.create({ data: { ...dto } });
  }

  async adminUpdate(id: string, dto: UpdateShopDto) {
    const shop = await this.prisma.shop.findUnique({ where: { id } });
    if (!shop) throw new NotFoundException('Shop not found');
    return this.prisma.shop.update({ where: { id }, data: { ...dto } });
  }

  async adminCreateStaff(shopId: string, dto: CreateShopStaffDto) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');
    const existing = await this.prisma.shopStaff.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A staff login with this email already exists');

    const staff = await this.prisma.shopStaff.create({
      data: {
        shopId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash: bcrypt.hashSync(dto.password, 10),
        isPharmacist: dto.isPharmacist ?? false,
        pharmacistRegNo: dto.pharmacistRegNo,
      },
    });
    const { passwordHash: _omit, ...safe } = staff;
    return safe;
  }

  adminListRiders() {
    return this.prisma.rider.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async adminCreateRider(dto: CreateRiderDto) {
    const existing = await this.prisma.rider.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('A rider with this phone already exists');
    return this.prisma.rider.create({ data: { ...dto } });
  }

  private assertPriceWithinMrp(priceInr: number, mrpInr: Prisma.Decimal) {
    if (new Prisma.Decimal(priceInr).greaterThan(mrpInr)) {
      throw new BadRequestException(`Price ₹${priceInr} exceeds MRP ₹${mrpInr.toString()}`);
    }
  }
}
