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
  // branch is the one that mounts <GuestHubCard>, so anchor every lookup after
  // the last hero that precedes it.
  const guestCard = SRC.indexOf('<GuestHubCard');
  assert.ok(guestCard > 0, 'precondition: the guest branch mounts the status card');
  const at = SRC.lastIndexOf(needle, guestCard);
  return at >= 0 ? at : SRC.indexOf(needle, guestCard);
}

test('the hero runs BEFORE the guest’s own status card', () => {
  const hero = guestBranchIndex("plan.body === 'normal' && plan.heroShouldRender");
  const card = SRC.indexOf('<GuestHubCard');
  assert.ok(hero > 0, 'precondition: found the hero in the guest branch');
  assert.ok(
    hero < card,
    'the monogram, names and date must render before anything about the reader',
  );
});

test('everything personal sits below the hero, not just the status card', () => {
  const hero = guestBranchIndex("plan.body === 'normal' && plan.heroShouldRender");
  for (const personal of ['<GuestHubCard', '<KeepOnHomeScreen', 'showClaimAccountCta &&']) {
    const at = SRC.indexOf(personal, hero);
    assert.ok(at > hero, `${personal} renders after the hero`);
  }
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
  for (const mount of ['<GuestHubCard', '<KeepOnHomeScreen']) {
    const count = SRC.split(mount).length - 1;
    assert.equal(count, 1, `${mount} appears once (found ${count})`);
  }
});
