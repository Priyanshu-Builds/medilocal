import { normalizeMedicineRow } from './medicine-import';

const row = (r: Record<string, string>) => normalizeMedicineRow(r, 1);

describe('normalizeMedicineRow', () => {
  it('accepts a full OTC row', () => {
    const res = row({
      name: 'Dolo 650',
      brand: 'Dolo',
      genericName: 'Paracetamol 650mg',
      manufacturer: 'Micro Labs',
      mrpInr: '33.6',
      packSize: 'Strip of 15 tablets',
      schedule: 'NONE',
      rxRequired: 'false',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.mrpInr).toBe(33.6);
      expect(res.value.rxRequired).toBe(false);
      expect(res.value.schedule).toBe('NONE');
    }
  });

  it('forces rxRequired true for H/H1 even if the sheet says false', () => {
    const res = row({ name: 'Azithral 500', mrpInr: '132', schedule: 'H1', rxRequired: 'false' });
    expect(res.ok && res.value.rxRequired).toBe(true);
  });

  it('rejects Schedule X (never sold online)', () => {
    const res = row({ name: 'Some X drug', mrpInr: '10', schedule: 'X' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/Schedule X/);
  });

  it('rejects missing name', () => {
    const res = row({ name: '', mrpInr: '10' });
    expect(res.ok).toBe(false);
  });

  it('rejects invalid or non-positive MRP', () => {
    expect(row({ name: 'A', mrpInr: 'abc' }).ok).toBe(false);
    expect(row({ name: 'A', mrpInr: '0' }).ok).toBe(false);
    expect(row({ name: 'A', mrpInr: '-5' }).ok).toBe(false);
    expect(row({ name: 'A', mrpInr: '' }).ok).toBe(false);
  });

  it('rejects unknown schedule', () => {
    const res = row({ name: 'A', mrpInr: '10', schedule: 'H2' });
    expect(res.ok).toBe(false);
  });

  it('defaults schedule to NONE and rxRequired to false when blank', () => {
    const res = row({ name: 'Band Aid', mrpInr: '40' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.schedule).toBe('NONE');
      expect(res.value.rxRequired).toBe(false);
      expect(res.value.brand).toBeNull();
    }
  });

  it('accepts common truthy spellings for rxRequired', () => {
    for (const v of ['true', '1', 'yes', 'Y']) {
      const res = row({ name: 'A', mrpInr: '10', schedule: 'NONE', rxRequired: v });
      expect(res.ok && res.value.rxRequired).toBe(true);
    }
  });
});
