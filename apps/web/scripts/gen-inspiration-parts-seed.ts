/**
 * gen-inspiration-parts-seed.ts — emits the SEED block of
 * `supabase/migrations/20271287668170_inspiration_parts_on_the_taxonomy.sql` from the consts
 * (`lib/inspiration-parts-seed.ts`), so the table starts as today's map byte for byte.
 *
 *   Print:  pnpm -s tsx scripts/gen-inspiration-parts-seed.ts            (from apps/web)
 *   Check:  pnpm -s tsx scripts/gen-inspiration-parts-seed.ts --check    (exit 1 when the migration's
 *           block between the BEGIN/END GENERATED SEED markers differs from what the consts say)
 *
 * ⚠ An APPLIED migration is never edited. `--check` exists for the PR that adds the file; after it
 * merges, the db test `inspiration-parts-seed-equals-the-consts.db.test.ts` is the guard.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inspirationPartsSeed } from '../lib/inspiration-parts-seed';

const MIGRATION = join(
  __dirname,
  '../../../supabase/migrations/20271287668170_inspiration_parts_on_the_taxonomy.sql',
);
const BEGIN = '-- BEGIN GENERATED SEED (scripts/gen-inspiration-parts-seed.ts)';
const END = '-- END GENERATED SEED';

const q = (s: string | null): string => (s == null ? 'NULL' : `'${s.replace(/'/g, "''")}'`);

export function seedSql(): string {
  const rows = inspirationPartsSeed();
  const parts = rows
    .map(
      (r) =>
        `  (${q(r.slotKey)}, ${q(r.label)}, ${q(r.kind)}, ${q(r.homeCategoryId)}, ${r.sortOrder}, ${r.hidden ? 'TRUE' : 'FALSE'})`,
    )
    .join(',\n');
  const links = rows
    .flatMap((r) => r.alsoCategoryIds.map((c, i) => `  (${q(r.slotKey)}, ${q(c)}, ${(i + 1) * 10})`))
    .join(',\n');
  return [
    BEGIN,
    'INSERT INTO public.inspiration_parts (slot_key, label_en, kind, home_category_id, sort_order, hidden) VALUES',
    parts,
    'ON CONFLICT (slot_key) DO NOTHING;',
    '',
    'INSERT INTO public.inspiration_part_categories (slot_key, category_id, sort_order) VALUES',
    links,
    'ON CONFLICT (slot_key, category_id) DO NOTHING;',
    END,
  ].join('\n');
}

if (process.argv.includes('--check')) {
  const sql = readFileSync(MIGRATION, 'utf8');
  const a = sql.indexOf(BEGIN);
  const b = sql.indexOf(END);
  const block = a >= 0 && b > a ? sql.slice(a, b + END.length) : '';
  if (block !== seedSql()) {
    console.error('✗ the migration seed block differs from the consts — re-run and splice the output');
    process.exit(1);
  }
  console.log('✓ the migration seed block equals the consts');
} else {
  console.log(seedSql());
}
