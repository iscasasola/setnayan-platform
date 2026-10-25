/**
 * 🏠 HOME IS LIT UNTIL THE GUEST SCROLLS PAST IT — even on a short page (Batch 9 walk W1, 2026-10-16).
 *
 * The walk (`controller-2026-10-12/test-b9/WALK.md` W1) measured a Save the Date at 375 × 812 with its marks at
 * `#site-home` 48 · `#site-story` 242 and a page only 860–981 px tall: Story's mark sat inside the lit line from the
 * first screen, and the page's END was on screen too — so Story was lit and Home never was. The approved prototype
 * (§1c frame 2) has Home lit on the countdown.
 *
 * Held here:
 *   1 · on those measured geometries Home is lit at the top AND where the swipe lands (Home's mark at the top),
 *       at the page's end too; once Home's mark has gone above the screen, the spy's ordinary rules apply again;
 *   2 · the Invitation's long-page behaviour is unchanged (Details and Story still light by scrolling);
 *   3 · a tapped mark stays lit until the guest's own touch / wheel / key (a short page cannot scroll a tapped
 *       Story to the line), on the bar and the rail, and the spy honours the pin.
 *
 * Sabotage (2026-10-16): drop the Home rule from `litJumpMark` → 1 red; drop the pin from `spy` → 1 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { HOME_PASSED, LIT_LINE, litJumpMark } from './jump-marks';

const SLUG = join(process.cwd(), 'app', '[slug]');
const src = (...p: string[]) => stripComments(readFileSync(join(SLUG, ...p), 'utf8'));
const std = (scrollY: number, home = 48, story = 242) => [
  { key: 'home', top: home - scrollY },
  { key: 'story', top: story - scrollY },
];

test('1 · a Save the Date lights Home on its first screen and where the swipe lands, at either height', () => {
  /* Measured in the lab (2026-10-16): 812 → the page is 860 px, the swipe lands y 48; 667 → 762 px, the swipe runs to
     its end, y 92–95. Both are the first screen of the countdown. */
  for (const [vh, ys] of [[812, [0, 48]], [667, [0, 48, 92, 95]]] as const) {
    for (const y of ys) {
      for (const atEnd of [false, true]) {
        assert.equal(litJumpMark(std(y), vh, atEnd), 'home', `${vh}: at y ${y} (atEnd ${atEnd}) the countdown is the first screen`);
      }
    }
  }
  /* Scrolled past Home (its mark a quarter screen above the top): the ordinary rules — Story crossed the line, or the
     page's end shows it. */
  const past = 48 + Math.ceil(812 * HOME_PASSED) + 1;
  assert.equal(litJumpMark(std(past, 48, past + 100), 812), 'story');
  assert.equal(litJumpMark(std(past, 48, past + 600), 812, true), 'story', 'at the end, past Home, the lowest mark on screen');
  assert.equal(litJumpMark(std(past, 48, past + 600), 812, false), 'home', 'past Home but nothing crossed yet');
  assert.equal(HOME_PASSED, LIT_LINE, 'Home is passed at the same quarter screen the other marks cross');
});

test('2 · the Invitation (4,287 px) still lights Details and Story by scrolling', () => {
  const vh = 812;
  const at = (y: number) => [
    { key: 'home', top: 764 - y },
    { key: 'details', top: 1431 - y },
    { key: 'story', top: 3354 - y },
  ];
  assert.equal(litJumpMark(at(0), vh), 'home');
  assert.equal(litJumpMark(at(764), vh), 'home', 'a tap on Home');
  assert.equal(litJumpMark(at(1431 - vh * LIT_LINE), vh), 'details');
  assert.equal(litJumpMark(at(3354 - vh * LIT_LINE), vh), 'story');
});

test('3 · a tapped mark stays lit until the guest moves the page — bar and rail', () => {
  const BAR = src('_components', 'site-menu-bar.tsx');
  assert.match(BAR, /setSpied\(pinnedRef\.current \?\? litJumpMark\(/, 'the spy does not honour a tapped mark');
  assert.match(BAR, /const GESTURES = \['wheel', 'touchstart', 'keydown'\] as const;/, 'the guest’s own gestures do not unpin');
  assert.match(BAR, /for \(const g of GESTURES\) window\.addEventListener\(g, unpin, \{ passive: true \}\);/);
  assert.match(BAR, /for \(const g of GESTURES\) window\.removeEventListener\(g, unpin\);/, 'the gesture listeners leak');
  assert.equal(BAR.match(/onClick=\{\(\) => pinMark\(slot\.key\)\}/g)?.length, 1, 'the bar’s link does not pin');
  assert.equal(BAR.match(/onClick=\{isCamera \? undefined : \(\) => pinMark\(slot\.key\)\}/g)?.length, 1, 'the rail’s link does not pin');
  assert.match(BAR, /if \(!marks\.some\(\(m\) => m\.key === key\)\) return;/, 'a tab that is a page is pinned as a mark');
});
