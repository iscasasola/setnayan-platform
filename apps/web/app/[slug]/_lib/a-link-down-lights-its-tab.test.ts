/**
 * 👆 A LINK DOWN THE PAGE LIGHTS ITS TAB AT ONCE (live walk 2026-11-01, /maria-and-jose at 390 × 844).
 *
 * Tapping the cover's "the day, the details ↓" put Details on screen while the bottom bar kept HOME lit until the
 * guest's next scroll. Measured on production after the tap: `#site-home` −178 px, `#site-details` 96 px. Home's
 * section there is only 274 px, so the jump leaves Home's mark short of the `HOME_PASSED` quarter (−211 px at 844),
 * and `litJumpMark` — correctly, by its own rule — keeps Home. A tap on the BAR's Details never had the lag: it pins
 * its mark (`pinMark`). The cover's link is a plain `<a href="#site-details">` and pinned nothing.
 *
 * Held here:
 *   1 · `markForInPageHref` maps any in-page href to the mark it names, and nothing else to one;
 *   2 · the bar pins whatever mark a link on the page names — a document click listener calling it, which sets the
 *       pin AND the lit item, and is removed with the rest of the spy;
 *   3 · the measured geometry really does need the pin (the spy alone lights Home there) — so this test would go
 *       stale, and say so, if the Home rule itself changed.
 *
 * Sabotage (2026-11-01): remove `document.addEventListener('click', onLinkClick)` from `site-menu-bar.tsx` → 1 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { litJumpMark, markForInPageHref } from './jump-marks';

const BAR = stripComments(readFileSync(join(process.cwd(), 'app', '[slug]', '_components', 'site-menu-bar.tsx'), 'utf8'));
const MARKS = [
  { key: 'home', href: '#site-home' },
  { key: 'details', href: '#site-details' },
  { key: 'story', href: '#site-story' },
];

test('1 · an in-page href names its mark; anything else names none', () => {
  assert.equal(markForInPageHref('#site-details', MARKS), 'details');
  assert.equal(markForInPageHref('#site-story', MARKS), 'story');
  for (const other of ['#', '#top', '/maria-and-jose#site-details', 'https://x/#site-details', '', null, undefined]) {
    assert.equal(markForInPageHref(other, MARKS), null, `${String(other)} is not a link to a mark`);
  }
});

test('2 · the bar pins the mark any link on the page names, at the tap', () => {
  const listen = BAR.indexOf("document.addEventListener('click', onLinkClick)");
  assert.ok(listen >= 0, 'site-menu-bar.tsx no longer listens for taps on in-page links — the cover link stops lighting Details');
  const handler = BAR.slice(BAR.indexOf('const onLinkClick'), listen);
  assert.match(handler, /closest\('a\[href\^="#"\]'\)/, 'the listener must find the tapped link, even when the tap lands on its inner words');
  assert.match(handler, /markForInPageHref\(/, 'the listener must ask markForInPageHref which mark the link names');
  assert.match(handler, /pinnedRef\.current = key;\s*setSpied\(key\);/, 'a link to a mark must pin it and light it, like a bar tap');
  assert.match(BAR, /document\.removeEventListener\('click', onLinkClick\)/, 'the listener must be removed with the spy');
  /* The pin is released by the same gestures as a bar tap — and a tap's touchstart (unpin) precedes its click (pin). */
  assert.match(BAR, /const GESTURES = \['wheel', 'touchstart', 'keydown'\] as const;/);
});

test('3 · the measured geometry needs the pin — the spy alone keeps Home lit there', () => {
  const vh = 844;
  const afterTap = [
    { key: 'home', top: -178 },
    { key: 'details', top: 96 },
    { key: 'story', top: 1255 },
  ];
  assert.equal(
    litJumpMark(afterTap, vh),
    'home',
    'the spy now lights Details here on its own — the pin may no longer be needed; re-walk before removing it',
  );
});
