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

test('🚨 …and it is shown exactly while the dates are UNSET', () => {
  assert.ok(
    /!windowIsSet\s*\?/.test(aboveTheWaysIn()),
    'the do-this-first card is no longer gated on `!windowIsSet` — it would nag a couple who already picked their dates',
  );
});

test('🚨 the picker is never on screen twice at once', () => {
  // Two mounts is correct — one above the ways in while unset, one in the
  // settings rows for editing a window that already exists. What must never
  // happen is both rendering together, which is what an ungated second mount
  // would do.
  const mounts = SRC.split('<PapicWindowPicker').length - 1;
  assert.equal(mounts, 2, `expected exactly 2 mounts (unset + edit), found ${mounts}`);
  const belowTheAsk = SRC.slice(SRC.indexOf(WAYS_IN));
  assert.ok(
    /\{windowIsSet \?[\s\S]{0,600}?<PapicWindowPicker/.test(belowTheAsk),
    'the settings-row picker is not gated on `windowIsSet` — with the card above also showing, a couple sees two identical date pickers on one page',
  );
});

test('the card says what it is for, in words a person can act on', () => {
  const above = aboveTheWaysIn();
  assert.ok(
    above.includes('When can your cameras shoot?'),
    'the card lost its question — a prompt with no question is just another box',
  );
  // ⚠ JUDGE ONLY WHAT RENDERS. A first cut matched the whole JSX block and
  // flagged `papic_window_start` — a PROP NAME, never on screen. A guard that
  // cannot tell an attribute from a sentence cries wolf, and this repo has
  // already learned that a guard which cries wolf teaches you to skim past the
  // one time it is right.
  const visible = above
    .replace(/<[^>]*>/g, ' ')        // drop every tag, attributes and all
    .replace(/\{[\s\S]*?\}/g, ' ')  // drop JSX expressions
    .replace(/\s+/g, ' ');
  const jargon = /megapixel|\bMP\b|papic_[a-z_]+|r2_|_r2|windowIsSet/i.exec(visible);
  assert.equal(
    jargon,
    null,
    `internal names or storage jargon reached the card a customer reads: ${jargon?.[0]}`,
  );
});
