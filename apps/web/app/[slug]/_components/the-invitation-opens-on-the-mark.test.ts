/**
 * THE INVITATION OPENS ON THE MARK — owner, 2026-09-20, reading his own page:
 * "it starts with the logo like when you enter a place you see their logo on
 * their building."
 *
 * An identified guest used to meet a box about THEMSELVES first, with the
 * couple's monogram a screen and a half below. This pins the order the whole
 * arrival design rests on: the hero, then anything personal.
 *
 * ⚠ ORDER IS THE WHOLE POINT, so this reads POSITIONS in the source rather
 * than asking whether each thing exists. A test that only asks "is the guest
 * card mounted?" passes just as happily with it back on top, which is the one
 * state this exists to forbid.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, 'site-body.tsx'), 'utf8');

/** The index of the guest branch's own copy of a mount, not the anonymous tree's. */
function guestBranchIndex(needle: string): number {
  // The anonymous tree renders its own masthead earlier in the file; the guest
  // branch is the one that mounts <GuestChecklist>, so anchor every lookup
  // after the last hero that precedes it. (It anchored on <GuestHubCard>, then
  // <KeepOnHomeScreen>, until 2026-09-30, when the owner removed both; then on
  // <GuestAccountCard>, until 2026-10-03, when "Save to my account" became
  // Me's alone — owner: one place per control.)
  const guestCard = SRC.indexOf('<GuestChecklist');
  assert.ok(guestCard > 0, 'precondition: the guest branch mounts its first personal card');
  const at = SRC.lastIndexOf(needle, guestCard);
  return at >= 0 ? at : SRC.indexOf(needle, guestCard);
}

test('the hero runs BEFORE the guest’s first personal card', () => {
  const hero = guestBranchIndex("plan.body === 'normal' && plan.heroShouldRender");
  const card = SRC.indexOf('<GuestChecklist');
  assert.ok(hero > 0, 'precondition: found the hero in the guest branch');
  assert.ok(
    hero < card,
    'the monogram, names and date must render before anything about the reader',
  );
});

test('everything personal sits below the hero, not just the status card', () => {
  const hero = guestBranchIndex("plan.body === 'normal' && plan.heroShouldRender");
  // `<GuestAccountCard` replaced the `showClaimAccountCta &&` claim box on
  // 2026-09-25 (the ONE account prompt) — same slot, same property.
  // `<KeepOnHomeScreen` left this list 2026-09-30: the owner removed the card
  // from the Event Hub outright (the-event-hub-has-no-home-screen-card.test.ts);
  // `<GuestHubCard` left it the same day (the Digital ticket moved onto Me).
  for (const personal of ['<GuestChecklist']) {
    const at = SRC.indexOf(personal, hero);
    assert.ok(at > hero, `${personal} renders after the hero`);
  }
  /* ⚠ MECHANISM CHANGED 2026-10-08 (owner, DECISION_LOG "EIGHT OWNER ANSWERS" answer 5 — the guest's pages follow
     the Maker's filing: their table is Me's). THE PROPERTY IS UNCHANGED AND ASSERTED HARDER, exactly as for the
     salutation below: the table is written ONCE as `seatBlock` and mounted in one of two slots (inside Me, or where
     it stood for a reader whose bar has no Me), so its DECLARATION sits above the hero in source order. A
     declaration is not a mount — every MOUNT is measured, and counted. */
  const seatMounts = [...SRC.matchAll(/group\(seatTab, seatBlock,|\{tableOnMe \? seatBlock : null\}/g)];
  assert.equal(seatMounts.length, 2, `the table has exactly two slots (found ${seatMounts.length})`);
  for (const m of seatMounts) assert.ok((m.index ?? -1) > hero, 'every slot the table can render in sits below the mark');
  assert.equal(SRC.split('const seatBlock = seatMap ? (').length - 1, 1, 'the table is declared exactly once, and still only where there is a plan to draw');
});

test('a shared phone does not announce the reader before the couple', () => {
  // The greeting names the guest. It may stay where it is — inside the body,
  // well below the hero — but it must never climb above it.
  const hero = guestBranchIndex("plan.body === 'normal' && plan.heroShouldRender");

  /* ⚠ MECHANISM CHANGED 2026-09-20 (arrival board "5 · On the day"). THE
     PROPERTY IS UNCHANGED AND IS NOW ASSERTED HARDER — this was not relaxed to
     go green.

     The salutation is written ONCE as `greetingBlock` and mounted in one of two
     slots, because on the wedding day it steps back behind the programme and
     the pass. Its DECLARATION therefore sits above the hero in source order,
     and the old `SRC.indexOf('plan.greetingShouldRender')` — the FIRST mention
     anywhere in the file — read that as the salutation climbing above the mark.
     It had not moved a pixel; a declaration is not a mount.

     So this now measures every MOUNT and counts them. That forbids strictly
     more than one index ever could: a single index cannot notice a second slot
     appearing above the hero, and cannot notice a slot being dropped. */
  const mounts = [
    ...SRC.matchAll(/\{dayOfLead\.greetingStepsBack \? (?:null : greetingBlock|greetingBlock : null)\}/g),
  ];
  assert.equal(mounts.length, 2, `the salutation has exactly two slots (found ${mounts.length})`);
  for (const m of mounts) {
    assert.ok(
      (m.index ?? -1) > hero,
      'every slot the salutation can render in sits below the mark',
    );
  }

  // Written once, and still gated on the editor's own visibility flag.
  assert.equal(
    SRC.split('const greetingBlock = plan.greetingShouldRender ? (').length - 1,
    1,
    'the salutation is declared exactly once, and still honours plan.greetingShouldRender',
  );
});

test('nothing was dropped in the move', () => {
  // The reorder is a move, not a rewrite: each mount still appears exactly once
  // in the guest branch.
  for (const mount of ['<GuestChecklist', '<YourSeatBlock']) {
    const count = SRC.split(mount).length - 1;
    assert.equal(count, 1, `${mount} appears once (found ${count})`);
  }
  // …and the account card that left for Me (2026-10-03) is not back.
  assert.equal(SRC.split('<GuestAccountCard').length - 1, 0, 'a second "Save to my account" card is back on the page');
  // …and the status card the owner removed (2026-09-30) is not back.
  assert.equal(SRC.split('<GuestHubCard').length - 1, 0, 'the "Hi again · Your invitation summary" card is mounted again');
});
