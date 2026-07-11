/**
 * Minimal RFC-4180-ish CSV parser — enough for admin catalog bulk import
 * without pulling a dependency. Handles quoted fields, embedded commas,
 * embedded newlines, and "" escaped quotes. Header row drives the keys.
 */
export function parseCsv(input: string): Array<Record<string, string>> {
  const rows = parseRows(input);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((cells) => cells.some((c) => c.trim() !== '')) // skip blank lines
    .map((cells) => {
      const record: Record<string, string> = {};
      header.forEach((key, i) => {
        record[key] = (cells[i] ?? '').trim();
      });
      return record;
    });
}

/** Tokenize the whole document into rows of raw cell strings. */
function parseRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // Normalize CRLF/CR to LF so row splitting is uniform.
  const text = input.replace(/\r\n?/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row (no final newline).
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
