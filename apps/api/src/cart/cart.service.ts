import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Quote, QuoteItemInput, SellableRow, computeQuote } from './pricing';

export interface ShopQuote {
  zone: { id: string; name: string };
  /** null when no active shop in the zone stocks any requested item. */
  shop: { id: string; name: string } | null;
  quote: Quote;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Price a cart in a zone. When shopId is omitted, picks the ACTIVE in-zone
   * shop covering the most requested items (tie → cheapest covered total) —
   * small-town reality is one order = one shop, chosen by the platform.
   * Shared by the quote endpoint and order creation so checkout can never
   * drift from the quoted price.
   */
  async buildQuote(zoneId: string, shopId: string | undefined, items: QuoteItemInput[]): Promise<ShopQuote> {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone || !zone.isActive) throw new BadRequestException('Zone is not serviceable');

    const medicineIds = [...new Set(items.map((i) => i.medicineId))];
    if (medicineIds.length !== items.length) {
      throw new BadRequestException('Duplicate medicineId in items — merge quantities first');
    }

    const zoneConfig = {
      deliveryFeeInr: Number(zone.deliveryFeeInr),
      minOrderInr: Number(zone.minOrderInr),
      codCapInr: Number(zone.codCapInr),
    };

    const shop = shopId
      ? await this.assertShopInZone(shopId, zoneId)
      : await this.pickBestShop(zoneId, medicineIds);

    if (!shop) {
      return {
        zone: { id: zone.id, name: zone.name },
        shop: null,
        quote: computeQuote(items, new Map(), zoneConfig),
      };
    }

    const rows = await this.prisma.shopInventory.findMany({
      where: { shopId: shop.id, medicineId: { in: medicineIds } },
      include: { medicine: true },
    });
    const byMedicine = new Map<string, SellableRow>(
      rows
        .filter((r) => r.medicine.isActive)
        .map((r) => [
          r.medicineId,
          {
            medicineId: r.medicineId,
            name: r.medicine.name,
            priceInr: Number(r.priceInr),
            inStock: r.inStock,
            rxRequired: r.medicine.rxRequired,
            schedule: r.medicine.schedule,
          },
        ]),
    );

    return {
      zone: { id: zone.id, name: zone.name },
      shop: { id: shop.id, name: shop.name },
      quote: computeQuote(items, byMedicine, zoneConfig),
    };
  }

  private async assertShopInZone(shopId: string, zoneId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop || shop.status !== 'ACTIVE') throw new NotFoundException('Shop not found');
    if (shop.zoneId !== zoneId) throw new BadRequestException('Shop does not deliver in this zone');
    return { id: shop.id, name: shop.name };
  }

  private async pickBestShop(zoneId: string, medicineIds: string[]) {
    const rows = await this.prisma.shopInventory.findMany({
      where: {
        medicineId: { in: medicineIds },
        inStock: true,
        medicine: { isActive: true, schedule: { not: 'X' } },
        shop: { status: 'ACTIVE', zoneId },
      },
      select: { shopId: true, priceInr: true, shop: { select: { id: true, name: true } } },
    });
    if (rows.length === 0) return null;

    const byShop = new Map<string, { shop: { id: string; name: string }; count: number; totalPaise: number }>();
    for (const row of rows) {
      const entry = byShop.get(row.shopId) ?? { shop: row.shop, count: 0, totalPaise: 0 };
      entry.count += 1;
      entry.totalPaise += Math.round(Number(row.priceInr) * 100);
      byShop.set(row.shopId, entry);
    }
    const best = [...byShop.values()].sort(
      (a, b) => b.count - a.count || a.totalPaise - b.totalPaise,
    )[0];
    return best.shop;
  }
}
