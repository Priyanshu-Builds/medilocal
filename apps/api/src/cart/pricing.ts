import { toInr, toPaise } from '../common/money';

/** Inputs are plain numbers/strings so this stays a pure, unit-testable function. */
export interface QuoteItemInput {
  medicineId: string;
  qty: number;
}

export interface SellableRow {
  medicineId: string;
  name: string;
  priceInr: number;
  inStock: boolean;
  rxRequired: boolean;
  schedule: string; // NONE | H | H1 | X
}

export interface ZonePricingConfig {
  deliveryFeeInr: number;
  minOrderInr: number;
  codCapInr: number;
}

export type UnavailableReason = 'NOT_STOCKED' | 'OUT_OF_STOCK' | 'SCHEDULE_X';

export interface QuoteLine {
  medicineId: string;
  name: string;
  qty: number;
  unitPriceInr: number;
  lineTotalInr: number;
  rxRequired: boolean;
  schedule: string;
}

export interface Quote {
  items: QuoteLine[];
  unavailable: Array<{ medicineId: string; reason: UnavailableReason }>;
  itemsTotalInr: number;
  deliveryFeeInr: number;
  grandTotalInr: number;
  minOrderInr: number;
  meetsMinOrder: boolean;
  codCapInr: number;
  /** COD is refused above the zone's cap (cash-leakage guard). */
  codAllowed: boolean;
  /** True when any line needs a prescription → order will pass through RX_REVIEW. */
  requiresRx: boolean;
}

/**
 * Prices a cart against one shop's inventory. Schedule X is never sellable
 * online regardless of what the inventory claims (compliance hard rule).
 */
export function computeQuote(
  items: QuoteItemInput[],
  inventoryByMedicineId: ReadonlyMap<string, SellableRow>,
  zone: ZonePricingConfig,
): Quote {
  const lines: QuoteLine[] = [];
  const unavailable: Quote['unavailable'] = [];

  for (const item of items) {
    const row = inventoryByMedicineId.get(item.medicineId);
    if (!row) {
      unavailable.push({ medicineId: item.medicineId, reason: 'NOT_STOCKED' });
      continue;
    }
    if (row.schedule === 'X') {
      unavailable.push({ medicineId: item.medicineId, reason: 'SCHEDULE_X' });
      continue;
    }
    if (!row.inStock) {
      unavailable.push({ medicineId: item.medicineId, reason: 'OUT_OF_STOCK' });
      continue;
    }
    const unitPaise = toPaise(row.priceInr);
    lines.push({
      medicineId: row.medicineId,
      name: row.name,
      qty: item.qty,
      unitPriceInr: toInr(unitPaise),
      lineTotalInr: toInr(unitPaise * item.qty),
      rxRequired: row.rxRequired,
      schedule: row.schedule,
    });
  }

  const itemsTotalPaise = lines.reduce((sum, l) => sum + toPaise(l.lineTotalInr), 0);
  const deliveryFeePaise = toPaise(zone.deliveryFeeInr);
  const grandTotalPaise = itemsTotalPaise + deliveryFeePaise;

  return {
    items: lines,
    unavailable,
    itemsTotalInr: toInr(itemsTotalPaise),
    deliveryFeeInr: toInr(deliveryFeePaise),
    grandTotalInr: toInr(grandTotalPaise),
    minOrderInr: zone.minOrderInr,
    meetsMinOrder: itemsTotalPaise >= toPaise(zone.minOrderInr),
    codCapInr: zone.codCapInr,
    codAllowed: grandTotalPaise <= toPaise(zone.codCapInr),
    requiresRx: lines.some((l) => l.rxRequired),
  };
}
