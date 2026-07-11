import { DRUG_SCHEDULES, type DrugSchedule } from '@medilocal/shared';

/** A validated row ready to upsert into the master catalog. */
export interface NormalizedMedicine {
  name: string;
  brand: string | null;
  genericName: string | null;
  manufacturer: string | null;
  mrpInr: number;
  packSize: string | null;
  schedule: DrugSchedule;
  rxRequired: boolean;
}

export interface RowError {
  row: number; // 1-based data row (excludes header)
  message: string;
}

const TRUE_SET = new Set(['true', '1', 'yes', 'y']);
const FALSE_SET = new Set(['false', '0', 'no', 'n', '']);

/**
 * Validate one parsed CSV record. Compliance rule enforced here: Schedule X is
 * never importable (it can never be sold online). H/H1 imply rxRequired unless
 * the row explicitly says otherwise — and we force it true for H/H1 regardless,
 * since an H1 antibiotic must always demand a prescription.
 */
export function normalizeMedicineRow(
  record: Record<string, string>,
  rowNumber: number,
): { ok: true; value: NormalizedMedicine } | { ok: false; error: RowError } {
  const err = (message: string) => ({ ok: false as const, error: { row: rowNumber, message } });

  const name = (record.name ?? '').trim();
  if (!name) return err('name is required');

  const mrpRaw = (record.mrpInr ?? '').trim();
  const mrpInr = Number(mrpRaw);
  if (!mrpRaw || !Number.isFinite(mrpInr) || mrpInr <= 0) {
    return err(`invalid mrpInr "${mrpRaw}"`);
  }

  const scheduleRaw = (record.schedule ?? 'NONE').trim().toUpperCase() || 'NONE';
  if (!DRUG_SCHEDULES.includes(scheduleRaw as DrugSchedule)) {
    return err(`unknown schedule "${scheduleRaw}" (expected NONE, H, or H1)`);
  }
  if (scheduleRaw === 'X') {
    return err('Schedule X medicines cannot be sold online and cannot be imported');
  }
  const schedule = scheduleRaw as DrugSchedule;

  const rxRaw = (record.rxRequired ?? '').trim().toLowerCase();
  let rxRequired: boolean;
  if (TRUE_SET.has(rxRaw)) rxRequired = true;
  else if (FALSE_SET.has(rxRaw)) rxRequired = false;
  else return err(`invalid rxRequired "${rxRaw}" (expected true/false)`);
  // H/H1 always require a prescription regardless of the sheet.
  if (schedule === 'H' || schedule === 'H1') rxRequired = true;

  const opt = (v: string | undefined) => {
    const t = (v ?? '').trim();
    return t === '' ? null : t;
  };

  return {
    ok: true,
    value: {
      name,
      brand: opt(record.brand),
      genericName: opt(record.genericName),
      manufacturer: opt(record.manufacturer),
      mrpInr,
      packSize: opt(record.packSize),
      schedule,
      rxRequired,
    },
  };
}
