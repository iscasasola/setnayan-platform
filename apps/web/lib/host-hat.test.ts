import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextExtraRoles, planHostHatWrites, wearsHostHat } from './host-hat';
import type { GuestRole } from './guests';

const g = (guest_id: string, role: GuestRole, extra_roles: GuestRole[] | null) => ({
  guest_id,
  role,
  extra_roles,
});

test('the hat reads off either the primary role or an extra one', () => {
  assert.equal(wearsHostHat('host', null), true);
  assert.equal(wearsHostHat('guest', ['host']), true);
  assert.equal(wearsHostHat('bride_parents', ['host']), true);
  assert.equal(wearsHostHat('guest', []), false);
  assert.equal(wearsHostHat('guest', null), false);
});

test('turning it on adds nothing when it is already there', () => {
  assert.deepEqual(nextExtraRoles('guest', null, true), ['host']);
  assert.deepEqual(nextExtraRoles('guest', ['vip'], true), ['vip', 'host']);
  assert.equal(nextExtraRoles('guest', ['host'], true), null, 'a no-op must not queue a write');
  // Their role already IS Host; there is nothing to add.
  assert.equal(nextExtraRoles('host', null, true), null);
});

test('turning it off never demotes a guest whose ROLE is Host', () => {
  // ⚠ Removing the hat from somebody whose primary role is 'host' would have
  // to change WHAT THEY ARE. That is the role picker's job and a deliberate
  // act; this control only ever adds or removes the extra hat.
  assert.equal(nextExtraRoles('host', null, false), null);
  assert.deepEqual(nextExtraRoles('guest', ['host'], false), []);
  assert.deepEqual(nextExtraRoles('guest', ['vip', 'host'], false), ['vip']);
  assert.equal(nextExtraRoles('guest', ['vip'], false), null);
});

test('the primary role is never in the returned array', () => {
  // Seating keys on the PRIMARY role (iteration 0001). If this ever returned a
  // value that changed `role`, marking a host would move their table.
  const next = nextExtraRoles('bride_parents', ['vip'], true);
  assert.deepEqual(next, ['vip', 'host']);
  assert.ok(!next!.includes('bride_parents' as GuestRole));
});

test('a bulk collapses into one statement per distinct value', () => {
  const rows = [
    g('a', 'guest', null),
    g('b', 'guest', []),
    g('c', 'guest', ['vip']),
    g('d', 'guest', ['host']), // already hosting — no write
    g('e', 'host', null), // already hosting — no write
  ];
  const plan = planHostHatWrites(rows, true);
  assert.equal(plan.length, 2, JSON.stringify(plan));
  const host = plan.find((p) => p.extraRoles.join() === 'host')!;
  assert.deepEqual(host.guestIds.sort(), ['a', 'b']);
  const vipHost = plan.find((p) => p.extraRoles.join() === 'vip,host')!;
  assert.deepEqual(vipHost.guestIds, ['c']);
});

test('two guests whose roles differ only in ORDER share one statement', () => {
  const plan = planHostHatWrites(
    [g('a', 'guest', ['vip', 'family']), g('b', 'guest', ['family', 'vip'])],
    true,
  );
  assert.equal(plan.length, 1, 'a key that respected order would have queued two writes');
  assert.deepEqual(plan[0]!.guestIds, ['a', 'b']);
  // …and each still gets a valid array; the key is sorted, the value is not.
  assert.equal(plan[0]!.extraRoles.length, 3);
});

test('a bulk where nobody changes queues NOTHING', () => {
  // A zero-row UPDATE is success-shaped: the screen would say "12 guests are
  // part of the host now" having written nothing at all.
  assert.deepEqual(planHostHatWrites([g('a', 'host', null), g('b', 'guest', ['host'])], true), []);
});
