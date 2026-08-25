/**
 * GUARD — the one thing a couple MUST do is in the room they land in.
 *
 * Owner, opening his own wedding's Papic page: *"entering papic inside an event
 * needs to me simpler and better to manage. if I am a customer and I see this,
 * I will be confused."*
 *
 * 🚨 THE ROOMS FILE ALREADY CLAIMED THIS WAS TRUE. `resolvePapicRoom` sends a
 * couple with no capture window to Set up, and says why: *"Unset means Set up,
 * where the attention row is."* **There was no attention row.** The capture
 * window picker's only mount was inside Cameras & shots — a room a new couple
 * never lands in — so the single thing standing between them and a working
 * camera sat in the one place they could not see it.
 *
 * 🔢 Measured 2026-08-26: all five production events have `papic_window_start`
 * NULL, so EVERY couple who has ever opened Papic landed in a room that could
 * not tell them what to do. This was not an edge case; it was the only case.
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

/** Everything the page renders BEFORE it starts branching on which room it is. */
function aboveTheRooms(): string {
  const start = SRC.indexOf('<StatusBanners');
  const firstRoom = SRC.indexOf("{room === '");
  assert.ok(start > 0, 'StatusBanners is gone — this guard has lost its anchor');
  assert.ok(firstRoom > start, 'no room branch found after StatusBanners — the page shape changed');
  return SRC.slice(start, firstRoom);
}

test('the page still HAS rooms — otherwise every rule here is vacuous', () => {
  const branches = SRC.split("{room === '").length - 1;
  assert.ok(branches >= 3, `expected 3 room branches, found ${branches}`);
});

test('🚨 the capture-window picker renders ABOVE the rooms, not inside one', () => {
  assert.ok(
    aboveTheRooms().includes('<PapicWindowPicker'),
    'the window picker is only mounted inside a room again. A couple with no dates set lands in ' +
      'a room chosen for them; if the picker is not above the branch, the one required act is ' +
      'invisible to whoever did not guess the right tab.',
  );
});

test('🚨 …and it is shown exactly while the dates are UNSET', () => {
  const above = aboveTheRooms();
  assert.ok(
    /!windowIsSet\s*\?/.test(above),
    'the do-this-first card is no longer gated on `!windowIsSet` — it would nag a couple who already picked their dates',
  );
});

test('🚨 the picker is never on screen twice at once', () => {
  // Two mounts is correct — one above the rooms while unset, one inside Cameras
  // for editing a window that already exists. What must never happen is both
  // rendering together, which is what an ungated second mount would do.
  const mounts = SRC.split('<PapicWindowPicker').length - 1;
  assert.equal(mounts, 2, `expected exactly 2 mounts (unset + edit), found ${mounts}`);
  const roomMount = SRC.slice(SRC.indexOf("{room === 'cameras'"));
  assert.ok(
    /\{windowIsSet \?[\s\S]{0,400}?<PapicWindowPicker/.test(roomMount),
    'the in-room picker is not gated on `windowIsSet` — with the card above also showing, a couple sees two identical date pickers on one page',
  );
});

test('the card says what it is for, in words a person can act on', () => {
  const above = aboveTheRooms();
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
