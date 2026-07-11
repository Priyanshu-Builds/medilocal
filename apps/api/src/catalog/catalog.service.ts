import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto';
import { parseCsv } from './csv';
import { normalizeMedicineRow, type RowError } from './medicine-import';

export interface ImportResult {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: RowError[];
}

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

  // ── Admin master-catalog management ───────────────────────────────────

  /** Admin list: includes inactive medicines and Schedule X (visible, just unsellable). */
  adminList(q?: string) {
    const query = q?.trim();
    return this.prisma.medicine.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { brand: { contains: query, mode: 'insensitive' } },
              { genericName: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async createMedicine(dto: CreateMedicineDto) {
    const schedule = dto.schedule ?? 'NONE';
    const rxRequired = schedule === 'H' || schedule === 'H1' ? true : (dto.rxRequired ?? false);
    return this.prisma.medicine.create({
      data: {
        name: dto.name,
        brand: dto.brand,
        genericName: dto.genericName,
        manufacturer: dto.manufacturer,
        mrpInr: dto.mrpInr,
        packSize: dto.packSize,
        schedule,
        rxRequired,
        imageUrl: dto.imageUrl,
      },
    });
  }

  async updateMedicine(id: string, dto: UpdateMedicineDto) {
    const existing = await this.prisma.medicine.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Medicine not found');
    // Keep the H/H1 → rxRequired invariant when the schedule changes.
    const schedule = dto.schedule ?? existing.schedule;
    const rxRequired =
      schedule === 'H' || schedule === 'H1' ? true : (dto.rxRequired ?? existing.rxRequired);
    return this.prisma.medicine.update({
      where: { id },
      data: { ...dto, schedule, rxRequired },
    });
  }

  /**
   * Bulk upsert from CSV, matched case-insensitively by name. Each row is
   * validated independently; a bad row is reported and skipped, never aborting
   * the batch (small-town data entry will always have a few typos).
   */
  async importCsv(csv: string): Promise<ImportResult> {
    const records = parseCsv(csv);
    if (records.length === 0) {
      throw new BadRequestException('CSV had no data rows (is the header present?)');
    }
    if (!('name' in records[0]) || !('mrpInr' in records[0])) {
      throw new BadRequestException('CSV header must include at least "name" and "mrpInr" columns');
    }

    const result: ImportResult = {
      totalRows: records.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < records.length; i++) {
      const parsed = normalizeMedicineRow(records[i], i + 1);
      if (!parsed.ok) {
        result.failed++;
        result.errors.push(parsed.error);
        continue;
      }
      const m = parsed.value;
      // Case-insensitive match on name (no unique constraint on it, so find-then-write).
      const existing = await this.prisma.medicine.findFirst({
        where: { name: { equals: m.name, mode: 'insensitive' } },
      });
      if (existing) {
        await this.prisma.medicine.update({ where: { id: existing.id }, data: m });
        result.updated++;
      } else {
        await this.prisma.medicine.create({ data: m });
        result.created++;
      }
    }
    return result;
  }
}
