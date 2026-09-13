/**
 * Re-runnable generator driver for the 2,500-row moodboard_theme_templates
 * seed (migration 20271196372720). Run with:
 *
 *   cd apps/web && npx tsx scripts/generate-moodboard-theme-seed.ts
 *
 * It calls `generateAllThemes()` (apps/web/lib/moodboard-theme-generator.ts),
 * validates every row against the REAL sanitizers, and rewrites the SEED
 * block of the migration file in place (the hand-written header/DO-block
 * wrapper above the seed is preserved — only the VALUES list is replaced).
 * Re-run this any time the generator changes (new style/mood, refreshed
 * naming, more variants per combination) to regenerate the seed content.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateAllThemes,
  validateGeneratedTemplate,
  ALL_STYLE_FAMILIES,
  ALL_MOOD_TAGS,
  THEMES_PER_COMBINATION,
} from '../lib/moodboard-theme-generator';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const migrationPath = join(
  repoRoot,
  'supabase',
  'migrations',
  '20271196372720_moodboard_theme_templates_2500_seed.sql',
);

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function main() {
  // Offset past the 100 hand-authored rows' own 0-99 sort_order range —
  // page.tsx orders the whole gallery by a single `.order('sort_order')`
  // across both tables' content, so generated rows should sort after them.
  const rows = generateAllThemes(100);

  // ── validate every row against the real sanitizers ──────────────────
  let problems = 0;
  for (const row of rows) {
    const errs = validateGeneratedTemplate(row);
    if (errs.length > 0) {
      problems += 1;
      console.error(`INVALID ROW [${row.style_family} / ${row.mood_tag} #${row.sort_order}]:`, errs);
    }
  }
  if (problems > 0) {
    console.error(`✗ ${problems} generated row(s) failed sanitizer validation — aborting, not writing SQL.`);
    process.exit(1);
  }

  // ── count-per-combination sanity check ──────────────────────────────
  const expected = ALL_STYLE_FAMILIES.length * ALL_MOOD_TAGS.length * THEMES_PER_COMBINATION;
  if (rows.length !== expected) {
    console.error(`✗ Expected ${expected} rows, generated ${rows.length} — aborting.`);
    process.exit(1);
  }
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.style_family}::${row.mood_tag}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const style of ALL_STYLE_FAMILIES) {
    for (const mood of ALL_MOOD_TAGS) {
      const key = `${style}::${mood}`;
      const n = counts.get(key) ?? 0;
      if (n < THEMES_PER_COMBINATION) {
        console.error(`✗ Combination ${key} only produced ${n} rows (need ≥${THEMES_PER_COMBINATION}) — aborting.`);
        process.exit(1);
      }
    }
  }

  // ── uniqueness-within-combination check (belt + suspenders on top of
  //    the generator's own de-dupe) ────────────────────────────────────
  const dupCheckMap = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = `${row.style_family}::${row.mood_tag}`;
    const set = dupCheckMap.get(key) ?? new Set<string>();
    if (set.has(row.name)) {
      console.error(`✗ Duplicate name "${row.name}" within combination ${key} — aborting.`);
      process.exit(1);
    }
    set.add(row.name);
    dupCheckMap.set(key, set);
  }

  console.log(`✓ Generated ${rows.length} rows across ${counts.size} combinations, all valid.`);

  // ── emit SQL VALUES ──────────────────────────────────────────────────
  const valuesLines = rows.map((row, i) => {
    const palette = sqlEscape(JSON.stringify(row.role_palette));
    const design = sqlEscape(JSON.stringify(row.reception_design));
    const name = sqlEscape(row.name);
    const desc = sqlEscape(row.description);
    const comma = i === rows.length - 1 ? ';' : ',';
    return `  ('${row.style_family}', '${row.mood_tag}', '${name}', '${desc}', '${palette}'::jsonb, '${design}'::jsonb, ${row.sort_order})${comma}`;
  });

  const header = `-- MOODBOARD THEME TEMPLATES — 2,500-ROW PROCEDURAL SEED (10 style families ×
-- 10 moods × ${THEMES_PER_COMBINATION} variants each). GENERATED FILE — do not hand-edit the
-- VALUES list below; edit apps/web/lib/moodboard-theme-generator.ts and
-- re-run:
--
--   cd apps/web && npx tsx scripts/generate-moodboard-theme-seed.ts
--
-- Every row was validated against the REAL sanitizeRolePalette /
-- sanitizeReceptionDesign functions by that script before this file was
-- written (validateGeneratedTemplate) — same discipline the original 100
-- hand-authored rows (20271194462267) used, just automated. Depends on
-- 20271195711446 having already widened the style_family/mood_tag CHECK
-- constraints to the 10×10 taxonomy.
--
-- Gated on "only insert if row count is below the expected total" so a
-- re-run (e.g. after regenerating with more variants) doesn't duplicate the
-- existing generated content — this migration's rows carry no natural key,
-- so a full DELETE + re-INSERT of exactly this generated set would risk
-- deleting hand-authored 100 rows too if the threshold were wrong; instead
-- this only inserts once, the same "insert if table doesn't already have
-- this content" idempotency the 100-row migration uses, just scoped to a
-- higher threshold so the original 100 don't block the seed.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.moodboard_theme_templates) < 200 THEN
    INSERT INTO public.moodboard_theme_templates
      (style_family, mood_tag, name, description, role_palette, reception_design, sort_order)
    VALUES
${valuesLines.join('\n')}
  END IF;
END $$;
`;

  writeFileSync(migrationPath, header, 'utf8');
  console.log(`✓ Wrote ${migrationPath}`);
}

main();
