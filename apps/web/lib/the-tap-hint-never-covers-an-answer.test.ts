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
  // Taller screens keep the sticky foot: the generic rule is there and unconditional.
  assert.match(ONE_AT_A_TIME_CSS, /\[data-rsvp-next-slot\]\{position:sticky;bottom:0;/);
});

/*
  📏 RE-CHECK R1 (2026-10-14): after Yes → ‹ Back at 320 × 568 the foot holds NEXT, not the hint — and it stood on the
  answers; in WebKit a tap on the visible strip of "Sadly can't make it" pressed Next and kept Yes. So on a short
  screen the foot never sticks, whatever it holds — the rule names the slot, never the hint's mark. Measured with
  `controller-2026-10-12/rsvp-open-close/scripts/back320.mjs` (both engines; 375 × 667 / 812 boxes unchanged).
*/
test('on a short screen the foot never sticks — the hint or Next — and on a taller one it does', () => {
  const m = /@media \(max-height:([\d.]+)px\)\{([^{}]+)\{position:static\}\}/.exec(ONE_AT_A_TIME_CSS);
  assert.ok(m, 'no short-screen rule keeps the foot in place');
  assert.equal(m![2], '[data-rsvp-next-slot]', `the short-screen rule must name the slot itself (it names ${m![2]}) — Next sits on the answers after Back`);
  const h = Number(m![1]);
  assert.ok(h >= 568 && h < 667, `the short-screen line (${h}px) must hold a 320 × 568 phone and leave 375 × 667 alone`);
});

test('the walker marks the slot only while it holds the hint', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'rsvp-one-at-a-time.tsx'), 'utf8');
  assert.match(src, /slot\.toggleAttribute\('data-rsvp-tap', awaitingTap\)/);
});
