/**
 * ONE-OFF, RE-RUNNABLE LIFT — the 100 HAND-AUTHORED theme rows in
 * supabase/migrations/20271194462267_moodboard_theme_templates.sql go from a
 * three-color `role_palette.reception` to the five the owner directed on
 * 2026-09-03 ("themes must be 5 colors").
 *
 *   cd apps/web && npx tsx scripts/lift-moodboard-hand-authored-reception-to-five.ts
 *
 * WHY A SCRIPT AND NOT A BULK APPEND: those 100 rows were written by hand with
 * real per-theme intent — "piña and jusi ivory, narra wood, antique gold" is a
 * described palette, not filler. Appending two arbitrary colors to all of them
 * would have shipped 100 broken palettes that COUNT as five. So each row's two
 * new members are derived FROM THAT ROW's existing three AND ITS OWN
 * `mood_tag` by `completeReceptionFive` (lib/moodboard-theme-generator.ts) —
 * the same single implementation the 2,500 generated rows use, so all 2,600
 * rows agree on what slots 3 and 4 mean and PALETTE_LIMITS.reception.slotLabels
 * is truthful for every one of them.
 *
 * 🛑 THE MOOD IS NOT OPTIONAL AND IS READ FROM THE ROW. A completion that
 * ignores it fills whichever lightness pole the palette lacks — and a dark
 * palette always already HAS deep, so it always receives light. That shipped
 * once: "All black — walls, linens, chairs" received two near-whites, and
 * "a moody, nighttime heritage reception" received L*94 and L*84. The five
 * colors render directly under the row's own hand-written description in
 * template-gallery.tsx, so a completion that contradicts the mood contradicts
 * the sentence printed above it.
 *
 * WHAT IT NEVER TOUCHES: name, description, style_family, mood_tag,
 * sort_order, reception_design, and the original three reception colors — which
 * keep their exact values AND their order, so Dominant and Supporting stay put.
 * The edit is textual and scoped to the `"reception":[…]` array inside each
 * row's first jsonb literal; every other byte of the file is preserved.
 *
 * IDEMPOTENT: `completeReceptionFive` returns the first five of an input that
 * already has five, so a second run rewrites the file to itself.
 *
 * FAIL-CLOSED: any row whose palette can't be parsed, doesn't land on exactly
 * five, or stops round-tripping through the REAL `sanitizeRolePalette` aborts
 * the whole run before anything is written. A partially-lifted migration is
 * worse than an unlifted one.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  completeReceptionFive,
  RECEPTION_PALETTE_SIZE,
  ALL_MOOD_TAGS,
  type AllMoodTag,
} from '../lib/moodboard-theme-generator';
import { sanitizeRolePalette, type RolePalette } from '../lib/mood-board';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const migrationPath = join(
  repoRoot,
  'supabase',
  'migrations',
  '20271194462267_moodboard_theme_templates.sql',
);

/** The role_palette literal is the FIRST `'{…}'::jsonb` on a VALUES line and
 *  always opens on "ceremony"; JSON hex/keys contain no single quote, so the
 *  literal cannot be terminated early by its own content. */
const PALETTE_LITERAL = /'(\{"ceremony".*?\})'::jsonb/;
const RECEPTION_ARRAY = /"reception":\[[^\]]*\]/g;

/** `mood_tag` is the SECOND single-quoted literal on a VALUES row
 *  (style_family, mood_tag, name, description, …). The completion needs it —
 *  slots 3-4 are derived within the mood's own lightness character, and a row
 *  completed without its mood gets the OPPOSITE of what its tag names. */
const MOOD_TAG = /^ {2}\('(?:[^']|'')*',\s*'((?:[^']|'')*)'/;

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function main() {
  const original = readFileSync(migrationPath, 'utf8');
  const lines = original.split('\n');

  let lifted = 0;
  let alreadyFive = 0;

  const out = lines.map((line, idx) => {
    if (!line.startsWith("  ('")) return line;
    const m = PALETTE_LITERAL.exec(line);
    if (!m) {
      // A VALUES row with no role_palette literal is a shape change this
      // script was not written for — stop rather than silently skip it.
      fail(`line ${idx + 1}: VALUES row has no role_palette jsonb literal`);
    }
    const literal = m[1]!;

    // FAIL CLOSED on an unreadable or unknown mood. A defaulted mood is not a
    // small error here: it is the difference between a dark theme completing
    // with charcoal and completing with bone-white.
    const moodMatch = MOOD_TAG.exec(line);
    if (!moodMatch) fail(`line ${idx + 1}: could not read mood_tag from the VALUES row`);
    const mood = moodMatch[1]!.replace(/''/g, "'") as AllMoodTag;
    if (!(ALL_MOOD_TAGS as ReadonlyArray<string>).includes(mood)) {
      fail(`line ${idx + 1}: mood_tag "${mood}" is not one of ${ALL_MOOD_TAGS.join(', ')}`);
    }

    let parsed: RolePalette;
    try {
      parsed = JSON.parse(literal) as RolePalette;
    } catch {
      return fail(`line ${idx + 1}: role_palette is not valid JSON`);
    }

    const before = parsed.reception;
    if (!Array.isArray(before) || before.length === 0) {
      fail(`line ${idx + 1}: role_palette.reception is missing or empty`);
    }
    if (before.length === RECEPTION_PALETTE_SIZE) alreadyFive += 1;

    const after = completeReceptionFive(before, mood);
    if (after.length !== RECEPTION_PALETTE_SIZE) {
      fail(`line ${idx + 1}: completion produced ${after.length} colors, expected ${RECEPTION_PALETTE_SIZE}`);
    }
    // The original three must survive untouched, in place — this is the whole
    // point of the "lift" (vs. regenerate) and is asserted, not assumed.
    for (let i = 0; i < before.length; i++) {
      if (after[i] !== before[i]!.toUpperCase()) {
        fail(`line ${idx + 1}: original color ${i} changed ${before[i]} → ${after[i]}`);
      }
    }

    const occurrences = literal.match(RECEPTION_ARRAY) ?? [];
    if (occurrences.length !== 1) {
      fail(`line ${idx + 1}: expected exactly 1 "reception" array in the palette, found ${occurrences.length}`);
    }
    const newLiteral = literal.replace(RECEPTION_ARRAY, `"reception":${JSON.stringify(after)}`);

    // Round-trip through the REAL sanitizer: if PALETTE_LIMITS.reception.max
    // were below five, this is where the silent CLAMP would surface — five
    // colors written, three read back, and a swatch strip that looks correct.
    const reparsed = JSON.parse(newLiteral) as RolePalette;
    const sanitized = sanitizeRolePalette(reparsed);
    if (JSON.stringify(sanitized) !== JSON.stringify(reparsed)) {
      fail(
        `line ${idx + 1}: role_palette does not round-trip through sanitizeRolePalette — ` +
          `wrote ${JSON.stringify(reparsed.reception)}, read back ${JSON.stringify(sanitized.reception)}`,
      );
    }

    if (before.length < RECEPTION_PALETTE_SIZE) lifted += 1;
    return line.replace(literal, newLiteral);
  });

  const next = out.join('\n');
  writeFileSync(migrationPath, next, 'utf8');
  console.log(
    `✓ ${lifted} hand-authored row(s) lifted to ${RECEPTION_PALETTE_SIZE} reception colors ` +
      `(${alreadyFive} already had five).`,
  );
  console.log(`✓ Wrote ${migrationPath}`);
}

main();
