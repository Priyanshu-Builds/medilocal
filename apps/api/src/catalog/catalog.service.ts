import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fuzzy search via pg_trgm: customers routinely misspell brand names
   * ("dollo" → Dolo 650, "crosin" → Crocin), so trigram similarity is
   * combined with plain substring matching.
   */
  async searchMedicines(q?: string) {
    const query = q?.trim();
    if (!query || query.length < 2) {
      return this.prisma.medicine.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        take: 50,
      });
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
      FROM "Medicine" m
      WHERE m."isActive" = true
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
}
