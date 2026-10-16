/**
 * the-groups-are-read-once.test.ts — ⚡ THE GUEST LIST READS ITS GROUP MEMBERSHIPS ONCE.
 *
 * Measured 2026-10-16 (production build, the owner's 84-guest event replayed, every read
 * logged): `/guests` read `guest_group_memberships` twice per load — the per-group counts
 * (`group_id`) and the guest→groups map (`guest_id, group_id`) — the same rows. Both readers
 * now ask `readEventGroupMemberships`, one identical query that React `cache()` answers once
 * per render. (`cache()` memoises only inside a server render; this file holds the half that
 * makes it possible — the two ask the SAME question — and that each keeps its own honesty.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchGroupMembershipsByEventMeasured, fetchGuestGroupsByEventMeasured } from './guests';

function client(results: Record<string, { data: unknown; error: unknown }>) {
  const asked: string[] = [];
  const c = {
    from(table: string) {
      const q: string[] = [table];
      const b: Record<string, unknown> = {};
      b.select = (s: string) => (q.push(`select=${s.replace(/\s+/g, '')}`), b);
      b.eq = (k: string, v: unknown) => (q.push(`${k}=${String(v)}`), b);
      b.order = () => b;
      b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        asked.push(q.join('&'));
        return Promise.resolve(results[table] ?? { data: [], error: null }).then(res, rej);
      };
      return b;
    },
  };
  return { c: c as unknown as SupabaseClient, asked };
}

const MEMBERS = [
  { guest_id: 'a', group_id: 'g1' },
  { guest_id: 'b', group_id: 'g1' },
  { guest_id: 'b', group_id: 'g2' },
];

test('the counts and the guest→groups map ask the same membership question', async () => {
  const { c, asked } = client({
    guest_groups: { data: [{ group_id: 'g1', label: 'VIP' }, { group_id: 'g2', label: 'Cousins' }], error: null },
    guest_group_memberships: { data: MEMBERS, error: null },
  });
  const groups = await fetchGuestGroupsByEventMeasured(c, 'e1');
  const map = await fetchGroupMembershipsByEventMeasured(c, 'e1');
  const membershipAsks = new Set(asked.filter((q) => q.startsWith('guest_group_memberships')));
  assert.equal(membershipAsks.size, 1, `two different membership reads:\n${[...membershipAsks].join('\n')}`);
  assert.deepEqual(groups.groups.map((g) => [g.group_id, g.member_count]), [['g1', 2], ['g2', 1]]);
  assert.equal(groups.countsMeasured, true);
  assert.deepEqual([...map.memberships.entries()], [['a', ['g1']], ['b', ['g1', 'g2']]]);
  assert.equal(map.measured, true);
});

test('a refused membership read is still a refusal to BOTH readers — never "nobody is in a group"', async () => {
  const { c } = client({
    guest_groups: { data: [{ group_id: 'g1', label: 'VIP' }], error: null },
    guest_group_memberships: { data: null, error: { message: 'permission denied', code: '42501' } },
  });
  const groups = await fetchGuestGroupsByEventMeasured(c, 'e1');
  const map = await fetchGroupMembershipsByEventMeasured(c, 'e1');
  assert.equal(groups.measured, true);
  assert.equal(groups.countsMeasured, false, 'unread counts must not pass as zero');
  assert.equal(map.measured, false, 'an unread map must not pass as empty');
});
