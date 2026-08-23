import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

/**
 * no-name-cut-to-one-letter.test.ts
 *
 * 🚨 THE OWNER SAW A NAME RENDERED AS `Y…` ON HIS OWN PHONE. Measured in the
 * live page at 375px: the "Worth planning" row is 309px, and its icon (36),
 * gaps (42), countdown (69) and "Start planning" chip (111) are ALL `shrink-0`.
 * The name column was `min-w-0`, so it was the only thing that could give way
 * — and it gave way to **17 pixels**. Its date beneath read `D…`.
 *
 * ⚠ ALL FIVE ROWS on that screen were truncating. The two event rows had 142px
 * rather than 17, so they read like an ordinary ellipsis and hid how badly the
 * others were crushed.
 *
 * 🛡 Mutation-checked by occurrence count. Comments stripped before matching —
 * the fix quotes the classes it removed.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const src = () => stripComments(readFileSync(join(HERE, '_components/year-moments-list.tsx'), 'utf8'));

test('the row may wrap on a phone, and stays one line above it', () => {
  const s = src();
  assert.match(s, /'flex flex-wrap items-center[^']*sm:flex-nowrap'/, 'wrap below sm, nowrap above');
});

test('the name column has a FLOOR, which is what makes wrapping possible', () => {
  // A flex row shrinks before it wraps. With `min-w-0` the column shrank to 17px
  // and the row never wrapped at all — the floor is the whole mechanism.
  const s = src();
  assert.match(s, /className="min-w-\[9rem\] flex-1 sm:min-w-0"/);
  assert.ok(
    !/className="min-w-0 flex-1"/.test(s),
    'the column can shrink to nothing again — that is the defect, exactly',
  );
});

test('both markers render at EVERY width, as the file already required', () => {
  // The file's own rule: "BOTH branches always render — a row with no marker
  // reads as unknown, which is the one thing this line must never say."
  // "Open plan" was `hidden … sm:inline-flex`, so on a phone it rendered
  // nothing and an event you already have looked like one you had not started.
  const s = src();
  const openPlan = s.slice(s.indexOf('Open plan') - 400, s.indexOf('Open plan'));
  assert.ok(!/hidden shrink-0/.test(openPlan), '"Open plan" is hidden on phones again');
  assert.ok(!/sm:inline-flex/.test(openPlan), 'and gated to the wide layout again');
  assert.match(openPlan, /inline-flex shrink-0/);
});

test('neither the countdown nor the marker was deleted to make room', () => {
  // The cheap fix was to hide one of them on a phone. Wrapping keeps both
  // facts on screen, which is the point — the row says WHEN and WHETHER.
  const s = src();
  assert.match(s, /\{m\.countdownLabel\}/);
  assert.match(s, /Start planning/);
  assert.match(s, /Open plan/);
});
