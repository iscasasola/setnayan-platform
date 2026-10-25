/**
 * the-shelves-share-one-read.test.ts — ⚡ 'couple', 'guest' AND 'coordinator' ARE ONE REQUEST.
 *
 * Measured 2026-10-16 (production build, the owner's own rows replayed, every read logged):
 * the events board, the account chrome and the event layout asked `fetchUserEvents` for the
 * three personal shelves in the same render — three embedded `event_members` reads that
 * differed by one `member_type=eq.…` filter — on every page AND on every prefetch the board
 * fires (9 per visit). They now ask one identical question (`member_type=in.(couple,guest,
 * coordinator)`), which React `cache()` answers once per render, and split the rows here.
 *
 * `cache()` only memoises inside a server render, so this file holds the half that makes the
 * dedupe possible: every personal shelf sends the SAME query (same filters, nothing role-
 * specific), and the split hands each shelf exactly its rows — the same rows its own
 * `eq` used to fetch. A refused read still reaches every shelf as the refusal it was.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchUserEvents } from './events';

type Call = { table: string; filters: string[] };

function recordingClient(result: { data: unknown; error: unknown; status?: number }) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, filters: [] };
      calls.push(call);
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = (c: string, v: unknown) => (call.filters.push(`${c}=eq.${String(v)}`), b);
      b.in = (c: string, v: unknown[]) => (call.filters.push(`${c}=in.(${v.join(',')})`), b);
      b.is = (c: string, v: unknown) => (call.filters.push(`${c}=is.${String(v)}`), b);
      b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ status: 200, ...result }).then(resolve, reject);
      return b;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const row = (member_type: string, event_id: string, event_date: string | null) => ({
  member_type,
  auto_surfaced: false,
  guest_id: null,
  seat: null,
  events: { event_id, is_primary: false, event_date },
});

const ROWS = [
  row('guest', 'g1', '2026-11-01'),
  row('couple', 'c1', '2026-12-18'),
  row('coordinator', 'h1', null),
  row('couple', 'c2', '2026-12-12'),
];

test('every personal shelf sends the same query, so one render reads event_members once', async () => {
  const { client, calls } = recordingClient({ data: ROWS, error: null });
  await fetchUserEvents(client, 'u1', 'couple');
  await fetchUserEvents(client, 'u1', 'guest');
  await fetchUserEvents(client, 'u1', 'coordinator');
  assert.equal(calls.length, 3, 'outside a server render cache() does not memoise — one call per ask here');
  const shapes = new Set(calls.map((c) => `${c.table}?${c.filters.join('&')}`));
  assert.equal(shapes.size, 1, `the three shelves sent different queries:\n${[...shapes].join('\n')}`);
  const [only] = [...shapes];
  assert.match(only!, /member_type=in\.\(couple,guest,coordinator\)/);
  assert.doesNotMatch(only!, /member_type=eq\./);
});

test('each shelf gets exactly its own rows, in date order', async () => {
  const { client } = recordingClient({ data: ROWS, error: null });
  assert.deepEqual((await fetchUserEvents(client, 'u2', 'couple')).map((e) => e.event_id), ['c2', 'c1']);
  assert.deepEqual((await fetchUserEvents(client, 'u2', 'guest')).map((e) => e.event_id), ['g1']);
  assert.deepEqual((await fetchUserEvents(client, 'u2', 'coordinator')).map((e) => e.event_id), ['h1']);
});

test("'vendor' and every-membership keep their own read (a supplier's client rows are not paid for by a couple page)", async () => {
  const { client, calls } = recordingClient({ data: [], error: null });
  await fetchUserEvents(client, 'u3', 'vendor');
  await fetchUserEvents(client, 'u3');
  assert.match(calls[0]!.filters.join('&'), /member_type=eq\.vendor/);
  assert.doesNotMatch(calls[1]!.filters.join('&'), /member_type=/);
});
