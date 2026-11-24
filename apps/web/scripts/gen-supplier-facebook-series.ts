/**
 * Write the supplier Facebook series RELEASE migration from its source (lib/supplier-facebook-series.ts).
 *
 *     npx tsx scripts/gen-supplier-facebook-series.ts --start 2026-12-01 --every 1   # print it
 *     npx tsx scripts/gen-supplier-facebook-series.ts --write                        # write the release migration
 *
 * The series is HELD (kept out of the queue) while `SUPPLIER_SERIES_RELEASE` is null. Only after the controller
 * confirms the Meta app is Live: allocate the file with `pnpm migration:new`, fill in SUPPLIER_SERIES_RELEASE,
 * then run with --write.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SUPPLIER_FACEBOOK_SERIES, SUPPLIER_SERIES_RELEASE, supplierSeriesReleaseSql } from '../lib/supplier-facebook-series';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

if (process.argv.includes('--write')) {
  if (!SUPPLIER_SERIES_RELEASE) {
    console.error('SUPPLIER_SERIES_RELEASE is null: the series is held until the Meta app is Live. Nothing written.');
    process.exit(1);
  }
  const file = path.resolve(__dirname, '../../../supabase/migrations', SUPPLIER_SERIES_RELEASE.migration);
  fs.writeFileSync(file, supplierSeriesReleaseSql(SUPPLIER_SERIES_RELEASE));
  console.log(`wrote ${file} (${SUPPLIER_FACEBOOK_SERIES.length} posts)`);
} else {
  const start = arg('--start') ?? SUPPLIER_SERIES_RELEASE?.start;
  const everyDays = Number(arg('--every') ?? SUPPLIER_SERIES_RELEASE?.everyDays ?? 1);
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !(everyDays >= 1)) {
    console.error('usage: --start YYYY-MM-DD [--every N]');
    process.exit(1);
  }
  process.stdout.write(supplierSeriesReleaseSql({ start, everyDays }));
}
