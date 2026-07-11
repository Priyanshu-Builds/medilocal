import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple header + rows', () => {
    const rows = parseCsv('name,mrpInr\nDolo 650,33.6\nCrocin,20');
    expect(rows).toEqual([
      { name: 'Dolo 650', mrpInr: '33.6' },
      { name: 'Crocin', mrpInr: '20' },
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    const rows = parseCsv('name,packSize\n"Vitamin C, chewable","Strip of 10, blister"');
    expect(rows[0]).toEqual({ name: 'Vitamin C, chewable', packSize: 'Strip of 10, blister' });
  });

  it('handles escaped double quotes inside quoted fields', () => {
    const rows = parseCsv('name\n"3"" gauze pad"');
    expect(rows[0].name).toBe('3" gauze pad');
  });

  it('normalizes CRLF line endings', () => {
    const rows = parseCsv('name,brand\r\nDolo,Dolo\r\nPan,Pan\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ name: 'Pan', brand: 'Pan' });
  });

  it('skips fully blank lines but keeps the data', () => {
    const rows = parseCsv('name\nDolo\n\n\nPan\n');
    expect(rows.map((r) => r.name)).toEqual(['Dolo', 'Pan']);
  });

  it('trims header and cell whitespace', () => {
    const rows = parseCsv(' name , mrpInr \n  Dolo  ,  33.6 ');
    expect(rows[0]).toEqual({ name: 'Dolo', mrpInr: '33.6' });
  });

  it('tolerates rows with missing trailing columns', () => {
    const rows = parseCsv('name,brand,mrpInr\nDolo,Dolo');
    expect(rows[0]).toEqual({ name: 'Dolo', brand: 'Dolo', mrpInr: '' });
  });

  it('returns empty for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('   ')).toEqual([]);
  });

  it('handles a quoted field containing a newline', () => {
    const rows = parseCsv('name,note\nDolo,"line1\nline2"');
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe('line1\nline2');
  });
});
