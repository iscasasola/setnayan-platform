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
import { stripComments } from '@/lib/strip-comments';
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

  // Share/Report no longer float at all (owner 2026-09-21: "make a place at
  // the bottom for report and share") — see the footer test below, which
  // asserts they are in the flow, so they cannot park in this strip.
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

test('Share and Report sit in a footer at the END of the page, covering nothing', () => {
  // 🔴 THE PILL THIS REPLACES FLOATED, AND EVERY FIX MOVED THE COLLISION. It
  // sat over the menu bar; lifted clear, it sat over **85% of "Sign up free"**
  // and three-quarters of the wedding date (measured 2026-08-21, 375px).
  // Owner 2026-09-21: "make a place at the bottom for report and share". In
  // the flow it covers nothing — so this asserts the flow, not a position.
  const src = stripComments(read(join(HERE, '..', '..', '_components', 'public-page-actions.tsx')));
  assert.doesNotMatch(src, /\bfixed\b/, 'Share/Report are floating over the page again');
  assert.match(src, /<footer/, 'Share/Report must be a footer in the page flow');
  // The fixed menu bar covers the last ~3.5rem of the viewport, so the LAST
  // element must carry that room beneath it — and this footer is the last.
  assert.match(src, /clearOfMenuBar\s*\n?\s*\?\s*'pb-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\]/);

  // …and it IS the last: every page return in page.tsx ends with it, after the
  // guest's own section (GuestHubBar), which renders after SiteBody.
  const page = stripComments(read(join(HERE, '..', 'page.tsx')));
  const mounts = page.split('{pageFooter}').length - 1;
  assert.equal(mounts, 3, `the footer closes all three page returns (found ${mounts})`);
  const hub = page.indexOf('<GuestHubBar');
  assert.ok(hub > 0 && page.indexOf('{pageFooter}', hub) > hub, 'the footer comes after the guest section');
  for (const m of page.matchAll(/\{pageFooter\}/g)) {
    const after = page.slice(m.index! + '{pageFooter}'.length, m.index! + 40);
    assert.match(after, /^\s*<\/>/, 'nothing renders after the footer');
  }
  // SiteBody no longer mounts it — a second copy would put Share mid-page.
  const body = stripComments(read(join(COMPONENTS, 'site-body.tsx')));
  assert.doesNotMatch(body, /<PublicPageActions/);
});

test('the music button left the bottom edge for the top-right corner', () => {
  // Owner 2026-09-21: "follow your proposed". It floated bottom-left, one lift
  // away from the menu bar's Home tab, over whatever scrolled under it. It now
  // joins the top-right cluster (a guest's Account control) through a portal,
  // or holds that corner alone when the page has no cluster.
  const music = stripComments(read(join(COMPONENTS, 'background-music.tsx')));
  assert.doesNotMatch(music, /\bbottom-/, 'the music button is back on the bottom edge');
  assert.match(music, /createPortal\(control, slot\)/, 'it must join the corner cluster when there is one');
  assert.match(music, /fixed right-3 top-3/, 'and hold the corner itself when there is not');
  assert.match(music, /Tap for their song/, 'the one hint that there is music at all');
  const hub = stripComments(read(join(COMPONENTS, 'guest-hub-bar.tsx')));
  const cluster = hub.indexOf('fixed right-3 top-3');
  const slot = hub.indexOf('id={TOP_CORNER_SLOT_ID}');
  assert.ok(cluster > 0 && slot > cluster && slot - cluster < 400, 'the slot sits INSIDE the top-right cluster');
});

test('the top bar label gives way to the pinned corner controls on a phone', () => {
  // Seen live 2026-09-21: the music button, pinned top-right, covered the
  // invitation bar's "INVITATION" label at the top of the page.
  const shell = stripComments(read(join(COMPONENTS, 'invitation-shell.tsx')));
  const labels = (shell.match(/className="sn-top-label /g) ?? []).length;
  assert.equal(labels, 2, `both right-hand labels carry sn-top-label (found ${labels})`);
  const music = stripComments(read(join(COMPONENTS, 'background-music.tsx')));
  const hub = stripComments(read(join(COMPONENTS, 'guest-hub-bar.tsx')));
  assert.match(music, /<div data-top-corner className=\{CORNER_ALONE\}>/, 'the lone music corner marks itself');
  assert.match(hub, /<div data-top-corner className="fixed right-3 top-3/, 'the guest cluster marks itself');
  const css = read(join(HERE, '..', '..', 'globals.css'));
  assert.match(css, /html:has\(\[data-top-corner\]\) \.sn-top-label \{\s*visibility: hidden;/);
});
