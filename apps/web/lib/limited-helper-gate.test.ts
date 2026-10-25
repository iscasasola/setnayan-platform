/**
 * THE LIMITED-HELPER GATE — driven with a client that answers like the
 * database does (`is_limited_helper(event_id)`, then
 * `moderator_area_level(event_id, area)` → true/false · 'edit'/'view'/null ·
 * error).
 *
 * Which SEAT KIND the function calls a limited helper (role_subtype 'viewer'
 * yes, 'co_host' no), and that the host's per-area setting is what
 * `moderator_area_level` answers, are properties of the SQL functions, so they
 * are proved where those live: tests/db/cohosts-come-from-the-guest-list.db.test.ts.
 * This file proves what the server action DOES with each answer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIMITED_HELPER_CHECK_FAILED,
  LIMITED_HELPER_REFUSAL,
  isEventIdShape,
  limitedHelperAreaRefusal,
  limitedHelperRefusalWith,
  refuseLimitedHelperWith,
  type LimitedHelperRpcClient,
} from './limited-helper-gate';
import { isPlainSentence } from '../app/dashboard/[eventId]/guests/_components/plain-refusal';

const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';

type Answer = { data: unknown; error: unknown };

/** A client that answers like the database: `is_limited_helper`, then `moderator_area_level` per area. */
function client(helper: Answer, levels: Partial<Record<string, Answer>> = {}) {
  const calls: Array<{ fn: string; args: { p_event_id: string; p_area?: string } }> = [];
  const c: LimitedHelperRpcClient = {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      if (fn === 'is_limited_helper') return Promise.resolve(helper);
      return Promise.resolve(levels[args.p_area ?? ''] ?? { data: null, error: null });
    },
  };
  return { c, calls };
}
const yes = { data: true, error: null };
const no = { data: false, error: null };
const level = (data: string | null): Answer => ({ data, error: null });

test('a limited helper with every area at View changes NOTHING — each area refused in its own words', async () => {
  const { c } = client(yes, { guest_list: level('view'), seat_plan: level('view'), schedule: level('view'), vendors: level('view') });
  for (const area of ['guest_list', 'seat_plan', 'schedule', 'vendors', 'budget', 'photos', 'invitations', 'mood_board'] as const) {
    const said = await limitedHelperRefusalWith(c, EVENT, area);
    assert.equal(said, limitedHelperAreaRefusal(area), area);
    await assert.rejects(() => refuseLimitedHelperWith(c, EVENT, area), { message: limitedHelperAreaRefusal(area) });
  }
  // An action with no area (event details, hosts, purchases…) is the hosts' alone.
  assert.equal(await limitedHelperRefusalWith(c, EVENT, null), LIMITED_HELPER_REFUSAL);
});

test('owner 2026-10-26: a helper the host set to guest list = Edit edits guests — and not the seat plan', async () => {
  const { c, calls } = client(yes, { guest_list: level('edit'), seat_plan: level('view') });
  assert.equal(await limitedHelperRefusalWith(c, EVENT, 'guest_list'), null);
  await refuseLimitedHelperWith(c, EVENT, 'guest_list');
  assert.equal(await limitedHelperRefusalWith(c, EVENT, 'seat_plan'), 'You can view the seat plan but not change it.');
  assert.equal(await limitedHelperRefusalWith(c, EVENT, null), LIMITED_HELPER_REFUSAL, 'Edit on one area opens no area-less action');
  // The questions are asked of the ONE definition each, about THIS event and THIS area.
  assert.deepEqual(calls.slice(0, 2), [
    { fn: 'is_limited_helper', args: { p_event_id: EVENT } },
    { fn: 'moderator_area_level', args: { p_event_id: EVENT, p_area: 'guest_list' } },
  ]);
});

test('an area turned Off (null) is refused like View', async () => {
  const { c } = client(yes, { vendors: level(null) });
  assert.equal(await limitedHelperRefusalWith(c, EVENT, 'vendors'), limitedHelperAreaRefusal('vendors'));
});

test('a co-host, the creator, anyone is_limited_helper answers false for → passes, and no area is even asked', async () => {
  const { c, calls } = client(no);
  await refuseLimitedHelperWith(c, EVENT, 'seat_plan');
  assert.equal(await limitedHelperRefusalWith(c, EVENT, null), null);
  assert.equal(calls.some((x) => x.fn === 'moderator_area_level'), false);
});

test('a check that did not answer NEVER lets the write through (an absence denies)', async () => {
  const down = { data: null, error: { message: 'fetch failed' } };
  await assert.rejects(() => refuseLimitedHelperWith(client(down).c, EVENT, 'guest_list'), { message: LIMITED_HELPER_CHECK_FAILED });
  assert.equal(await limitedHelperRefusalWith(client(yes, { guest_list: down }).c, EVENT, 'guest_list'), LIMITED_HELPER_CHECK_FAILED);
});

test('only a literal true is a helper and only a literal "edit" opens an area', async () => {
  for (const data of [null, undefined, 'true', 1, {}]) {
    assert.equal(await limitedHelperRefusalWith(client({ data, error: null }).c, EVENT, null), null, `helper=${JSON.stringify(data)}`);
  }
  for (const data of ['Edit', 'EDIT', true, 'edit ']) {
    assert.notEqual(await limitedHelperRefusalWith(client(yes, { guest_list: level(data as unknown as string) }).c, EVENT, 'guest_list'), null, `level=${JSON.stringify(data)}`);
  }
});

test('a value that is not an event id asks nothing — the action’s own validation answers it', async () => {
  for (const v of [null, undefined, '', 'not-a-uuid', 42, new File([], 'x')]) {
    const { c, calls } = client(yes);
    await refuseLimitedHelperWith(c, v, null);
    assert.equal(await limitedHelperRefusalWith(c, v, null), null);
    assert.equal(calls.length, 0, `asked the database about ${String(v)}`);
  }
  assert.equal(isEventIdShape(EVENT), true);
  assert.equal(isEventIdShape(EVENT.toUpperCase()), true);
});

test('every refusal survives the guest list’s plainRefusal filter — the helper reads it, not "Try again"', () => {
  for (const s of [LIMITED_HELPER_REFUSAL, LIMITED_HELPER_CHECK_FAILED, limitedHelperAreaRefusal('guest_list'), limitedHelperAreaRefusal('schedule')]) {
    assert.equal(isPlainSentence(s), true, s);
  }
});
