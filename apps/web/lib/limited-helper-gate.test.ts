/**
 * THE LIMITED-HELPER GATE — driven with a client that answers like the
 * database does (`public.is_limited_helper(event_id)` → true / false / error).
 *
 * Which SEAT KIND the function calls a limited helper (role_subtype 'viewer'
 * yes, 'co_host' no) is a property of the SQL function, so it is proved where
 * the function lives: tests/db/cohosts-come-from-the-guest-list.db.test.ts,
 * "is_limited_helper answers for a viewer seat, never a co-host". This file
 * proves what the server action DOES with each answer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIMITED_HELPER_CHECK_FAILED,
  LIMITED_HELPER_REFUSAL,
  isEventIdShape,
  limitedHelperRefusalWith,
  refuseLimitedHelperWith,
  type LimitedHelperRpcClient,
} from './limited-helper-gate';
import { isPlainSentence } from '../app/dashboard/[eventId]/guests/_components/plain-refusal';

const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';

function client(answer: { data: unknown; error: unknown }) {
  const calls: Array<{ fn: string; args: { p_event_id: string } }> = [];
  const c: LimitedHelperRpcClient = {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return Promise.resolve(answer);
    },
  };
  return { c, calls };
}

test('a live limited helper is REFUSED, in the words the screen shows', async () => {
  const { c, calls } = client({ data: true, error: null });
  await assert.rejects(() => refuseLimitedHelperWith(c, EVENT), { message: LIMITED_HELPER_REFUSAL });
  assert.equal(await limitedHelperRefusalWith(c, EVENT), LIMITED_HELPER_REFUSAL);
  // The question is asked of the ONE definition, about THIS event.
  assert.deepEqual(calls[0], { fn: 'is_limited_helper', args: { p_event_id: EVENT } });
});

test('a co-host, the creator, anyone the function answers false for → passes untouched', async () => {
  const { c } = client({ data: false, error: null });
  await refuseLimitedHelperWith(c, EVENT);
  assert.equal(await limitedHelperRefusalWith(c, EVENT), null);
});

test('a check that did not answer NEVER lets the write through (an absence denies)', async () => {
  const { c } = client({ data: null, error: { message: 'fetch failed' } });
  await assert.rejects(() => refuseLimitedHelperWith(c, EVENT), { message: LIMITED_HELPER_CHECK_FAILED });
  assert.equal(await limitedHelperRefusalWith(c, EVENT), LIMITED_HELPER_CHECK_FAILED);
});

test('only a literal true refuses — a null/odd answer is not read as "helper", nor a truthy string', async () => {
  for (const data of [null, undefined, 'true', 1, {}]) {
    const { c } = client({ data, error: null });
    assert.equal(await limitedHelperRefusalWith(c, EVENT), null, `data=${JSON.stringify(data)}`);
  }
});

test('a value that is not an event id asks nothing — the action’s own validation answers it', async () => {
  for (const v of [null, undefined, '', 'not-a-uuid', 42, new File([], 'x')]) {
    const { c, calls } = client({ data: true, error: null });
    await refuseLimitedHelperWith(c, v);
    assert.equal(await limitedHelperRefusalWith(c, v), null);
    assert.equal(calls.length, 0, `asked the database about ${String(v)}`);
  }
  assert.equal(isEventIdShape(EVENT), true);
  assert.equal(isEventIdShape(EVENT.toUpperCase()), true);
});

test('both sentences survive the guest list’s plainRefusal filter — the helper reads them, not "Try again"', () => {
  assert.equal(isPlainSentence(LIMITED_HELPER_REFUSAL), true);
  assert.equal(isPlainSentence(LIMITED_HELPER_CHECK_FAILED), true);
});
