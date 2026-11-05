/**
 * A COORDINATOR THE HOSTS SET TO LIMITED CHANGES NOTHING — UNTIL THEY ALLOW A PART (audit 2026-11-02 #19).
 *
 * Owner 2026-10-29 (`lib/coordinator-access-level.ts`): LIMITED is *"the limited helper's grant: view every part, change
 * nothing"*, written onto the coordinator's OWN seat (`wedding_planner_external`, member_type 'coordinator') with
 * `permissions_json.access_level = 'limited'`. `is_limited_helper` asks `role_subtype = 'viewer'`, so it answered false
 * for her, every server action's gate let her through, and the action's own host check — `isEventHost`,
 * `setEventArchived`'s, which admit a coordinator — wrote with the service-role client: event details, guest count,
 * venues, archiving the event.
 *
 * THE PROPERTY, asked of the one gate every action calls first (`every-action-refuses-a-limited-helper.test.ts` holds
 * that each does, with its area): a caller whose own seat is recorded 'limited' is refused EVERY area-less action and
 * every area the hosts have not set to Edit; an area set to Edit opens; Full access and a seat never asked pass; a seat
 * read that did not answer never lets the write through. `ownSeatLevelReader` reads only the CALLER'S seat.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIMITED_HELPER_CHECK_FAILED,
  LIMITED_HELPER_REFUSAL,
  limitedHelperAreaRefusal,
  limitedHelperRefusalWith,
  ownSeatLevelReader,
  refuseLimitedHelperWith,
  type LimitedHelperRpcClient,
  type OwnSeatClient,
} from './limited-helper-gate';
import { DELEGATE_AREAS } from './delegate-areas';
import { levelWrite, undoWrite, type LevelTemplates } from './coordinator-access-level';

const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';
type Answer = { data: unknown; error: unknown };
const ok = (data: unknown): Answer => ({ data, error: null });

/** A coordinator seat: `is_limited_helper` false (her seat is not 'viewer'), her own seat's level, her areas. */
function coordinator(seat: Answer, areas: Partial<Record<string, string | null>> = {}): LimitedHelperRpcClient {
  return {
    rpc: (fn, args) => Promise.resolve(fn === 'is_limited_helper' ? ok(false) : ok(areas[args.p_area ?? ''] ?? 'view')),
    ownSeatLevel: () => Promise.resolve(seat),
  };
}

test('a LIMITED coordinator is refused every area-less action (event details, guest count, venues, archive…)', async () => {
  const c = coordinator(ok('limited'));
  assert.equal(await limitedHelperRefusalWith(c, EVENT, null), LIMITED_HELPER_REFUSAL);
  await assert.rejects(() => refuseLimitedHelperWith(c, EVENT, null), { message: LIMITED_HELPER_REFUSAL });
});

test('a LIMITED coordinator is refused every area left at View — and opens exactly the area the hosts set to Edit', async () => {
  for (const area of DELEGATE_AREAS) {
    assert.equal(await limitedHelperRefusalWith(coordinator(ok('limited')), EVENT, area), limitedHelperAreaRefusal(area), area);
    assert.equal(await limitedHelperRefusalWith(coordinator(ok('limited'), { [area]: 'edit' }), EVENT, area), null, `${area} at Edit`);
  }
  // Edit on one area opens nothing area-less.
  assert.equal(await limitedHelperRefusalWith(coordinator(ok('limited'), { guest_list: 'edit' }), EVENT, null), LIMITED_HELPER_REFUSAL);
});

test('Full access (the co-host seat) and a coordinator the hosts have not answered for yet pass to the action', async () => {
  for (const seat of [ok('full'), ok(null)]) {
    assert.equal(await limitedHelperRefusalWith(coordinator(seat), EVENT, null), null, JSON.stringify(seat));
  }
});

test('a seat read that did not answer never lets the write through', async () => {
  const c = coordinator({ data: null, error: { message: 'fetch failed' } });
  assert.equal(await limitedHelperRefusalWith(c, EVENT, null), LIMITED_HELPER_CHECK_FAILED);
});

test('the level the gate reads is the one the Home ask WRITES — Limited is "limited", Undo clears it', async () => {
  const templates = { co_host: { edit_all: true }, wedding_planner_external: { edit_all: true } } as unknown as LevelTemplates;
  const limited = levelWrite('limited', { role_subtype: 'wedding_planner_external', permissions_json: null }, templates);
  const full = levelWrite('full', { role_subtype: 'wedding_planner_external', permissions_json: null }, templates);
  const undone = undoWrite(limited)!;
  const read = async (pj: unknown) => (await ownSeatLevelReader(seatClient('me', [{ permissions_json: pj }]).c)(EVENT)).data;
  assert.equal(await read(limited.permissions_json), 'limited');
  assert.equal(await read(full.permissions_json), 'full');
  assert.equal(await read(undone.permissions_json), null);
});

/** A session client: the caller is `uid`; `rows` are THEIR live seats as the filtered read returns them. */
function seatClient(uid: string | null, rows: unknown[], opts: { claims?: boolean; seatError?: unknown } = {}) {
  const asked: Record<string, unknown> = {};
  const c: OwnSeatClient = {
    auth: {
      ...(opts.claims === false
        ? {}
        : { getClaims: () => Promise.resolve({ data: uid ? { claims: { sub: uid } } : null, error: null }) }),
      getUser: () => Promise.resolve({ data: { user: uid ? { id: uid } : null }, error: null }),
    },
    from: (table) => {
      asked.table = table;
      return {
        select: (cols) => {
          asked.cols = cols;
          return {
            eq: (_c1, ev) => {
              asked.event = ev;
              return {
                eq: (_c2, u) => {
                  asked.user = u;
                  return {
                    not: () => ({
                      is: () => Promise.resolve(opts.seatError ? { data: null, error: opts.seatError } : { data: rows, error: null }),
                    }),
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { c, asked };
}

test('ownSeatLevelReader reads the CALLER’S seat on THIS event — never a host’s view of everyone', async () => {
  const { c, asked } = seatClient('user-1', [{ permissions_json: { access_level: 'limited' } }]);
  assert.deepEqual(await ownSeatLevelReader(c)(EVENT), { data: 'limited', error: null });
  assert.equal(asked.table, 'event_moderators');
  assert.equal(asked.event, EVENT);
  assert.equal(asked.user, 'user-1');
  // getClaims missing → getUser answers who it is.
  const noClaims = seatClient('user-2', [], { claims: false });
  assert.deepEqual(await ownSeatLevelReader(noClaims.c)(EVENT), { data: null, error: null });
  assert.equal(noClaims.asked.user, 'user-2');
  // Signed out → nothing to ask; the action's own sign-in handling answers.
  const out = seatClient(null, []);
  assert.deepEqual(await ownSeatLevelReader(out.c)(EVENT), { data: null, error: null });
  assert.equal(out.asked.table, undefined);
  // A refused read is an error, never "no seat".
  const refused = seatClient('user-1', [], { seatError: { message: 'denied' } });
  assert.equal((await ownSeatLevelReader(refused.c)(EVENT)).error !== null, true);
  // Any live seat recorded Limited makes the caller limited.
  const two = seatClient('user-1', [{ permissions_json: { access_level: 'full' } }, { permissions_json: { access_level: 'limited' } }]);
  assert.equal((await ownSeatLevelReader(two.c)(EVENT)).data, 'limited');
});
