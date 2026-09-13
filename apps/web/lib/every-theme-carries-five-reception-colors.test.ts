/**
 * 🔒 EVERY SEEDED THEME CARRIES EXACTLY FIVE RECEPTION COLORS.
 *
 * Owner directive, 2026-09-03: "themes must be 5 colors". All 2,600 rows —
 * the 100 hand-authored ones in 20271194462267 and the 2,500 generated ones in
 * 20271196372720 — must ship a `role_palette.reception` of exactly five.
 *
 * WHY THIS TEST READS THE SQL AND NOT THE GENERATOR: the generator's own tests
 * (moodboard-theme-generator.test.ts) prove the FUNCTION returns five. They
 * cannot see whether anyone re-ran the seed script afterwards, and they cannot
 * see the 100 hand-authored rows at all — those are literal SQL nobody
 * generates. A correct generator over a stale seed file is indistinguishable
 * from a correct system unless something opens the file that actually ships.
 *
 * THE FAILURE THIS EXISTS FOR RENDERS AS SUCCESS. `sanitizeRolePalette` slices
 * every palette to `PALETTE_LIMITS.reception.max`, and it sits on the ONLY
 * write path into `events.role_palette`. Drop that max back to 3 or 4 and all
 * 2,600 five-color themes silently become three-color themes on the way into
 * the couple's board — no error, no log, and a swatch strip that looks exactly
 * like a board that was right. So this asserts the round-trip through the REAL
 * sanitizer, not just the count in the file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sanitizeRolePalette, PALETTE_LIMITS, type RolePalette } from './mood-board';
import { RECEPTION_PALETTE_SIZE } from './moodboard-theme-generator';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', '..', 'supabase', 'migrations');

const SEEDS = [
  ['hand-authored', '20271194462267_moodboard_theme_templates.sql', 100],
  ['generated', '20271196372720_moodboard_theme_templates_2500_seed.sql', 2500],
] as const;

/** Every role_palette jsonb literal in a seed migration. Each VALUES row opens
 *  its palette on "ceremony", and the JSON contains no single quote (hex + bare
 *  keys only), so the literal cannot terminate early on its own content. */
function palettesIn(file: string): RolePalette[] {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
  return (sql.match(/'(\{"ceremony".*?\})'::jsonb/g) ?? []).map(
    (lit) => JSON.parse(lit.slice(1, -8)) as RolePalette,
  );
}

test('🚨 the sanitizer cannot clamp a five-color reception palette', () => {
  // Checked FIRST and on its own: if this is wrong, every count below is still
  // green in the file and wrong in the product.
  assert.ok(
    PALETTE_LIMITS.reception.max >= RECEPTION_PALETTE_SIZE,
    `PALETTE_LIMITS.reception.max is ${PALETTE_LIMITS.reception.max}, below the ${RECEPTION_PALETTE_SIZE} every theme ships — ` +
      `sanitizeRolePalette would silently slice all 2,600 themes back down`,
  );
});

test('🚨 all 2,600 seeded themes carry exactly five reception colors', () => {
  let total = 0;
  for (const [label, file, expected] of SEEDS) {
    const palettes = palettesIn(file);
    assert.equal(
      palettes.length,
      expected,
      `${label} seed (${file}) has ${palettes.length} rows, expected ${expected}`,
    );
    const wrong = palettes
      .map((p, i) => ({ i, n: p.reception?.length ?? 0 }))
      .filter((r) => r.n !== RECEPTION_PALETTE_SIZE);
    assert.deepEqual(wrong, [], `${label} seed has rows that are not ${RECEPTION_PALETTE_SIZE} colors`);
    total += palettes.length;
  }
  assert.equal(total, 2600);
});

test('🚨 every seeded palette round-trips through the REAL sanitizer', () => {
  for (const [label, file] of SEEDS) {
    for (const palette of palettesIn(file)) {
      const after = sanitizeRolePalette(palette);
      assert.deepEqual(
        after.reception,
        palette.reception,
        `${label}: ${JSON.stringify(palette.reception)} came back as ${JSON.stringify(after.reception)}`,
      );
    }
  }
});

test('no seeded reception palette repeats a swatch', () => {
  // Five chips, two identical, renders as a FOUR-color palette — and the
  // gallery's swatch strip dedupes, so it would not even look broken.
  for (const [label, file] of SEEDS) {
    for (const palette of palettesIn(file)) {
      const rec = palette.reception ?? [];
      assert.equal(new Set(rec).size, rec.length, `${label}: repeated color in ${rec.join(' ')}`);
    }
  }
});

test('every seeded reception color is a valid uppercase hex', () => {
  for (const [label, file] of SEEDS) {
    for (const palette of palettesIn(file)) {
      for (const hex of palette.reception ?? []) {
        assert.match(hex, /^#[0-9A-F]{6}$/, `${label}: bad hex ${hex}`);
      }
    }
  }
});

test('the reception slot labels name all five slots', () => {
  const labels = PALETTE_LIMITS.reception.slotLabels ?? [];
  assert.equal(
    labels.length,
    RECEPTION_PALETTE_SIZE,
    `${labels.length} labels for ${RECEPTION_PALETTE_SIZE} slots — an unlabelled slot is a slot nobody knows what to put in`,
  );
  assert.equal(new Set(labels).size, labels.length, 'two slots share a label');
});

test('the reception hint does not still advertise the old range', () => {
  // The hint is the only place a couple is TOLD how many colors to pick. It
  // said "3 to 6 colors" while the palette was capped at five, which is the
  // same class of defect as the palettes themselves: copy that describes a
  // system that no longer exists.
  const { hint, min, max } = PALETTE_LIMITS.reception;
  assert.ok(hint.includes(`${min} to ${max}`), `hint "${hint}" does not state the real ${min}-${max} range`);
});
