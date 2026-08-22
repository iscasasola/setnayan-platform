/**
 * the-shop-page-tells-the-truth.test.ts
 *
 * The public shop page's experience chip states a TIER — "Elite", "Expert",
 * "Established", "New to Setnayan" — in the hero, to strangers deciding whether
 * to hire this supplier.
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * The read behind it returned `null` on error AND `null` for a vendor with no
 * completed events. `experienceTier(null)` floors to 0, which is the "New to
 * Setnayan" tier. So a refused read publicly DEMOTED an Elite supplier with 200
 * finalised events to NEW, on their own shop page.
 *
 * 🔑 THIS IS NOT A MISSING NUMBER, IT IS A CLAIM ABOUT SOMEBODY'S BUSINESS —
 * and unlike every other instance of this disease found on 2026-08-19, the
 * person harmed is not the one reading the screen and cannot see it happen.
 *
 * ⚖ SUPPRESSED, NOT GUESSED. The chip disappears when the count was not
 * measured. There was already precedent for its absence — the dense explore
 * card suppresses this very chip, as the page's own comment records — and no
 * precedent for inventing a tier. Showing "Elite" would be the mirror lie.
 *
 * ⚠ NOTE the sibling render (the "N events through Setnayan" detail row) was
 * ALREADY correct and is deliberately untouched: it hides itself on a falsy
 * count, so it states an absence rather than a false fact.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { experienceTier } from '@/lib/vendor-experience';

const src = stripComments(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'page.tsx'), 'utf8'),
);

test('the premise: an unmeasured count really does read as NEW', () => {
  // If this ever stops being true the suppression can be revisited — but while
  // it holds, a null must never reach the chip.
  assert.equal(experienceTier(null).longLabel, 'New to Setnayan');
  assert.equal(experienceTier(null).isNew, true);
  assert.equal(experienceTier(200).longLabel, 'Elite', 'a real Elite is what gets demoted');
});

test('the read distinguishes a refusal from a vendor with no events', () => {
  assert.match(src, /measured: false/, 'a refusal must be reported');
  assert.match(src, /measured: true/, 'and a real answer must not be');
  assert.match(src, /const bookingCountMeasured = finalizedBookingRead\.measured;/);
});

test('the tier chip only appears when the count was measured', () => {
  assert.match(
    src,
    /\{bookingCountMeasured \? \(/,
    'the chip states a tier and must be gated',
  );
  assert.match(src, /\) : null\}/, 'and absent otherwise — never guessed');
});

test('the chip is suppressed, NOT defaulted to a flattering tier', () => {
  assert.doesNotMatch(
    src,
    /bookingCountMeasured \? expTier\.longLabel : ['"`]/,
    'inventing a tier is the mirror of the bug, not a fix',
  );
});
