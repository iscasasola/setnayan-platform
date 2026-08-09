/**
 * run-of-show-advance.test.ts — drives the real path and watches the database.
 *
 * The property every earlier guard failed to pin: **on a refusal,
 * `advance_schedule_block` is never called.** Two previous generations asserted
 * over the server action's SOURCE, and the reviewer beat both by keeping the
 * authorization call and discarding its result — the suite stayed green while
 * the timeline moved for anyone. A recorded RPC call cannot be faked that way.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runAdvance,
  ADVANCE_REFUSED_NOT_COORDINATOR,
  type AdvanceClients,
} from './run-of-show-advance';

const EVENT = 'evt-wedding-v';
const BLOCK = 'blk-ceremony';
const USER = 'usr-1';

type Rows = {
  member?: { member_type: string } | null;
  memberError?: unknown;
  moderator?: { permissions_json: unknown } | null;
  coordinatorEvents?: unknown;
  coordinatorError?: unknown;
  me?: unknown;
  blockEventId?: string | null;
};

/** Records every RPC the code makes, so the test can assert on absence. */
function stub(rows: Rows) {
  const rpcCalls: string[] = [];

  const chain = (result: { data: unknown; error?: unknown }) => {
    const self: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'not', 'is', 'order', 'limit']) {
      self[m] = () => self;
    }
    self.maybeSingle = async () => ({ data: result.data, error: result.error ?? null });
    return self;
  };

  const user = {
    from: (table: string) => {
      if (table === 'event_members') {
        return chain({ data: rows.member ?? null, error: rows.memberError });
      }
      if (table === 'event_moderators') return chain({ data: rows.moderator ?? null });
      if (table === 'users') return chain({ data: rows.me ?? null });
      return chain({ data: null });
    },
    rpc: async (fn: string) => {
      rpcCalls.push(fn);
      if (fn === 'current_coordinator_booked_event_ids') {
        return { data: rows.coordinatorEvents ?? [], error: rows.coordinatorError ?? null };
      }
      return { data: { status: 'ok', next_id: 'blk-next' }, error: null };
    },
  };

  const admin = {
    from: () =>
      chain({
        data:
          rows.blockEventId === undefined
            ? { event_id: EVENT }
            : rows.blockEventId === null
              ? null
              : { event_id: rows.blockEventId },
      }),
  };

  return { clients: { user, admin } as unknown as AdvanceClients, rpcCalls };
}

const advanced = (calls: string[]) => calls.includes('advance_schedule_block');

test('the couple advances, and the timeline actually moves', async () => {
  const { clients, rpcCalls } = stub({ member: { member_type: 'couple' } });
  const res = await runAdvance(clients, USER, EVENT, BLOCK);
  assert.equal(res.status, 'ok');
  assert.equal(res.nextId, 'blk-next');
  assert.ok(advanced(rpcCalls), 'the happy path must still reach the database');
});

test('A GUEST IS REFUSED AND THE DATABASE IS NEVER TOUCHED', async () => {
  const { clients, rpcCalls } = stub({ member: { member_type: 'guest' } });
  const res = await runAdvance(clients, USER, EVENT, BLOCK);
  assert.equal(res.status, ADVANCE_REFUSED_NOT_COORDINATOR);
  assert.ok(
    !advanced(rpcCalls),
    'REFUSED and yet advance_schedule_block was called — the refusal is cosmetic',
  );
});

test('a view-only delegate is refused, coordinator membership row and all', async () => {
  // Production shape: accepting a host invite always mints member_type 'coordinator'.
  const { clients, rpcCalls } = stub({
    member: { member_type: 'coordinator' },
    moderator: { permissions_json: { areas: { schedule: 'view' } } },
  });
  const res = await runAdvance(clients, USER, EVENT, BLOCK);
  assert.equal(res.status, ADVANCE_REFUSED_NOT_COORDINATOR);
  assert.ok(!advanced(rpcCalls));
});

test('a delegate with schedule:edit advances', async () => {
  const { clients, rpcCalls } = stub({
    member: { member_type: 'coordinator' },
    moderator: { permissions_json: { areas: { schedule: 'edit' } } },
  });
  assert.equal((await runAdvance(clients, USER, EVENT, BLOCK)).status, 'ok');
  assert.ok(advanced(rpcCalls));
});

test('A BLOCK FROM ANOTHER WEDDING IS REFUSED — the caller\'s eventId is not evidence', async () => {
  // The attack: hold block ids from wedding V, create your own event W, pass W.
  // The RPC resolves the event from the BLOCK, so authorizing on W would move V.
  const { clients, rpcCalls } = stub({
    member: { member_type: 'couple' }, // couple of event W, which they really own
    blockEventId: 'evt-somebody-elses-wedding',
  });
  const res = await runAdvance(clients, USER, 'evt-w-i-own', BLOCK);
  assert.equal(res.status, ADVANCE_REFUSED_NOT_COORDINATOR);
  assert.ok(!advanced(rpcCalls), 'a mismatched block advanced someone else\'s wedding');
});

test('an unresolvable block is refused, not advanced', async () => {
  const { clients, rpcCalls } = stub({ member: { member_type: 'couple' }, blockEventId: null });
  assert.equal((await runAdvance(clients, USER, EVENT, BLOCK)).status, ADVANCE_REFUSED_NOT_COORDINATOR);
  assert.ok(!advanced(rpcCalls));
});

test('a failed membership read refuses — Supabase resolves {error}, it does not throw', async () => {
  const { clients, rpcCalls } = stub({
    member: null,
    memberError: { message: 'boom' },
    coordinatorEvents: [EVENT], // would otherwise ALLOW
  });
  const res = await runAdvance(clients, USER, EVENT, BLOCK);
  assert.equal(res.status, ADVANCE_REFUSED_NOT_COORDINATOR, 'a failed read must fail closed');
  assert.ok(!advanced(rpcCalls));
});

test('the booked coordinator advances; a booked caterer does not', async () => {
  const yes = stub({ member: null, coordinatorEvents: [EVENT] });
  assert.equal((await runAdvance(yes.clients, USER, EVENT, BLOCK)).status, 'ok');

  const no = stub({ member: { member_type: 'vendor' }, coordinatorEvents: [] });
  const res = await runAdvance(no.clients, USER, EVENT, BLOCK);
  assert.equal(res.status, ADVANCE_REFUSED_NOT_COORDINATOR);
  assert.ok(!advanced(no.rpcCalls));
});

test('every refusal carries a sentence for the caller to show', async () => {
  const { clients } = stub({ member: { member_type: 'guest' } });
  const res = await runAdvance(clients, USER, EVENT, BLOCK);
  assert.ok(
    typeof res.message === 'string' && res.message.length > 10,
    'a refusal with no message renders as a generic error, or as "Saved"',
  );
});
