/**
 * keep-the-tap-in-place.test.ts — opening one thing shuts another ABOVE it; the tapped thing must not jump away.
 *
 * 🔴 Owner, iPhone, live card maker, 2026-11-04: "i keep going to this blank slate. when i first clicked inclusions and
 * now schedule." Reproduced in Playwright WebKit 390×844 on /dev/card-maker-lab: with "What's included" open, a tap on
 * the Schedule menu shut it (ONE OPEN AT A TIME), the Schedule row jumped ~236 px up and off the finger, the screen
 * showed the white below the form, and the menu floated where the button used to be. Safari has no scroll anchoring.
 *
 * No DOM in this runner: the arithmetic runs for real; the wiring is read from the source, comments stripped.
 * Sabotage (2026-11-04): `if (shut.length > 0) keepTheTapInPlace();` removed → "ONE OPEN keeps the tap" red;
 * the resize dispatch removed → "a menu … is told the page moved" red. Both restored green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { scrollToKeep, KEEP_IN_PLACE_MS, keepTheTapInPlace } from '@/lib/keep-the-tap-in-place';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('scroll back by exactly how far the tapped element moved; sub-pixel noise is not a move', () => {
  assert.equal(scrollToKeep(648, 412), -236, 'a fold shut above: scroll UP by its height');
  assert.equal(scrollToKeep(300, 340), 40);
  assert.equal(scrollToKeep(300, 300.3), 0);
});

test('it outlasts the fold’s height move (700 ms)', () => {
  assert.ok(KEEP_IN_PLACE_MS >= 750);
});

test('no DOM, no tap → it does nothing (server render, keyboard opens)', () => {
  assert.doesNotThrow(() => keepTheTapInPlace());
});

test('ONE OPEN keeps the tap in place — measured BEFORE the peers shut, only when one does', () => {
  const src = read('lib/one-open.ts');
  const fn = src.slice(src.indexOf('export function announceOpen'), src.indexOf('export function joinOneOpen'));
  const keep = fn.indexOf('if (shut.length > 0) keepTheTapInPlace();');
  const close = fn.indexOf('for (const o of shut) o.close();');
  assert.ok(keep > 0, 'ONE OPEN no longer keeps the tapped control in place — Safari jumps to a blank screen again');
  assert.ok(close > keep, 'the position is read after the peers already shut — too late to know how far it moved');
  assert.match(src, /rememberTaps\(\);/, 'nothing listens for the tap');
});

test('a menu placed against the tapped control is told the page moved (PickMenu re-places on resize)', () => {
  // Not an observer inside PickMenu: that file must stay under its inlined-size budget (pick-menu-stays-inline.test.ts).
  const keep = read('lib/keep-the-tap-in-place.ts');
  assert.match(keep, /window\.dispatchEvent\(new Event\('resize'\)\);/, 'an open menu is left floating where its button was');
  const menu = read('app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx');
  assert.match(menu, /window\.addEventListener\('resize', onMove\);/, 'PickMenu stopped re-placing on resize');
});
