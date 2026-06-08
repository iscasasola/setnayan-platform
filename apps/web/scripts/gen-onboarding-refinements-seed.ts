/**
 * Emits the onboarding_refinements + onboarding_refinement_options seed SQL from
 * the canonical data module, so the migration seed stays byte-derivable from
 * app/onboarding/wedding/_data/refinements.ts (single source of truth). Run:
 *   npx tsx scripts/gen-onboarding-refinements-seed.ts > /tmp/refinements_seed.sql
 */
import { REFINEMENTS_DATA } from '../app/onboarding/wedding/_data/refinements';

const esc = (s: string) => s.replace(/'/g, "''");
const N = (v: string | null | undefined) => (v == null ? 'NULL' : `'${esc(v)}'`);

// Emit two MULTI-ROW INSERTs (one per table) so the whole seed is 2 statements —
// applyable via `supabase db query` (which runs one command per call).
const leafRows = REFINEMENTS_DATA.map(
  (leaf, i) =>
    `(${N(leaf.key)},${N(leaf.label)},${N(leaf.description)},${N(leaf.mainPhoto)},${leaf.dynamic === 'ceremony' ? 'TRUE' : 'FALSE'},${i})`,
);
const optionRows: string[] = [];
REFINEMENTS_DATA.forEach((leaf) => {
  leaf.options.forEach((o, j) => {
    optionRows.push(`(${N(leaf.key)},${N(o.key)},${N(o.emoji)},${N(o.label)},${N(o.photo)},${j})`);
  });
});

let sql = '';
sql +=
  `INSERT INTO public.onboarding_refinements (leaf_key,label_en,description_en,main_photo,is_dynamic_ceremony,sort_order) VALUES\n` +
  leafRows.join(',\n') +
  `\nON CONFLICT (leaf_key) DO UPDATE SET label_en=EXCLUDED.label_en, description_en=EXCLUDED.description_en, main_photo=EXCLUDED.main_photo, is_dynamic_ceremony=EXCLUDED.is_dynamic_ceremony, sort_order=EXCLUDED.sort_order, updated_at=now();\n`;
sql +=
  `INSERT INTO public.onboarding_refinement_options (leaf_key,option_key,emoji,label_en,photo,sort_order) VALUES\n` +
  optionRows.join(',\n') +
  `\nON CONFLICT (leaf_key,option_key) DO UPDATE SET emoji=EXCLUDED.emoji, label_en=EXCLUDED.label_en, photo=EXCLUDED.photo, sort_order=EXCLUDED.sort_order, updated_at=now();\n`;
process.stdout.write(sql);
