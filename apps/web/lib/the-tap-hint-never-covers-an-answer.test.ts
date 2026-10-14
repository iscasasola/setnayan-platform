/**
 * 👆 "TAP ONE TO CONTINUE" NEVER STANDS ON AN ANSWER (controller walk 2026-10-14, 320 × 568: the sticky hint covered
 * most of "Joyfully accepts" on the reply page's first screen, and a tap there did nothing until the guest scrolled).
 *
 * Measured in a browser (Chromium + WebKit, `controller-2026-10-12/rsvp-open-close/scripts/tap320.mjs`): before, every
 * probe point on the first answer at 320 × 568 hit the hint; after, all four hit the answer and one tap moves on — and
 * at 375 × 667 / 375 × 812 the hint's box is unchanged (595–667 sticky · 655–727). This file holds the two rules that
 * did it, and the mark the walker sets so they apply ONLY to the hint (Next keeps its sticky foot everywhere).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ONE_AT_A_TIME_CSS } from '@/app/[slug]/_components/rsvp-one-at-a-time';

test('the hint is see-through to taps everywhere, and does not stick on a short screen', () => {
  assert.match(ONE_AT_A_TIME_CSS, /\[data-rsvp-next-slot\]\[data-rsvp-tap\]\{pointer-events:none\}/);
  assert.match(ONE_AT_A_TIME_CSS, /@media \(max-height:599\.98px\)\{\[data-rsvp-next-slot\]\[data-rsvp-tap\]\{position:static\}\}/);
  // Next (no mark) keeps its sticky foot: the generic rule is still there and unconditional.
  assert.match(ONE_AT_A_TIME_CSS, /\[data-rsvp-next-slot\]\{position:sticky;bottom:0;/);
});

test('the walker marks the slot only while it holds the hint', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'rsvp-one-at-a-time.tsx'), 'utf8');
  assert.match(src, /slot\.toggleAttribute\('data-rsvp-tap', awaitingTap\)/);
});
