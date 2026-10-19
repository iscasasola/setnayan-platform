/**
 * guest-group-role-pick.test.ts — 👥 what ONE tap means in the one Group dropdown and the one Role dropdown (owner
 * 2026-10-20: "there are 2 groups." · "Roles doesn't need also serves as… they can have multiple row in that Role in
 * Wedding" · "several group, several roles"; prototype `guest_group_and_fast_add_2026-10-20.html` A2 · A7).
 *
 * PROPERTIES, driven over every key of a real list (not a phrasing):
 *   · GROUP — after any tap exactly ONE standard key is ticked (group_category is one column); ticking another swaps it;
 *     an own group toggles; what is posted round-trips back to the same ticks.
 *   · ROLE — the first ticked is the main role; unticking it promotes the next; never empty (Guest); Guest is never an
 *     extra; a one-per-event role is never an extra.
 *
 * SABOTAGE (each seen RED, then restored): `tickGroup` toggling a standard key like an own one · `tickRole` appending a
 * one-per-event role as an extra · `splitRoles` posting the extras in reverse.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAIN_ROLE, splitGroup, splitRoles, tickGroup, tickRole } from './guest-group-role-pick';
import { SINGLETON_GUEST_ROLES } from './guests';

const STD = ['family', 'friends', 'work', 'school', 'officiant', 'other'];
const OWN = ['g-college', 'g-out-of-town', 'g-cebu', 'g-office'];
const ROLES = ['guest', 'bride_parents', 'maid_of_honor', 'matron_of_honor', 'best_man', 'bridesmaid', 'groomsman', 'principal_sponsor_ninang', 'candle_sponsor', 'veil_sponsor', 'wali', 'imam'];
const SOLO = SINGLETON_GUEST_ROLES as readonly string[];

test('GROUP: a standard key is one-of — ticking another swaps it, the own groups stay', () => {
  for (const a of STD) {
    for (const b of STD) {
      const start = [a, 'g-college', 'g-out-of-town'];
      const next = tickGroup(start, b, STD);
      assert.deepEqual(next.filter((k) => STD.includes(k)), [b], `${a} → ${b} leaves ${next.join(',')}`);
      assert.deepEqual(next.filter((k) => !STD.includes(k)), ['g-college', 'g-out-of-town'], 'an own group was dropped by a standard tick');
    }
  }
});

test('GROUP: an own group toggles, and every state posts and reads back the same ticks', () => {
  let picked = ['family'];
  for (const step of [...OWN, 'g-cebu', 'friends', 'g-college', ...OWN]) {
    picked = tickGroup(picked, step, STD);
    assert.equal(picked.filter((k) => STD.includes(k)).length, 1, 'not exactly one standard group');
    const [std, own] = splitGroup(picked, STD, OWN);
    assert.ok(STD.includes(std));
    const back = [std, ...own.split(',').filter(Boolean)];
    assert.deepEqual([...back].sort(), [...picked].sort(), 'the posted pair does not read back to the ticks');
    // Posted in the LIST's order — never the order they were tapped.
    assert.deepEqual(own.split(',').filter(Boolean), OWN.filter((k) => picked.includes(k)));
  }
  // An own group made here before the list re-read is still posted.
  assert.equal(splitGroup(['family', 'g-new'], STD, OWN)[1], 'g-new');
});

test('ROLE: the first ticked is main; unticking main promotes the next; never empty', () => {
  let picked = [PLAIN_ROLE];
  picked = tickRole(picked, 'principal_sponsor_ninang', SOLO);
  assert.deepEqual(picked, ['principal_sponsor_ninang'], 'a role ticked over plain Guest does not replace it');
  picked = tickRole(picked, 'candle_sponsor', SOLO);
  picked = tickRole(picked, 'veil_sponsor', SOLO);
  assert.deepEqual(splitRoles(picked), ['principal_sponsor_ninang', 'candle_sponsor,veil_sponsor']);
  picked = tickRole(picked, 'principal_sponsor_ninang', SOLO);
  assert.deepEqual(splitRoles(picked), ['candle_sponsor', 'veil_sponsor'], 'unticking the main did not promote the next');
  picked = tickRole(tickRole(picked, 'candle_sponsor', SOLO), 'veil_sponsor', SOLO);
  assert.deepEqual(picked, [PLAIN_ROLE], 'unticking everything is not plain Guest');
});

test('ROLE: over every tap sequence of a real list — Guest and a one-per-event role are never extras', () => {
  // Every sequence of three taps over the list: 12³ states.
  for (const a of ROLES) {
    for (const b of ROLES) {
      for (const c of ROLES) {
        const picked = tickRole(tickRole(tickRole([PLAIN_ROLE], a, SOLO), b, SOLO), c, SOLO);
        const [main, extras] = splitRoles(picked);
        const ex = extras.split(',').filter(Boolean);
        assert.ok(main, 'no main role');
        assert.equal(new Set(picked).size, picked.length, `a role is ticked twice: ${picked.join(',')}`);
        assert.ok(!ex.includes(PLAIN_ROLE), `Guest became an extra role: ${picked.join(',')}`);
        assert.ok(!ex.some((r) => SOLO.includes(r)), `a one-per-event role became an extra: ${picked.join(',')}`);
        if (picked.includes(PLAIN_ROLE)) assert.deepEqual(picked, [PLAIN_ROLE], `Guest sits beside other roles: ${picked.join(',')}`);
      }
    }
  }
});

test('ROLE: a stored role and its extras post back exactly as they are until the host taps', () => {
  // The card starts from [role, ...extra_roles] — the autosave must post that, untouched, on any OTHER field's save.
  for (const stored of [['guest'], ['guest', 'bridesmaid'], ['best_man', 'groomsman'], ['principal_sponsor_ninang', 'veil_sponsor', 'candle_sponsor']]) {
    assert.deepEqual(splitRoles(stored), [stored[0], stored.slice(1).join(',')]);
  }
});
