/**
 * ONLY THE COORDINATOR ADVANCES THE RUN OF SHOW — and the gate must actually
 * stop someone (owner ruling · build item 54).
 *
 * ⚠ REWRITTEN. The first version of this file asserted on the SOURCE TEXT of
 * `app/_actions/run-of-show.ts` — that a name appeared, that one call sat before
 * another. Every one of those assertions passed against a gate that admitted
 * every wedding guest, because `if (memberRes.data) return true` reads as a
 * membership check and is not one. Source text cannot tell you who gets in.
 *
 * So these tests RUN the gate against a stubbed Supabase client and assert the
 * ANSWER. Three properties, one per live defect:
 *
 *   (a) a `member_type:'guest'` row is REFUSED. `event_members` is the event's
 *       people table; a guest who scanned the QR has a row in it and can read
 *       it. `isHostMemberType()` (app/[slug]/_lib/host-scope.ts) is what runs.
 *   (b) a block from ANOTHER event is REFUSED even when the caller is a perfect
 *       host on the event they named. The RPC resolves the event from the block
 *       alone, so the permission must be bound to the block's event.
 *   (c) every refusal carries a sentence, and only the three real success
 *       statuses read as success — the floor console used to fall through to
 *       `{ ok: true }` on anything it had not named.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  ADVANCE_REFUSED_BLOCK_NOT_ON_EVENT,
  ADVANCE_REFUSED_NOT_COORDINATOR,
  authorizeAdvance,
  isBookedCoordinatorOnEvent,
  mayAdvanceRunOfShow,
  resolveBlockEventId,
} from './run-of-show-gate';
import { advanceRefusalMessage, ADVANCE_SUCCESS_STATUSES } from './run-of-show';

const HERE = dirname(fileURLToPath(import.meta.url));

const EVENT = '11111111-1111-4111-8111-111111111111';
const OTHER_EVENT = '22222222-2222-4222-8222-222222222222';
const BLOCK = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';

type Facts = {
  /** The `event_members` row the caller can read, or null for none. */
  member?: { member_type: string } | null;
  memberError?: boolean;
  /** The accepted `event_moderators` row's permission grid. */
  delegate?: Record<string, unknown> | null;
  /** Events `current_coordinator_booked_event_ids()` returns for this caller. */
  coordinatorEvents?: string[];
  rpcError?: boolean;
  /** The `users` row the admin predicate reads. */
  user?: Record<string, unknown> | null;
  userError?: boolean;
  /** Which event the block belongs to; null = unreadable by this client. */
  blockEventId?: string | null;
  blockError?: boolean;
};

/**
 * A table-aware stub. Deliberately records WHICH table each read hit, so a test
 * can prove an arm was consulted rather than inferring it from an outcome that
 * two different arms could produce.
 */
function stub(facts: Facts): { client: SupabaseClient; tables: string[] } {
  const tables: string[] = [];
  const client = {
    from(name: string) {
      tables.push(name);
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        not: () => q,
        is: () => q,
        maybeSingle: () => {
          if (name === 'event_members') {
            return Promise.resolve({
              data: facts.memberError ? null : (facts.member ?? null),
              error: facts.memberError ? { message: 'rejected' } : null,
            });
          }
          if (name === 'event_moderators') {
            return Promise.resolve({
              data: facts.delegate ? { permissions_json: facts.delegate } : null,
              error: null,
            });
          }
          if (name === 'users') {
            return Promise.resolve({
              data: facts.userError ? null : (facts.user ?? null),
              error: facts.userError ? { message: 'rejected' } : null,
            });
          }
          if (name === 'event_schedule_blocks') {
            return Promise.resolve({
              data:
                facts.blockError || facts.blockEventId === null
                  ? null
                  : { event_id: facts.blockEventId ?? EVENT },
              error: facts.blockError ? { message: 'rejected' } : null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return q;
    },
    rpc(name: string) {
      tables.push(`rpc:${name}`);
      if (facts.rpcError) {
        return Promise.resolve({ data: null, error: { message: 'rejected' } });
      }
      return Promise.resolve({ data: facts.coordinatorEvents ?? [], error: null });
    },
  } as unknown as SupabaseClient;
  return { client, tables };
}

const EDIT_GRID = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { schedule: 'edit' } };

// ── (a) THE GUEST ───────────────────────────────────────────────────────────

test('a wedding GUEST with an event_members row is REFUSED', async () => {
  const { client } = stub({ member: { member_type: 'guest' } });
  assert.equal(
    await mayAdvanceRunOfShow(client, USER, EVENT),
    false,
    'a guest who scanned the event QR could advance the programme — the row was ' +
      'read and its member_type never compared',
  );
});

test('every non-host member_type in the enum is REFUSED', async () => {
  for (const member_type of ['guest', 'vendor']) {
    const { client } = stub({ member: { member_type } });
    assert.equal(
      await mayAdvanceRunOfShow(client, USER, EVENT),
      false,
      `${member_type} must not advance the run of show`,
    );
  }
});

test('the couple and an event-side coordinator ARE admitted', async () => {
  for (const member_type of ['couple', 'coordinator']) {
    const { client } = stub({ member: { member_type } });
    assert.equal(
      await mayAdvanceRunOfShow(client, USER, EVENT),
      true,
      `${member_type} runs the day — losing this arm makes the couple's own button dead`,
    );
  }
});

test("a delegate needs schedule:'edit', not merely a delegate row", async () => {
  const view = stub({
    delegate: { ...EDIT_GRID, areas: { schedule: 'view' } },
  });
  assert.equal(await mayAdvanceRunOfShow(view.client, USER, EVENT), false);
  const edit = stub({ delegate: EDIT_GRID });
  assert.equal(await mayAdvanceRunOfShow(edit.client, USER, EVENT), true);
});

// ── The narrowed vendor arm ─────────────────────────────────────────────────

test('the booked COORDINATOR is admitted; a booked florist is not', async () => {
  // The stub answers for `current_coordinator_booked_event_ids()`, which is the
  // coordinator-tile-only helper. A supplier without the tile is simply absent
  // from its result — that absence is the whole narrowing.
  const coordinator = stub({ coordinatorEvents: [EVENT] });
  assert.equal(await mayAdvanceRunOfShow(coordinator.client, USER, EVENT), true);
  assert.ok(
    coordinator.tables.includes('rpc:current_coordinator_booked_event_ids'),
    'the coordinator-only helper must be the one consulted — current_vendor_booked_event_ids ' +
      'is EVERY booked supplier',
  );

  const florist = stub({ coordinatorEvents: [] });
  assert.equal(await mayAdvanceRunOfShow(florist.client, USER, EVENT), false);
});

test('a coordinator booked on a DIFFERENT event is refused on this one', async () => {
  const { client } = stub({ coordinatorEvents: [OTHER_EVENT] });
  assert.equal(await isBookedCoordinatorOnEvent(client, EVENT), false);
  assert.equal(await isBookedCoordinatorOnEvent(client, OTHER_EVENT), true);
});

test('a REJECTED query is a refusal, never an admission', async () => {
  // Supabase resolves with `{ error }` — it does not throw — so a discarded
  // error makes a rejected read look exactly like an empty one.
  assert.equal(await isBookedCoordinatorOnEvent(stub({ rpcError: true }).client, EVENT), false);
  assert.equal(
    await mayAdvanceRunOfShow(stub({ memberError: true }).client, USER, EVENT),
    false,
  );
  assert.equal(
    await mayAdvanceRunOfShow(
      stub({ userError: true, user: { is_internal: true } }).client,
      USER,
      EVENT,
    ),
    false,
    'a failed users read must not fall through to the admin predicate',
  );
});

test('a Setnayan admin is still admitted', async () => {
  const { client } = stub({ user: { is_internal: true } });
  assert.equal(await mayAdvanceRunOfShow(client, USER, EVENT), true);
});

test('an empty caller id or event id is refused before any read', async () => {
  const { client, tables } = stub({ member: { member_type: 'couple' } });
  assert.equal(await mayAdvanceRunOfShow(client, '', EVENT), false);
  assert.equal(await mayAdvanceRunOfShow(client, USER, ''), false);
  assert.deepEqual(tables, []);
});

// ── (b) THE BLOCK / EVENT BINDING ───────────────────────────────────────────

test('a block belonging to ANOTHER event is refused, however good the caller is', async () => {
  // The caller is the couple on OTHER_EVENT — an event they really do run — and
  // hands in a block id from EVENT. `advance_schedule_block(p_block_id)` would
  // have advanced EVENT.
  const { client } = stub({ member: { member_type: 'couple' }, blockEventId: EVENT });
  const auth = await authorizeAdvance(client, null, USER, OTHER_EVENT, BLOCK);
  assert.equal(auth.ok, false);
  assert.equal(
    auth.ok === false && auth.status,
    ADVANCE_REFUSED_BLOCK_NOT_ON_EVENT,
    'the gate authorized the event the CALLER named while the RPC acts on the ' +
      "BLOCK's event — nothing bound them",
  );
});

test('the authorized event is the one READ FROM THE BLOCK', async () => {
  const { client } = stub({ member: { member_type: 'couple' }, blockEventId: EVENT });
  const auth = await authorizeAdvance(client, null, USER, EVENT, BLOCK);
  assert.equal(auth.ok, true);
  assert.equal(auth.ok === true && auth.eventId, EVENT);
});

test('an unreadable / missing block is refused, not waved through', async () => {
  const missing = stub({ member: { member_type: 'couple' }, blockEventId: null });
  const a = await authorizeAdvance(missing.client, null, USER, EVENT, BLOCK);
  assert.equal(a.ok === false && a.status, ADVANCE_REFUSED_BLOCK_NOT_ON_EVENT);

  const rejected = stub({ member: { member_type: 'couple' }, blockError: true });
  const b = await authorizeAdvance(rejected.client, null, USER, EVENT, BLOCK);
  assert.equal(b.ok === false && b.status, ADVANCE_REFUSED_BLOCK_NOT_ON_EVENT);
});

test('the role gate still runs once the block/event pair matches', async () => {
  const { client } = stub({ member: { member_type: 'guest' }, blockEventId: EVENT });
  const auth = await authorizeAdvance(client, null, USER, EVENT, BLOCK);
  assert.equal(auth.ok === false && auth.status, ADVANCE_REFUSED_NOT_COORDINATOR);
  assert.ok(auth.ok === false && auth.message.length > 0, 'a refusal must carry a sentence');
});

test('the block lookup falls back to the privileged client for classes with no policy', async () => {
  // Setnayan admins have NO select policy on event_schedule_blocks, so a
  // caller-only read would turn the admin arm into a dead branch.
  const own = stub({ blockEventId: null });
  const priv = stub({ blockEventId: EVENT });
  assert.equal(await resolveBlockEventId(own.client, priv.client, BLOCK), EVENT);
  assert.equal(await resolveBlockEventId(own.client, null, BLOCK), null);
});

// ── (c) EVERY REFUSAL HAS A SENTENCE ────────────────────────────────────────

test('only the three real success statuses read as success', async () => {
  assert.deepEqual([...ADVANCE_SUCCESS_STATUSES], ['ok', 'started', 'already']);
  for (const status of ADVANCE_SUCCESS_STATUSES) {
    assert.equal(advanceRefusalMessage({ status }), null, `${status} is a success`);
  }
});

test('every refusal produces a non-empty sentence — including unknown ones', async () => {
  const refusals = [
    ADVANCE_REFUSED_NOT_COORDINATOR,
    ADVANCE_REFUSED_BLOCK_NOT_ON_EVENT,
    'not_signed_in',
    'noop_live_in_progress',
    'error',
    'a_status_added_next_year',
    '',
  ];
  for (const status of refusals) {
    const msg = advanceRefusalMessage({ status });
    assert.equal(typeof msg, 'string', `${status || '<empty>'} must refuse`);
    assert.ok(
      (msg ?? '').trim().length > 0,
      `${status || '<empty>'} produced an EMPTY notice — which renders as nothing, ` +
        'i.e. the silent refusal wearing a different hat',
    );
  }
  assert.ok(advanceRefusalMessage(null));
  assert.ok(advanceRefusalMessage(undefined));
});

test('a refusal carrying its own message keeps that message', async () => {
  assert.equal(advanceRefusalMessage({ status: 'error', message: 'row lock timeout' }), 'row lock timeout');
});

// ── The two consumers really do show it ─────────────────────────────────────

/**
 * These two are STRUCTURAL, not behavioural, and the reason is worth stating:
 * the repo's unit runner is `tsx --test` over `*.test.ts` with no React
 * renderer, so a client component cannot be mounted here. What each assertion
 * checks is a BINDING (result → state → JSX), scoped to the region that
 * executes, with comments stripped — never a line of prose, and never the whole
 * file.
 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('the header turns the action result into a notice and RENDERS it', () => {
  const src = strip(
    readFileSync(join(HERE, '..', 'app', '_components', 'run-of-show-header.tsx'), 'utf8'),
  );
  const handlerAt = src.indexOf('const onAdvance');
  assert.notEqual(handlerAt, -1, 'the advance handler is gone');
  const handler = src.slice(handlerAt, src.indexOf('return (', handlerAt));
  assert.match(
    handler,
    /advanceRefusalMessage\(\s*await advanceScheduleBlock\(/,
    'the action result must be classified, not discarded — discarding it is how a ' +
      'refusal finished with "Saved"',
  );
  assert.match(handler, /setRefusal\(/, 'the notice must reach component state');
  assert.match(
    handler,
    /hide\(\)[\s\S]{0,120}setRefusal\(/,
    'a refusal must dismiss the veil WITHOUT the success beat (hide, not complete)',
  );

  const jsx = src.slice(src.indexOf('return (', handlerAt));
  assert.match(jsx, /\{refusal \?/, 'the notice has nowhere to be seen');
  assert.match(jsx, /\{refusal\}/, 'the notice is branched on but never printed');
});

test('the floor console classifies every status instead of falling through to ok', () => {
  const src = strip(
    readFileSync(
      join(
        HERE,
        '..',
        'app',
        'vendor-dashboard',
        'on-the-day',
        'live',
        '[eventId]',
        '_components',
        'floor-command',
        'actions.ts',
      ),
      'utf8',
    ),
  );
  const at = src.indexOf('export async function floorAdvanceBlock');
  assert.notEqual(at, -1, 'floorAdvanceBlock is gone');
  const body = src.slice(at, src.indexOf('\nexport ', at + 1));
  assert.match(
    body,
    /const refusal = advanceRefusalMessage\(res\)/,
    'the shared mapper is what stops an unnamed status reading as success',
  );
  assert.match(body, /if \(refusal\) return \{ ok: false, error: refusal \}/);
});

// ── The SQL the narrowing rests on ──────────────────────────────────────────

test('current_coordinator_booked_event_ids really does require the coordinator tile', () => {
  // If a later migration widens that helper, this gate silently becomes the old
  // every-supplier gate again while every assertion above still passes.
  const sql = readFileSync(
    join(HERE, '..', '..', '..', 'supabase', 'migrations', '20271013100000_day_of_requests_stream.sql'),
    'utf8',
  );
  const fn = sql.slice(sql.indexOf('FUNCTION public.current_coordinator_booked_event_ids()'));
  const def = fn.slice(0, fn.indexOf('$$;'));
  assert.match(def, /'coordinator' = ANY \(vp\.services\)/);
});
