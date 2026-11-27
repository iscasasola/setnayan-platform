/**
 * Planned Facebook library (library v2 CSV) → one social_posts migration.
 *
 *   pnpm migration:new social_library_v2            # allocate the file first (the house rule)
 *   pnpm --filter web exec tsx scripts/social/import-library.ts <library.csv> <that-migration.sql> [--images-base <https url>]
 *
 * --images-base: the public https folder the library's relative image paths (Folder + "Images, in this order")
 * live under. A row with relative images and no base stops the run.
 *
 * Reads the CSV (Date, Time (Manila), Slot, Pillar, Caption (primary text), Link headline, Pinned first comment,
 * Door, Images), checks every row against the slots (08:00 · 14:00 · 20:00 · 12:00 holiday), and writes an
 * idempotent INSERT into the migration file. Any bad row stops the run with its line number; nothing is written.
 * The rules live in lib/social/library-import.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import { libraryMigrationSql, libraryRowsFromCsv } from '../../lib/social/library-import';

const args = process.argv.slice(2);
const baseAt = args.indexOf('--images-base');
const imagesBase = baseAt >= 0 ? args[baseAt + 1] ?? null : null;
const [csvPath, outPath] = args.filter((_, i) => baseAt < 0 || (i !== baseAt && i !== baseAt + 1));
if (!csvPath || !outPath || (baseAt >= 0 && !imagesBase)) {
  console.error('Usage: tsx scripts/social/import-library.ts <library.csv> <migration.sql> [--images-base <https url>]');
  process.exit(2);
}

const { rows, errors, warnings } = libraryRowsFromCsv(readFileSync(csvPath, 'utf8'), { imagesBase });
for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`${errors.length} bad row(s); nothing written.`);
  process.exit(1);
}

writeFileSync(outPath, libraryMigrationSql(rows, basename(csvPath)));
const bySlot = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.slot]: (acc[r.slot] ?? 0) + 1 }), {});
console.log(`Wrote ${rows.length} planned post(s) to ${outPath}: ${JSON.stringify(bySlot)}`);
