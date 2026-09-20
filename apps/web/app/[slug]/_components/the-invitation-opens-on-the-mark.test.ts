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
  const greeting = SRC.indexOf('plan.greetingShouldRender');
  assert.ok(greeting > hero, 'the salutation stays below the mark');
});

test('nothing was dropped in the move', () => {
  // The reorder is a move, not a rewrite: each mount still appears exactly once
  // in the guest branch.
  for (const mount of ['<GuestHubCard', '<KeepOnHomeScreen']) {
    const count = SRC.split(mount).length - 1;
    assert.equal(count, 1, `${mount} appears once (found ${count})`);
  }
});
