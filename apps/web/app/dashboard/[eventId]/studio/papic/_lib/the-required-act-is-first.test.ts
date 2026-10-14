/**
 * GUARD — the one thing a couple MUST do is the first thing on the page.
 *
 * Owner, opening his own wedding's Papic page: *"entering papic inside an event
 * needs to me simpler and better to manage. if I am a customer and I see this,
 * I will be confused."*
 *
 * 🚨 THE ROOMS FILE ONCE CLAIMED THIS WAS TRUE. `resolvePapicRoom` sent a couple
 * with no capture window to Set up, and said why: *"Unset means Set up, where
 * the attention row is."* **There was no attention row.** The capture-window
 * picker's only mount was inside Cameras & shots — a room a new couple never
 * landed in — so the single thing standing between them and a working camera sat
 * in the one place they could not see it.
 *
 * 🔢 Measured 2026-08-26, and STILL TRUE when re-measured 2026-08-27: all five
 * production events have `papic_window_start` NULL. So EVERY couple who has ever
 * opened Papic met this state. It was never an edge case; it is the only case.
 *
 * ⚠ THE ROOMS ARE GONE (2026-08-27 — one page, four ways in) AND THIS GUARD IS
 * NOT. The rule no longer needs the word "room": the required act must be above
 * the four ways in, because a person who has not set their dates has no working
 * way in at all. Same defect, stated against the page that exists now.
 *
 * 🔑 A SENTENCE IS NOT A MECHANISM. A docblock asserting that another part of
 * the page does something is worth nothing until something checks. That is the
 * whole reason this file exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE = join(dirname(dirname(fileURLToPath(import.meta.url))), 'page.tsx');
const SRC = readFileSync(PAGE, 'utf8');

const WAYS_IN = 'Four ways into your library';

/** Everything the page renders BEFORE the four ways in. */
function aboveTheWaysIn(): string {
  const start = SRC.indexOf('<StatusBanners');
  const waysIn = SRC.indexOf(WAYS_IN);
  assert.ok(start > 0, 'StatusBanners is gone — this guard has lost its anchor');
  assert.ok(waysIn > start, `"${WAYS_IN}" not found after StatusBanners — the page shape changed`);
  return SRC.slice(start, waysIn);
}

test('the page still HAS the ways-in section — otherwise every rule here is vacuous', () => {
  assert.ok(SRC.includes(WAYS_IN), 'the four ways in are gone; this guard would pass on nothing');
  assert.ok(aboveTheWaysIn().length > 500, 'the region above the ways in came back suspiciously short');
});

test('🚨 the three tabs never come back', () => {
  // The tabs are what this redesign replaced. A `?tab=` link still resolves —
  // old bookmarks must not break — but nothing may render a room switcher again.
  assert.ok(!/room === '/.test(SRC), 'a room branch is back on the Papic page');
  assert.ok(!/PAPIC_ROOM_TABS/.test(SRC), 'the room tab strip is back on the Papic page');
});

test('🚨 the capture-window picker renders ABOVE the ways in, not inside one', () => {
  assert.ok(
    aboveTheWaysIn().includes('<PapicWindowPicker'),
    'the window picker moved below the ways in. A couple with no dates set has no working way ' +
      'into their library at all, so the ask must come before the list of doors.',
  );
});

/*
  📸 OWNER 2026-10-13 (DECISION_LOG "📸 OWNER — PAPIC: … ON 6 MONTHS BEFORE"): THE
  REQUIRED ACT IS GONE, AND THESE THREE TESTS SAY SO INSTEAD OF DEFENDING IT.

  The window was never really unset — `resolveStoredWindow` has returned the
  automatic 6-month window since the one-day default was fixed — so "Do this
  first · When can your cameras shoot? Nothing can be captured until you pick
  the days" told every couple something false. The picker now has ONE mount,
  behind a quiet "Change dates" row, and the page says when the cameras are on
  in words. (`lib/papic-window-is-automatic.test.ts` holds the words.)
*/
test('🚨 no "do this first" gate is left — the window is automatic', () => {
  assert.ok(
    !/\{!windowIsSet\s*\?/.test(SRC),
    'a `!windowIsSet ?` branch is back — the page would ask for dates the cameras already have',
  );
});

test('🚨 the picker is mounted exactly ONCE — behind "Change dates"', () => {
  const mounts = [...SRC.matchAll(/<PapicWindowPicker/g)].map((m) => m.index!);
  assert.equal(mounts.length, 1, `expected exactly 1 mount, found ${mounts.length} — two pickers on one page is the old failure`);
  const before = SRC.slice(Math.max(0, mounts[0]! - 600), mounts[0]!);
  assert.match(before, /<SettingRow[\s\S]*label="Change dates"[\s\S]*sheetTitle="Change dates"/, 'the picker is no longer behind the quiet "Change dates" row');
});

test('the row says when the cameras are on, in words a person can act on', () => {
  const row = SRC.slice(SRC.indexOf('label="Change dates"') - 300, SRC.indexOf('label="Change dates"') + 200);
  assert.match(row, /value=\{papicWindowWords\}/, 'the dates row no longer shows the window in words');
  assert.match(SRC, /'Papic turns on' : 'On from'/);
});
