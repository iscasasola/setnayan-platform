/**
 * bottom-edge.test.ts — ONE bar owns the bottom of a guest's phone.
 *
 * WHY THIS EXISTS. Three components independently pinned themselves to the
 * bottom of the viewport on the same page:
 *
 *   GuestHubBar        fixed inset-x-0 bottom-0  z-40
 *   PublicEventDayBar  fixed inset-x-0 bottom-0  z-40
 *   SiteMenuBar        fixed inset-x-0 bottom-0  z-30
 *
 * and two more floated into the same 4rem strip (the share/report pill at
 * `bottom-4`, the music toggle at `bottom-5 z-50`). The higher z-index won, so
 * for a guest who opened their own invitation the five-tab menu was rendered,
 * hit-tested and completely untappable — Home, Camera and Me all covered. The
 * page that ships the navigation and the page that shows it were the same page.
 *
 * NOBODY SAW IT FOR A MONTH, and the reason is the more important half: the
 * menu was flag-dark plus always-on for `is_sample`, so it only ever rendered
 * on the demo wedding — the one event every verification pass was run against.
 * A real couple's guests got the old bar and no menu at all, so the two bars
 * never met anywhere a person was looking.
 *
 * These are source-text assertions on purpose. The defect is not in any one
 * component's logic — each is correct alone — it is in what happens when they
 * are composed, and composition is exactly what a unit test of either one
 * cannot see. Reading the source is how a test catches a fourth component
 * quietly claiming the same strip.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteMenuEnabled } from './site-menu';

// `new URL(...).pathname` percent-encodes the brackets in `[slug]`, so it must
// be fileURLToPath here or every read is ENOENT.
const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = join(HERE, '..', '_components');
const read = (p: string) => readFileSync(p, 'utf8');

/** Every component that pins itself to the bottom edge of the guest site. */
const BOTTOM_EDGE = [
  'guest-hub-bar.tsx',
  'public-event-day-bar.tsx',
  'site-menu-bar.tsx',
  'background-music.tsx',
] as const;

test('the two legacy bars give up the bottom edge when the menu renders', () => {
  for (const file of ['guest-hub-bar.tsx', 'public-event-day-bar.tsx']) {
    const src = read(join(COMPONENTS, file));
    assert.match(
      src,
      /menuOn\?: boolean/,
      `${file} must accept menuOn — without it the bar cannot know the menu is ` +
        `underneath it, and the menu is invisible to the guest.`,
    );
    // The fixed bottom nav must be inside a menuOn-negative branch. Both files
    // spell it as a guard immediately around the `<nav ... bottom-0 z-40>`.
    const bar = src.indexOf('fixed inset-x-0 bottom-0 z-40');
    assert.notEqual(bar, -1, `${file} no longer has the bar this test guards — update the test.`);
    const before = src.slice(0, bar);
    assert.ok(
      /menuOn \? null : \(/.test(before) || /const showBar = !menuOn/.test(before),
      `${file}'s fixed bottom bar is not gated on menuOn. Two bars at bottom-0 ` +
        `means the one with the higher z-index silently eats the other's taps.`,
    );
  }
});

test('nothing else parks inside the bar strip at bottom-4 or bottom-5', () => {
  // `bottom-4` (1rem) and `bottom-5` (1.25rem) both land INSIDE the bar's
  // 3.5rem + safe-area footprint. Anything that must float above the bar uses
  // the lifted offset instead.
  const lifted = 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]';
  const music = read(join(COMPONENTS, 'background-music.tsx'));
  assert.ok(
    music.includes(lifted),
    'The music toggle is back inside the bar strip. At z-50 it wins the tap, ' +
      'so the leftmost tab (Home) becomes a mute button on any page with music.',
  );

  const actions = read(join(HERE, '..', '..', '_components', 'public-page-actions.tsx'));
  assert.ok(
    actions.includes(lifted),
    'The share/report pill is back inside the bar strip — Share opens whatever ' +
      'tab is drawn over it.',
  );
  assert.match(
    actions,
    /aboveMenuBar/,
    'The pill must be told when a bar is present; it is used on pages that have none.',
  );
});

test('the bar reserves its own space, so the last thing on the page is reachable', () => {
  const src = read(join(COMPONENTS, 'site-menu-bar.tsx'));
  assert.match(
    src,
    /aria-hidden className="h-\[calc\(3\.5rem\+env\(safe-area-inset-bottom\)\)\]/,
    'The bar is `fixed`, so it covers the last 3.5rem of the document unless it ' +
      'adds that height back in normal flow. Without the spacer the foot of the ' +
      'page is untappable — for a visitor with no invitation that is "Open my ' +
      'invitation", the only control that gets them in.',
  );
});

test('exactly one element owns the #site-me anchor', () => {
  // The Me tab is an in-page anchor. When two elements carried the id, the
  // browser scrolled to the FIRST — which was an empty aria-hidden div — and
  // the real card below it was never reached.
  const body = read(join(COMPONENTS, 'site-body.tsx'));
  const hub = read(join(COMPONENTS, 'guest-hub-bar.tsx'));
  const guestTree = body.slice(body.indexOf('const guestTree'));
  assert.ok(
    !guestTree.includes('SITE_MENU_ANCHORS.me'),
    'The guest tree emits a #site-me element again. GuestHubBar renders the real ' +
      'Me section under the same condition, so this would be a duplicate id and ' +
      'the tab would land on whichever came first.',
  );
  assert.ok(
    hub.includes('id="site-me"'),
    'The guest Me section is gone. It carries the personal QR — what a guest ' +
      'holds up to be photographed — and "Photos of you", which is their own ' +
      'tagged roll and NOT the same destination as the menu\'s Gallery anchor.',
  );
});

test('the menu is on for a real event, not just the sample', () => {
  // The whole reason any of the above went unseen. `is_sample` is TRUE on one
  // row; if the menu needs a flag set to 'true' as well, then every real
  // wedding renders the legacy bar and none of this navigation exists for a
  // single guest. Off for every real event is staged, not shipped.
  assert.equal(
    siteMenuEnabled({ flag: undefined, isSample: false }),
    true,
    'A real event with no env var set must get the menu.',
  );
  assert.equal(
    siteMenuEnabled({ flag: 'false', isSample: false }),
    false,
    'The escape hatch must still switch it back off.',
  );
  assert.equal(
    siteMenuEnabled({ flag: 'false', isSample: true }),
    true,
    'The sample must not be switchable off by a stray env value.',
  );
});
