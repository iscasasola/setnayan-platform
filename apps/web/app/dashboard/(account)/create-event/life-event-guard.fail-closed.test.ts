/**
 * The guard must FAIL CLOSED.
 *
 * WHY THIS SUITE EXISTS. `getBlockingLifeEvent` used to read the honoree columns
 * off `public.events` as `const { data } = await supabase…` — the error
 * destructured away. Migration 20271025120000 denies honoree_label /
 * honoree_dependent_id / signature_details to `authenticated`, so that shape
 * would have started erroring, left `data` undefined, produced zero rows and
 * returned "not blocked" — silently turning the one-in-planning cap
 * (debut · christening · gender_reveal · birthday · graduation)
 * into UNLIMITED, with green CI and no log line.
 *
 * These tests assert the three properties that make that impossible:
 *   1. a read error THROWS rather than returning null;
 *   2. the read targets `events_host`, not `events` (the base table no longer
 *      exposes the honoree columns to the caller's role);
 *   3. a real in-planning row still BLOCKS through the new two-step path.
 *
 * A stub client is used deliberately — the point is the error-handling shape,
 * which is exactly what an integration test against a seeded DB would miss.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getBlockingLifeEvent } from './life-event-guard';

type Res = { data: unknown; error: { message: string } | null };

/** Minimal PostgREST-shaped stub: records which relations were queried. */
function stubClient(byTable: Record<string, Res>, seen: string[] = []) {
  const client = {
    from(table: string) {
      seen.push(table);
      const res = byTable[table] ?? { data: [], error: null };
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
        chain[m] = () => chain;
      }
      // awaiting the builder resolves to the canned result
      (chain as { then: unknown }).then = (
        resolve: (v: Res) => unknown,
      ) => resolve(res);
      return chain;
    },
  };
  return { client, seen };
}

const CANDIDATE = { eventType: 'christening', honoreeLabel: null, honoreeDependentId: null } as never;

test('a membership read error THROWS — never "not blocked"', async () => {
  const { client } = stubClient({
    event_members: { data: null, error: { message: 'permission denied for table event_members' } },
  });
  await assert.rejects(
    () => getBlockingLifeEvent(client as never, 'user-1', CANDIDATE),
    /membership read failed/,
    'a guard that cannot read its own inputs must refuse, not wave the write through',
  );
});

test('an events_host read error THROWS — the exact fail-open this migration would have caused', async () => {
  const { client } = stubClient({
    event_members: { data: [{ event_id: 'e1' }], error: null },
    events_host: {
      data: null,
      error: { message: 'permission denied for column honoree_label' },
    },
  });
  await assert.rejects(
    () => getBlockingLifeEvent(client as never, 'user-1', CANDIDATE),
    /events_host read failed/,
  );
});

test('the guard reads events_host, NOT the base events table', async () => {
  const seen: string[] = [];
  const { client } = stubClient(
    {
      event_members: { data: [{ event_id: 'e1' }], error: null },
      events_host: { data: [], error: null },
    },
    seen,
  );
  await getBlockingLifeEvent(client as never, 'user-1', CANDIDATE);
  assert.ok(seen.includes('events_host'), 'must read the host-scoped view');
  assert.ok(
    !seen.includes('events'),
    'reading public.events would hit the column denial and swallow the error',
  );
});

test('no memberships → not blocked, without a second query', async () => {
  const seen: string[] = [];
  const { client } = stubClient({ event_members: { data: [], error: null } }, seen);
  assert.equal(await getBlockingLifeEvent(client as never, 'user-1', CANDIDATE), null);
  assert.ok(!seen.includes('events_host'), 'no memberships means nothing to check');
});

test('an in-planning row still BLOCKS through the two-step path', async () => {
  const { client } = stubClient({
    event_members: { data: [{ event_id: 'e1' }], error: null },
    events_host: {
      data: [
        {
          event_id: 'e1',
          event_type: 'christening',
          display_name: 'Nina\u2019s Binyag',
          event_date: '2027-01-17',
          archived: false,
          honoree_label: null,
          honoree_dependent_id: null,
          // POST-epoch (LIFE_GATE_EPOCH_ISO = 2026-07-18). An unlabeled row only
          // contends for the singleton slot if it was created after the epoch \u2014
          // legacy rows never block, so no prod account is retroactively frozen.
          created_at: '2026-07-20T00:00:00Z',
        },
      ],
      error: null,
    },
  });
  const blocking = await getBlockingLifeEvent(client as never, 'user-1', CANDIDATE);
  assert.ok(blocking, 'the cap must still fire after the rewrite');
  assert.equal(blocking?.displayName, 'Nina\u2019s Binyag');
});

test('a PRE-epoch unlabeled row still does NOT block (legacy accounts stay free)', async () => {
  const { client } = stubClient({
    event_members: { data: [{ event_id: 'e1' }], error: null },
    events_host: {
      data: [
        {
          event_id: 'e1',
          event_type: 'christening',
          display_name: 'An old binyag',
          event_date: '2027-01-17',
          archived: false,
          honoree_label: null,
          honoree_dependent_id: null,
          created_at: '2026-01-01T00:00:00Z', // before LIFE_GATE_EPOCH_ISO
        },
      ],
      error: null,
    },
  });
  assert.equal(
    await getBlockingLifeEvent(client as never, 'user-1', CANDIDATE),
    null,
    'the rewrite must not retroactively freeze accounts the epoch rule exempts',
  );
});

test('an ungated (lifestyle) type never queries at all', async () => {
  const seen: string[] = [];
  const { client } = stubClient({}, seen);
  const res = await getBlockingLifeEvent(
    client as never,
    'user-1',
    { eventType: 'travel', honoreeLabel: null, honoreeDependentId: null } as never,
  );
  assert.equal(res, null);
  assert.equal(seen.length, 0, 'lifestyle types are unlimited — zero rules, zero reads');
});
