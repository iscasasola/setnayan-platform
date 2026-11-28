/**
 * Planned Facebook library (library v2 CSV) → one social_posts migration.
 *
 *   pnpm migration:new social_library_v2            # allocate the file first (the house rule)
 *   pnpm --filter web exec tsx scripts/social/import-library.ts <library.csv> <that-migration.sql> \
 *     [--images-base <https url> | --images-later] [--skip-past-slots]
 *
 * --images-base: the public https folder the library's relative image paths (Folder + "Images, in this order")
 * live under. A row with relative images and no base stops the run, unless --images-later says the images are not
 * hosted yet: then they are left off (media stays NULL, the flush posts the branded card) and counted.
 * --skip-past-slots: the migration leaves out every planned post whose slot has passed when it runs.
 *
 * Reads the CSV (Date, Time (Manila), Slot, Pillar, Caption (primary text), Link headline, Pinned first comment,
 * Door, Images, Schedule now?), checks every row against the slots (08:00 · 14:00 · 20:00 · 12:00 holiday), and
 * writes an idempotent INSERT into the migration file. Rows not ready to schedule and slot-sharing twins are skipped
 * and listed. Any bad row stops the run with its line number; nothing is written.
 * The rules live in lib/social/library-import.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import { libraryMigrationSql, libraryRowsFromCsv } from '../../lib/social/library-import';

const args = process.argv.slice(2);
const flags = new Set<string>(args.filter((a) => a === '--images-later' || a === '--skip-past-slots'));
const baseAt = args.indexOf('--images-base');
const imagesBase = baseAt >= 0 ? args[baseAt + 1] ?? null : null;
const [csvPath, outPath] = args.filter(
  (a, i) => !flags.has(a) && (baseAt < 0 || (i !== baseAt && i !== baseAt + 1)),
);
const imagesLater = flags.has('--images-later');
if (!csvPath || !outPath || (baseAt >= 0 && !imagesBase) || (imagesBase && imagesLater)) {
  console.error(
    'Usage: tsx scripts/social/import-library.ts <library.csv> <migration.sql> [--images-base <https url> | --images-later] [--skip-past-slots]',
  );
  process.exit(2);
}

const { rows, errors, warnings, skipped } = libraryRowsFromCsv(readFileSync(csvPath, 'utf8'), { imagesBase, imagesLater });
for (const s of skipped) console.warn(`skipped: ${s}`);
for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`${errors.length} bad row(s); nothing written.`);
  process.exit(1);
}

writeFileSync(outPath, libraryMigrationSql(rows, basename(csvPath), { skipPastSlots: flags.has('--skip-past-slots') }));
const bySlot = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.slot]: (acc[r.slot] ?? 0) + 1 }), {});
console.log(`Wrote ${rows.length} planned post(s) to ${outPath}: ${JSON.stringify(bySlot)}; skipped ${skipped.length}.`);
