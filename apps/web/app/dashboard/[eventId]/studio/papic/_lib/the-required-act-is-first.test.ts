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

/*
  📷 2026-10-23 (owner, PR-B): THE PAGE IS THE CAMERA — `PapicCameraSettings`, the one component the Papic page and
  Home's Papic card both draw. The ways in became Memories' albums, so the rule is stated against what exists now: the
  dates are the FIRST topic (on Papic's own line, with its switch), above the credits and everything else.
*/
const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const PAGE_SRC = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');
const SRC = readFileSync(join(PAPIC, '_components', 'papic-camera-settings.tsx'), 'utf8');

test('the page draws the camera settings — otherwise every rule here is vacuous', () => {
  assert.match(PAGE_SRC, /<PapicCameraSettings\b/, 'the Papic page no longer draws the camera settings');
  assert.ok(SRC.includes('data-papic-counter=""'), 'the credits counter is gone; the order rule would pass on nothing');
});

test('🚨 the three tabs never come back', () => {
  for (const src of [PAGE_SRC, SRC]) {
    assert.ok(!/room === '/.test(src), 'a room branch is back on the Papic page');
    assert.ok(!/PAPIC_ROOM_TABS/.test(src), 'the room tab strip is back on the Papic page');
  }
});

test('🚨 the dates come FIRST — above the credits and every other topic', () => {
  const picker = SRC.indexOf('<PapicWindowPicker');
  const credits = SRC.indexOf('data-papic-counter=""');
  assert.ok(picker > 0 && picker < credits, 'the dates moved below the credits — the cameras’ days are the first thing set');
});

/*
  📸 OWNER 2026-10-13: the window is automatic (`resolveStoredWindow`, 6 months before), so there is no "do this
  first" gate — the dates sit behind a quiet "Change dates" and are said in words (`lib/papic-window-is-automatic.test.ts`).
*/
test('🚨 no "do this first" gate is left — the window is automatic', () => {
  for (const src of [PAGE_SRC, SRC]) {
    assert.ok(!/\{!windowIsSet\s*\?/.test(src), 'a `!windowIsSet ?` branch is back — the page would ask for dates the cameras already have');
  }
});

test('🚨 the picker is mounted exactly ONCE — behind "Change dates"', () => {
  assert.equal([...PAGE_SRC.matchAll(/<PapicWindowPicker/g)].length, 0, 'a second picker is on the Papic page');
  const mounts = [...SRC.matchAll(/<PapicWindowPicker/g)].map((m) => m.index!);
  assert.equal(mounts.length, 1, `expected exactly 1 mount, found ${mounts.length} — two pickers on one page is the old failure`);
  const before = SRC.slice(Math.max(0, mounts[0]! - 600), mounts[0]!);
  assert.match(before, /<SettingRow[\s\S]*sheetTitle="Change dates"/, 'the picker is no longer behind the quiet "Change dates" row');
});

test('the row says when the cameras are on, in words a person can act on', () => {
  const at = SRC.indexOf('sheetTitle="Change dates"');
  assert.match(SRC.slice(at - 300, at), /value=\{windowWords\}/, 'the dates row no longer shows the window in words');
});
