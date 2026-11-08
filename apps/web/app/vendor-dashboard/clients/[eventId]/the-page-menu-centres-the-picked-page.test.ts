/**
 * 🎯 THE PAGE MENU CENTRES THE PICKED PAGE (Build 2 row #36, prototype v116 `centerMk` + the body swipe).
 *
 * The picked client's menu strip keeps its picked page in the MIDDLE — after a tap, a body swipe, a deep link and the
 * first open — and at either end it simply stays at the end. Only the strip scrolls, never the body. A swipe across
 * the body (≥ 60 px, 1.5× more sideways than down) turns the page in the menu's order.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { centreScrollLeft, pageSwipeStep } from '@/app/_components/centre-in-strip';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = readFileSync(join(HERE, '_components', 'picked-client-shell.tsx'), 'utf8');

test('the picked item lands in the middle; the ends stay put', () => {
  // A 375-wide strip of nine 72-wide items (648 wide, max scroll 273), nothing scrolled yet.
  const strip = { scrollLeft: 0, scrollWidth: 648, clientWidth: 375 };
  const at = (i: number, scrollLeft = 0) => centreScrollLeft({ ...strip, scrollLeft }, 0, 375, i * 72 - scrollLeft, 72);
  assert.equal(at(0), 0, 'the first page keeps the strip at its start');
  assert.equal(at(1), 0, 'near the start it stays at the start');
  assert.equal(at(4), 4 * 72 + 36 - 187.5 > 0 ? Math.round(4 * 72 + 36 - 187.5) : 0, 'the middle page is centred');
  assert.equal(at(8), 273, 'the last page keeps the strip at its end');
  assert.equal(at(4, 273), Math.round(4 * 72 + 36 - 187.5), 'centring does not depend on where the strip was');
});

test('a body swipe turns the page only when it is clearly sideways', () => {
  assert.equal(pageSwipeStep(-80, 10), 1, 'left = the next page');
  assert.equal(pageSwipeStep(80, 10), -1, 'right = the previous page');
  assert.equal(pageSwipeStep(-50, 0), 0, 'under 60 px is not a swipe');
  assert.equal(pageSwipeStep(-80, 60), 0, 'mostly down is the scroll');
});

test('the shell centres on every change of page (and the first open, instantly) and swipes in menu order', () => {
  assert.match(SHELL, /centreInStrip\(strip, strip\?\.querySelector<HTMLElement>\(`\[data-picked-page="\$\{page\}"\]`\) \?\? null, first\)/);
  assert.match(SHELL, /\}, \[page, host\]\);/, 'a deep link / first open (the portal landing) is not centred');
  assert.doesNotMatch(SHELL, /strip\.scrollTo\(\{ left: Math\.max\(0, left - 12\)/, 'the old keep-in-view (not centred) is back');
  assert.match(SHELL, /const step = pageSwipeStep\(t\.clientX - sx, t\.clientY - sy\);/);
  assert.match(SHELL, /const next = menu\[i \+ step\];\s*if \(i >= 0 && next\) select\(next\.id\);/);
  assert.match(SHELL, /PAGE_SWIPE_SKIP = '\[data-picked-menu\],\[data-calendar\],\[data-dates-week-strip\],input,textarea/, 'a swipe on the calendar would turn the page');
});
