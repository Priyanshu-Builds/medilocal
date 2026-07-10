import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fuzzy search via pg_trgm: customers routinely misspell brand names
   * ("dollo" → Dolo 650, "crosin" → Crocin), so trigram similarity is
   * combined with plain substring matching.
   *
   * With zoneId the results are restricted to medicines actually in stock at
   * an ACTIVE shop in that zone, and each row carries the cheapest in-zone
   * price + how many shops stock it. Schedule X never appears to customers.
   */
  async searchMedicines(q?: string, zoneId?: string) {
    const query = q?.trim();

    // Availability join: only medicines stocked in the zone survive the JOIN.
    const availabilitySelect = zoneId
      ? Prisma.sql`, av."minPriceInr", av."shopCount"`
      : Prisma.sql``;
    const availabilityJoin = zoneId
      ? Prisma.sql`
        JOIN (
          SELECT si."medicineId",
                 MIN(si."priceInr")             AS "minPriceInr",
                 COUNT(DISTINCT si."shopId")::int AS "shopCount"
          FROM "ShopInventory" si
          JOIN "Shop" s ON s.id = si."shopId"
          WHERE si."inStock" = true AND s.status = 'ACTIVE' AND s."zoneId" = ${zoneId}
          GROUP BY si."medicineId"
        ) av ON av."medicineId" = m.id`
      : Prisma.sql``;

    if (!query || query.length < 2) {
      return this.prisma.$queryRaw`
        SELECT m.id, m.name, m.brand, m."genericName", m.manufacturer,
               m."mrpInr", m."packSize", m.schedule, m."rxRequired", m."imageUrl"
               ${availabilitySelect}
        FROM "Medicine" m
        ${availabilityJoin}
        WHERE m."isActive" = true AND m.schedule <> 'X'
        ORDER BY m.name ASC
        LIMIT 50
      `;
    }

    // word_similarity (not plain similarity): scores the query against the
    // best-matching word in the name, so "crosin" still hits "Crocin Advance".
    return this.prisma.$queryRaw`
      SELECT m.id, m.name, m.brand, m."genericName", m.manufacturer,
             m."mrpInr", m."packSize", m.schedule, m."rxRequired", m."imageUrl",
             GREATEST(
               word_similarity(${query}, m.name),
               word_similarity(${query}, coalesce(m."genericName", ''))
             ) AS score
             ${availabilitySelect}
      FROM "Medicine" m
      ${availabilityJoin}
      WHERE m."isActive" = true AND m.schedule <> 'X'
        AND (
          m.name ILIKE '%' || ${query} || '%'
          OR m."genericName" ILIKE '%' || ${query} || '%'
          OR word_similarity(${query}, m.name) > 0.3
          OR word_similarity(${query}, coalesce(m."genericName", '')) > 0.3
        )
      ORDER BY score DESC, m.name ASC
      LIMIT 20
    `;
  }

  /** Medicine detail; with zoneId also lists the in-zone shops stocking it. */
  async getMedicine(id: string, zoneId?: string) {
    const medicine = await this.prisma.medicine.findFirst({
      where: { id, isActive: true, schedule: { not: 'X' } },
    });
    if (!medicine) throw new NotFoundException('Medicine not found');

    if (!zoneId) return medicine;

    const availability = await this.prisma.shopInventory.findMany({
      where: {
        medicineId: id,
        inStock: true,
        shop: { status: 'ACTIVE', zoneId },
      },
      select: {
        priceInr: true,
        shop: { select: { id: true, name: true, openTime: true, closeTime: true } },
      },
      orderBy: { priceInr: 'asc' },
    });
    return { ...medicine, availability };
  }
}
