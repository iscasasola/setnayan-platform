/**
 * reviews-are-never-tiered.test.ts — a vendor cannot buy a better reputation.
 *
 * OWNER RULING, re-confirmed 2026-08-09 in answer to a direct question:
 * reviews are **never** ranked, hidden or unlocked by what a vendor pays.
 *
 * WHAT IT REPLACED. `tierCaps` carried two flags that gated reviews by tier:
 *
 *   Free       → reviewStarsCounted: false, reviewCommentsViewable: false
 *   Verified   → stars shown, written reviews hidden
 *   Pro and up → everything shown
 *
 * In practice that meant a Free vendor's own public page told couples
 * *"Reviews unlock when this vendor upgrades their Setnayan plan"*; its
 * marketplace card zeroed its rating and count and read as **new** however many
 * real five-star reviews it had; the Explore sort pushed it below paying shops
 * with none; and the public tier table advertised *"Full written reviews shown"*
 * as a paid perk. A paid shop's reputation looked better than an unpaid one's
 * for money rather than merit — the exact thing the merit-first ranking lock
 * exists to prevent.
 *
 * 🔑 SETTLED WHILE IT WAS STILL FREE TO SETTLE. Production held **0 reviews and
 * 2 vendors** when this landed (checked, 2026-08-09), so not one couple ever
 * saw a hidden review. After the first real review this becomes a migration and
 * an apology.
 *
 * ⚠ The flags are deliberately KEPT rather than deleted — the render sites still
 * read them, so this file pins them true and the gate cannot come back quietly.
 * If a test here fails, someone is reversing an owner lock, not fixing a bug.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tierCaps, VENDOR_TIERS } from './vendor-tier-caps';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

test('every tier — including no tier at all — shows stars and written reviews', () => {
  // `null` is the pre-migration / unknown case and resolves to the free tier.
  const tiers: Array<string | null> = [null, ...VENDOR_TIERS];
  assert.ok(tiers.length >= 3, 'tier list looks empty — this guard would pass vacuously');

  for (const tier of tiers) {
    const caps = tierCaps(tier as never);
    assert.equal(
      caps.reviewStarsCounted,
      true,
      `tier "${tier}" hides its star rating. A vendor with real reviews would render ` +
        `as "new" in the marketplace and sort below a paying shop with none.`,
    );
    assert.equal(
      caps.reviewCommentsViewable,
      true,
      `tier "${tier}" hides written review bodies. Couples would be shown a star ` +
        `count with nothing behind it, and the vendor's own page would invite them ` +
        `to pay to reveal it.`,
    );
  }
});

test('no surface tells a couple that reviews unlock on upgrade', () => {
  // The copy, not the flag — the flag could be true while the sentence survives
  // in a branch that a later refactor makes reachable again.
  const banned = /reviews?\s+unlock|unlock[^.]{0,40}reviews?/i;
  for (const rel of [
    'app/v/[slug]/page.tsx',
    'app/(shell)/explore/page.tsx',
    'app/vendors/_components/vendor-tier-matrix.tsx',
  ]) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    // Strip comments: this file's own history is described in them on purpose.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\/.*/g, '');
    assert.ok(
      !banned.test(code),
      `${rel} still tells a visitor that reviews unlock — reviews are never tiered.`,
    );
  }
});

test('the public tier table does not advertise reviews as a paid perk', () => {
  const src = readFileSync(join(WEB, 'app/vendors/_components/vendor-tier-matrix.tsx'), 'utf8');
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '');
  assert.ok(
    !/reviewCommentsViewable|reviewStarsCounted/.test(code),
    'the tier comparison table reads a review cap again — that presents a ' +
      "vendor's own reviews as something they can buy.",
  );
});
