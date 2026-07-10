import { SellableRow, computeQuote } from './pricing';

const ZONE = { deliveryFeeInr: 30, minOrderInr: 99, codCapInr: 1500 };

function inv(rows: Array<Partial<SellableRow> & { medicineId: string }>): Map<string, SellableRow> {
  return new Map(
    rows.map((r) => [
      r.medicineId,
      {
        name: r.name ?? r.medicineId,
        priceInr: r.priceInr ?? 100,
        inStock: r.inStock ?? true,
        rxRequired: r.rxRequired ?? false,
        schedule: r.schedule ?? 'NONE',
        ...r,
      } as SellableRow,
    ]),
  );
}

describe('computeQuote', () => {
  it('prices lines, delivery fee and grand total with clean paise math', () => {
    const q = computeQuote(
      [
        { medicineId: 'dolo', qty: 3 },
        { medicineId: 'ors', qty: 2 },
      ],
      inv([
        { medicineId: 'dolo', priceInr: 33.6 },
        { medicineId: 'ors', priceInr: 22 },
      ]),
      ZONE,
    );
    expect(q.items).toHaveLength(2);
    expect(q.items[0].lineTotalInr).toBe(100.8); // 33.6 × 3 — no float dust
    expect(q.itemsTotalInr).toBe(144.8);
    expect(q.deliveryFeeInr).toBe(30);
    expect(q.grandTotalInr).toBe(174.8);
    expect(q.unavailable).toHaveLength(0);
    expect(q.requiresRx).toBe(false);
  });

  it('flags unavailable items with the right reason', () => {
    const q = computeQuote(
      [
        { medicineId: 'in-stock', qty: 1 },
        { medicineId: 'gone', qty: 1 },
        { medicineId: 'unknown', qty: 1 },
        { medicineId: 'sleeping-pill', qty: 1 },
      ],
      inv([
        { medicineId: 'in-stock' },
        { medicineId: 'gone', inStock: false },
        { medicineId: 'sleeping-pill', schedule: 'X' },
      ]),
      ZONE,
    );
    expect(q.items).toHaveLength(1);
    expect(q.unavailable).toEqual(
      expect.arrayContaining([
        { medicineId: 'gone', reason: 'OUT_OF_STOCK' },
        { medicineId: 'unknown', reason: 'NOT_STOCKED' },
        { medicineId: 'sleeping-pill', reason: 'SCHEDULE_X' },
      ]),
    );
  });

  it('schedule X is blocked even when marked in stock (compliance hard rule)', () => {
    const q = computeQuote(
      [{ medicineId: 'x1', qty: 1 }],
      inv([{ medicineId: 'x1', schedule: 'X', inStock: true }]),
      ZONE,
    );
    expect(q.items).toHaveLength(0);
    expect(q.unavailable[0].reason).toBe('SCHEDULE_X');
  });

  it('min-order compares item total (delivery fee excluded), boundary inclusive', () => {
    const at = computeQuote([{ medicineId: 'm', qty: 1 }], inv([{ medicineId: 'm', priceInr: 99 }]), ZONE);
    expect(at.meetsMinOrder).toBe(true);
    const below = computeQuote([{ medicineId: 'm', qty: 1 }], inv([{ medicineId: 'm', priceInr: 98.99 }]), ZONE);
    expect(below.meetsMinOrder).toBe(false);
  });

  it('COD allowed up to the cap inclusive, on the grand total', () => {
    // 1470 items + 30 fee = 1500 → exactly at cap
    const atCap = computeQuote([{ medicineId: 'm', qty: 1 }], inv([{ medicineId: 'm', priceInr: 1470 }]), ZONE);
    expect(atCap.codAllowed).toBe(true);
    const over = computeQuote([{ medicineId: 'm', qty: 1 }], inv([{ medicineId: 'm', priceInr: 1470.01 }]), ZONE);
    expect(over.codAllowed).toBe(false);
  });

  it('any Rx-required line marks the whole order as requiring prescription review', () => {
    const q = computeQuote(
      [
        { medicineId: 'otc', qty: 1 },
        { medicineId: 'antibiotic', qty: 1 },
      ],
      inv([
        { medicineId: 'otc', priceInr: 50 },
        { medicineId: 'antibiotic', priceInr: 132, rxRequired: true, schedule: 'H1' },
      ]),
      ZONE,
    );
    expect(q.requiresRx).toBe(true);
    expect(q.items.find((l) => l.medicineId === 'antibiotic')!.rxRequired).toBe(true);
  });
});
