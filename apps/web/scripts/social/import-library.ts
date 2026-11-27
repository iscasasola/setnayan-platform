/**
 * Planned Facebook library (library v2 CSV) → one social_posts migration.
 *
 *   pnpm migration:new social_library_v2            # allocate the file first (the house rule)
 *   pnpm --filter web exec tsx scripts/social/import-library.ts <library.csv> <that-migration.sql>
 *
 * Reads the CSV (Date, Time (Manila), Slot, Pillar, Caption (primary text), Link headline, Pinned first comment,
 * Door, Images), checks every row against the slots (08:00 · 14:00 · 20:00 · 12:00 holiday), and writes an
 * idempotent INSERT into the migration file. Any bad row stops the run with its line number; nothing is written.
 * The rules live in lib/social/library-import.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import { libraryMigrationSql, libraryRowsFromCsv } from '../../lib/social/library-import';

const [csvPath, outPath] = process.argv.slice(2);
if (!csvPath || !outPath) {
  console.error('Usage: tsx scripts/social/import-library.ts <library.csv> <migration.sql>');
  process.exit(2);
}

const { rows, errors, warnings } = libraryRowsFromCsv(readFileSync(csvPath, 'utf8'));
for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`${errors.length} bad row(s); nothing written.`);
  process.exit(1);
}

writeFileSync(outPath, libraryMigrationSql(rows, basename(csvPath)));
const bySlot = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.slot]: (acc[r.slot] ?? 0) + 1 }), {});
console.log(`Wrote ${rows.length} planned post(s) to ${outPath}: ${JSON.stringify(bySlot)}`);
