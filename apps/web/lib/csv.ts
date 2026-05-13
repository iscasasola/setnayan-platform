// Tiny CSV parser for guest-list import. Handles the common cases without
// pulling in a 50KB library: header row, quoted fields with commas, escaped
// quotes (""), empty cells, mixed line endings, trailing newline.

export type CsvRow = Record<string, string>;

export function parseCsv(input: string): CsvRow[] {
  const normalized = input.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 1;
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
      continue;
    }
    if (ch === ',') {
      current.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
      continue;
    }
    field += ch;
  }

  // Flush the last field/row.
  current.push(field);
  rows.push(current);

  if (rows.length === 0) return [];

  const headerCells = rows[0] ?? [];
  const header = headerCells.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));

  return rows
    .slice(1)
    .filter((cells) => cells.some((c) => c && c.trim() !== ''))
    .map((cells) => {
      const obj: CsvRow = {};
      for (let i = 0; i < header.length; i += 1) {
        const key = header[i];
        if (!key) continue;
        obj[key] = (cells[i] ?? '').trim();
      }
      return obj;
    });
}
