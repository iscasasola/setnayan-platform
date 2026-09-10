/**
 * THE PRINTED KEEPSAKE STAYS QUIET AT A WAKE TOO — both formats, one signal.
 *
 * `the-wake-never-celebrates.test.ts` already pins the on-screen solemn
 * register: `eventWordsFromProfile(...).solemn` is the ONE fact a wake sets,
 * and every on-screen surface branches on that same field rather than
 * re-deriving "is this event solemn" from the event type itself. The print
 * route had never asked the question at all — this file is the print-side
 * counterpart, reusing the identical `words.solemn` signal.
 *
 * ── THE INTERPRETATION, PINNED (flagged as a judgment call in the PR) ───────
 * "Print quiet" suppresses FESTIVE CHROME — the champagne-gold / mulberry
 * accent colour threaded through both stylesheets' rules, chips and borders —
 * never CONTENT. Every headline, photo, quote, credit and the couple's own
 * words still print unchanged; only the two accent colour tokens collapse
 * onto ink. This is the narrowest reading consistent with how solemn
 * suppression works elsewhere (the countdown and the marketing upsells are
 * WITHHELD outright because their presence is the defect; nothing on a print
 * keepsake is a defect at a wake — a wake gets a keepsake too — so nothing is
 * withheld, only re-coloured).
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 * 1 · page.tsx computes `words.solemn` ONCE (`event-words.ts`, the same
 *     signal every other surface reads) and applies it as a class shared by
 *     BOTH formats — not two separate "is this solemn" checks.
 * 2 · BOTH stylesheets (A3's keepsake.css.ts and A4's keepsake-a4.css.ts)
 *     carry the `.keepsake-root.k-solemn` override, and it overrides the
 *     RAW channel tokens (`--color-terracotta`/`--color-mulberry`), not only
 *     the derived `--k-accent`/`--k-mulberry` — a couple of rules read the
 *     raw tokens directly via `rgba(var(--color-terracotta), …)`, and an
 *     override that missed them would leave a gold-tinted border on an
 *     otherwise-quiet sheet.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { eventWordsFromProfile } from '../_lib/event-words';
import { WAKE_PROFILE, WEDDING_PROFILE } from '@/lib/event-type-profile';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)));

const strip = (s: string) =>
  s
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

function src(rel: string): string {
  return strip(readFileSync(join(HERE, rel), 'utf8'));
}

test('the route reuses the ONE solemn signal — no second "is this event solemn" check', () => {
  // Same fact event-words.ts already computes; a wake resolves solemn:true,
  // a wedding resolves solemn:false. The print route must key off THIS field,
  // never re-derive it from event_type or eventWord directly.
  assert.equal(eventWordsFromProfile(WAKE_PROFILE).solemn, true);
  assert.equal(eventWordsFromProfile(WEDDING_PROFILE).solemn, false);

  const page = src('page.tsx');
  assert.match(
    page,
    /words\.solemn\s*\?\s*'\s*k-solemn'\s*:\s*''/,
    "page.tsx must derive its solemn class from words.solemn (event-words.ts's own field), not a second check",
  );
  // Applied once, shared: both the "not ready yet" stand-in and the finished
  // sheet use the SAME `rootClassName`/class expression — count the sites
  // that consume `words.solemn`, expect exactly one derivation site.
  const derivations = page.match(/words\.solemn\s*\?/g) ?? [];
  assert.equal(derivations.length, 1, `expected exactly 1 solemn-derivation site in page.tsx, found ${derivations.length}`);
});

test('both stylesheets carry the solemn-quiet override, on the RAW channel tokens', () => {
  for (const file of ['keepsake.css.ts', 'keepsake-a4.css.ts']) {
    const css = src(file);
    assert.match(
      css,
      /\.keepsake-root\.k-solemn\s*\{/,
      `${file} is missing the .keepsake-root.k-solemn override — a wake's print keepsake would stay gold`,
    );
    // The raw channel tokens, not only the derived --k-accent/--k-mulberry —
    // a couple of rules read rgba(var(--color-terracotta), …) directly.
    assert.match(
      css,
      /--color-terracotta:\s*var\(--color-ink\)/,
      `${file}'s solemn override does not neutralise --color-terracotta — a direct rgba(var(--color-terracotta)) rule would stay gold`,
    );
    assert.match(
      css,
      /--color-mulberry:\s*var\(--color-ink\)/,
      `${file}'s solemn override does not neutralise --color-mulberry`,
    );
  }
});

test('sabotage: removing the raw-token override leaves a direct rgba(--color-terracotta) rule gold — caught', () => {
  const css = src('keepsake.css.ts');
  const withoutRawOverride = css.replace(/--color-terracotta:\s*var\(--color-ink\);\s*/, '').replace(
    /--color-mulberry:\s*var\(--color-ink\);\s*/,
    '',
  );
  console.log(
    `SABOTAGE: raw-token overrides present before=${/--color-terracotta:\s*var\(--color-ink\)/.test(css)} after=${/--color-terracotta:\s*var\(--color-ink\)/.test(withoutRawOverride)}`,
  );
  assert.equal(/--color-terracotta:\s*var\(--color-ink\)/.test(withoutRawOverride), false);
  // And the sheet still has at least one rule reading the raw token directly
  // — proving the sabotage actually leaves something gold, not that the
  // token merely went unused.
  assert.match(withoutRawOverride, /rgba\(var\(--color-terracotta\)/);

  // The real file passes.
  assert.match(css, /--color-terracotta:\s*var\(--color-ink\)/);
});
