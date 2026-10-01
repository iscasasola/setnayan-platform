/**
 * 🔒 A PLUS-ONE WHO LINKED THEIR OWN ACCOUNT KEEPS THEIR OWN NAME (owner
 * 2026-09-29, DECISION_LOG "OWNER ANSWERS — TEN OPEN QUESTIONS" (10): *"To change
 * the name: if connected to an account, cannot change anymore"* — account
 * details win; the bringer and the host see it read-only, "Linked to their
 * account"; the "3 named · 1 allowed" host rule (#6151) stands).
 *
 * Pins the rule (executed), both server doors that write a plus-one's name
 * (the reply and the host's guest card), and both screens.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { LINKED_NAME_WORDS, lockLinkedSeatNames, type SeatNameOp } from './extra-seats';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the rule: a typed name for a linked seat keeps only its meal and dietary; every other op is untouched', () => {
  const ops: SeatNameOp[] = [
    { kind: 'name', seatId: 'linked', first: 'Bob', last: 'X', meal: 'fish' },
    { kind: 'name', seatId: 'free', first: 'Ana', last: 'Y' },
    { kind: 'create', first: 'New', last: 'Z' },
    { kind: 'details', seatId: 'linked', dietary: 'halal' },
  ];
  assert.deepEqual(lockLinkedSeatNames(ops, new Set(['linked'])), [
    { kind: 'details', seatId: 'linked', meal: 'fish' },
    { kind: 'name', seatId: 'free', first: 'Ana', last: 'Y' },
    { kind: 'create', first: 'New', last: 'Z' },
    { kind: 'details', seatId: 'linked', dietary: 'halal' },
  ]);
  assert.equal(LINKED_NAME_WORDS, 'Linked to their account');
});

test('🔒 the reply asks who is linked BEFORE it writes a plus-one’s name', () => {
  const a = read('app/[slug]/actions.ts');
  assert.match(a, /from\('event_members'\)\.select\('guest_id'\)\.eq\('event_id', eventId\)\.in\('guest_id', seatIds\)/);
  assert.match(a, /const ops = lockLinkedSeatNames\(planSeatNames\(seatNames, seats, plusOneSeats\(primary\)\), linkedSeats\)/, 'the reply can rename a linked plus-one');
  assert.match(a, /if \(linkedErr\) return \{ ok: false/, 'an unread link state lets a name through');
});

test('🔒 the host’s guest card leaves a linked plus-one’s name out of the write', () => {
  const a = read('app/dashboard/[eventId]/guests/[guestId]/actions.ts');
  assert.match(a, /\.\.\.\(nameLocked \? \{\} : \{ first_name, last_name, name_prefix, middle_name, name_suffix, display_name \}\)/);
  const fn = a.slice(a.indexOf('async function linkedNameLocked('));
  assert.match(fn, /if \(error\) return true;/, 'an unread row unlocks the name');
  assert.match(fn, /if \(mErr\) \{[^}]*return true;/, "an unread membership still locks the name — and says why");
});

test('both screens show it read-only: "Linked to their account", no name boxes', () => {
  const plus = read('app/[slug]/_components/rsvp-plus-ones.tsx');
  const at = plus.indexOf('{slot.linked ? (');
  assert.ok(at > -1, 'the reply draws a linked plus-one’s name as boxes');
  const locked = plus.slice(at, plus.indexOf(') : (', at));
  assert.match(locked, /LINKED_NAME_WORDS/);
  assert.doesNotMatch(locked, /plus_one_first_name_|plus_one_last_name_/, 'the locked name still posts');
  const card = read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  const c = card.slice(card.indexOf('{nameLocked ? ('), card.indexOf(') : (', card.indexOf('{nameLocked ? (')));
  assert.match(c, /nameLockWords/);
  assert.match(card, /: nameLinked \? LINKED_NAME_WORDS : null;/, 'a linked plus-one lost its "Linked to their account" words');
  assert.doesNotMatch(c, /<Field\b/, 'the host can still type over a linked name');
  for (const f of ['app/[slug]/_lib/loaders.ts', 'app/[slug]/_lib/plus-one-seats.server.ts']) {
    assert.match(read(f), /linked: linked\.has\(r\.guest_id as string\)/, `${f} does not carry who is linked`);
  }
});
