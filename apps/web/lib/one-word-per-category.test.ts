/**
 * ONE WORD PER CATEGORY — no second map, no private humaniser.
 *
 * ── WHAT WENT WRONG ────────────────────────────────────────────────────────
 * `lib/vendors.ts` holds `VENDOR_CATEGORY_LABEL` (52 entries, one per
 * `vendor_category` enum value) and `displayServiceLabel`, whose docblock is
 * "NEVER PRINT A DATABASE KEY AT A COUPLE" (2026-08-09). Alongside it, the
 * Customer Card carried a file-local `CATEGORY_LABELS` with **28** entries,
 * rendered `CATEGORY_LABELS[c] ?? c`. Measured on 2026-09-08:
 *
 *   • **24 of 52 categories had no entry**, so `funeral_home`, `crew_meals`
 *     and `av_production` printed as RAW ENUM KEYS — and the call-time row put
 *     that key into a PERSISTED `proposed_label` form value, so the key
 *     outlived the render.
 *   • **10 of the 28 it did have disagreed** with the shared map — "Cake" vs
 *     "Cake maker", "Other" vs "Miscellaneous" — so one category read two ways
 *     on two supplier-facing screens.
 *
 * 🔑 THE SECOND DEFINITION WAS NOT THE BUG. THE SECOND DEFINITION *DRIFTING*
 * WAS. It was presumably correct the day it was written; it fell behind as the
 * enum grew from 28 values to 52, and nothing failed, because a missing key is
 * a `??` away from looking deliberate.
 *
 * ── WHY A BASELINE, NOT A CLEAN BILL ───────────────────────────────────────
 * A sweep found this is a FAMILY, not one bug: four separate private
 * `prettyCategory` copies, a `humanizeCategory` whose output is stored, and two
 * more maps whose keys are vendor categories (`WEDDING_TILE_LABEL`, which
 * `labelForVendorCategory` deliberately PREFERS over the canonical map, and
 * `PLAN_GROUPS`). Some of those are legitimate — a tile is not a category —
 * and untangling them is not one change. So the known ones are listed in
 * `one-word-per-category.baseline.txt`, which **may only SHRINK**: an entry
 * removed from the tree must be removed there in the same PR, and a NEW
 * offender fails this test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { VENDOR_CATEGORIES } from '@/lib/vendors';

const WEB = join(import.meta.dirname, '..');
const ROOTS = ['app', 'lib'];

/** The one file allowed to define a category→label map. */
const CANONICAL = 'lib/vendors.ts';

const BASELINE = new Set(
  readFileSync(join(WEB, 'lib/one-word-per-category.baseline.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#')),
);

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.next') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
    }
  };
  for (const r of ROOTS) walk(join(WEB, r));
  return out;
}

/**
 * `band_dj`.replace(/_/g,' ') — the shape that yields "band dj" where the
 * shared map says "Band / DJ".
 */
const HUMANISER = /[A-Za-z_$][\w$.?]*categor\w*\s*\.replace\(\s*\/_\/g\s*,\s*['"] ['"]\s*\)/i;

/** `function prettyCategory(...)` / `humanizeCategory` — the named shape. */
const NAMED_HUMANISER = /(?:function|const)\s+\w*(?:pretty|humani[sz]e)\w*[Cc]ategor\w*/;

/**
 * How many DISTINCT vendor-category keys in this file map to a HUMAN LABEL.
 *
 * ⚠ THE VALUE TEST IS THE WHOLE GUARD. A first cut counted any string value and
 * flagged seven files — every one a false positive, because the repo is full of
 * legitimate slug→SLUG maps (`photographer: 'photo_video'` in lib/appointments,
 * `band_dj: 'live_band'` in lib/shortlist-taxonomy). Those are taxonomy
 * bridges, not second names for a category, and a guard that cannot tell them
 * apart is noise that gets baselined into silence.
 *
 * A LABEL has a space or a capital and is not bare snake_case.
 */
function countLabelKeys(src: string, keys: Set<string>): number {
  const hits = new Set<string>();
  for (const m of src.matchAll(/^\s*([a-z][a-z0-9_]*)\s*:\s*'([^']*)'/gm)) {
    const [, key, value] = m;
    if (!keys.has(key!)) continue;
    if (/^[a-z0-9_]+$/.test(value!)) continue; // a slug, not a name
    if (!/[A-Z ]/.test(value!)) continue;
    hits.add(key!);
  }
  return hits.size;
}

const FILES = sourceFiles().map((p) => ({ rel: relative(WEB, p), src: stripComments(readFileSync(p, 'utf8')) }));

test('the source scan actually reads files (a zero-file sweep is a green lie)', () => {
  // Every check below is an ABSENCE assertion, so a broken walk would pass all
  // of them silently. This is the input check those need.
  assert.ok(FILES.length > 500, `only ${FILES.length} source files scanned`);
  assert.ok(
    FILES.some((f) => f.rel === CANONICAL),
    'the canonical map file was not scanned — the walk is wrong',
  );
});

test('🔑 no SECOND map from vendor-category slugs to display strings', () => {
  // A map is "a category map" when >= 5 distinct enum values appear as object
  // keys with plain string values. Five, not one: `{ venue: 'x' }` is usually a
  // config, while five category keys in a row is the same table again.
  const keys = new Set<string>(VENDOR_CATEGORIES as readonly string[]);
  const offenders: string[] = [];
  for (const { rel, src } of FILES) {
    if (rel === CANONICAL) continue;
    if (countLabelKeys(src, keys) >= 5) offenders.push(rel);
  }
  const fresh = offenders.filter((o) => !BASELINE.has(o));
  assert.deepEqual(
    fresh,
    [],
    `a second category→label map appeared: ${fresh.join(', ')}. ` +
      'Route it through displayServiceLabel, or add one reasoned line to ' +
      'lib/one-word-per-category.baseline.txt saying why it is genuinely a ' +
      'different concept (a TILE is not a CATEGORY).',
  );
});

test('🔑 no private humaniser stands in for the shared resolver', () => {
  // `band_dj`.replace(/_/g,' ') is "band dj". The shared map says "Band / DJ".
  // The humaniser looks harmless precisely because its output is readable.
  const offenders: string[] = [];
  for (const { rel, src } of FILES) {
    if (rel === CANONICAL) continue;
    if (HUMANISER.test(src) || NAMED_HUMANISER.test(src)) offenders.push(rel);
  }
  const fresh = offenders.filter((o) => !BASELINE.has(o));
  assert.deepEqual(
    fresh,
    [],
    `a category is being humanised inline instead of resolved: ${fresh.join(', ')}. ` +
      'Use displayServiceLabel from @/lib/vendors.',
  );
});

test('the baseline may only SHRINK — no stale entries', () => {
  // An entry whose file no longer offends is a false record of debt, and it
  // silently re-permits the pattern the day that file offends again.
  const byPath = new Map(FILES.map((f) => [f.rel, f.src]));
  const stale: string[] = [];
  const keys = new Set<string>(VENDOR_CATEGORIES as readonly string[]);
  for (const entry of BASELINE) {
    const src = byPath.get(entry);
    if (src === undefined) { stale.push(`${entry} (file is gone)`); continue; }
    const humanises = HUMANISER.test(src) || NAMED_HUMANISER.test(src);
    if (countLabelKeys(src, keys) < 5 && !humanises) {
      stale.push(`${entry} (no longer offends — delete this line)`);
    }
  }
  assert.deepEqual(stale, [], `stale baseline entries: ${stale.join(', ')}`);
});

test('the two surfaces this change fixed stay fixed', () => {
  const card = FILES.find((f) => f.rel === 'app/vendor-dashboard/clients/[eventId]/page.tsx')!;
  assert.ok(!/CATEGORY_LABELS/.test(card.src), 'the Customer Card grew a local label map again');
  assert.match(card.src, /displayServiceLabel\(c\)/, 'the booked-category chips stopped resolving');
  assert.match(
    card.src,
    /displayServiceLabel\(callTime\.category\)/,
    'the call-time row writes a raw key into the persisted proposed_label again',
  );

  const desk = FILES.find((f) => f.rel === 'app/[slug]/_components/supplier-desk.tsx')!;
  assert.ok(
    !/replace\(\/_\/g/.test(desk.src),
    'supplier-desk is de-underscoring a category again — it printed "band dj"',
  );
});
