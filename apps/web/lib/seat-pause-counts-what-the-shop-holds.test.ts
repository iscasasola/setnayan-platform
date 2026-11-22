/**
 * 🧮 THE SEAT-PAUSE JOB COUNTS WHAT THE SHOP HOLDS — never what it may BUY (fix pass on PR #8019, 22 Nov, HIGH).
 *
 * THE FAULT. `reconcileSeatPauses` (lib/seat-pause.server.ts) computed
 *     const extra = canBuyExtraSeats(tier) ? <extra_agent_seats> : 0;
 * PR #8019 made `canBuyExtraSeats` false on EVERY plan (no single seat is sold since 2026-11-19), and the file never
 * counted Ultra Add-on people. So on the next dashboard visit an Ultra shop's PAID single seats, and the +3 people of
 * each live Ultra Add-on, would have been paused — people locked out of seats the shop pays for, and their clients
 * moved, with a line posted in each client's chat.
 *
 * THE RULE, ONE HOME — `extraPeopleHeld` (lib/vendor-seats.ts), read by the Team page's cap, the invite gate and this
 * job: the plan's people + the single seats the shop still HOLDS (`holdsExtraSeats`) + `ULTRA_ADDON_GIVES.people` per
 * live Ultra Add-on. The add-on count is a MEASURED read here: unread → the job aborts and pauses nobody.
 *
 * The job is run for real below, against a stub service-role client (the house pattern of supplier-storage.test.ts).
 *
 * SABOTAGE THAT TURNS THIS RED (each run once, 22 Nov):
 *   · in lib/seat-pause.server.ts put `canBuyExtraSeats(tier) ? … : 0` back as the extra → "the rule, in one home",
 *     "PAID SINGLE SEATS" and "ADD-ON PEOPLE" fail (2 and 3 people paused);
 *   · make `extraPeopleHeld` ignore `liveUltraAddOns` → "the rule, in one home" and "ADD-ON PEOPLE" fail;
 *   · replace the `return null` after the add-on read's error with `liveAddOns = 0` → "A FAILED ADD-ON READ" fails
 *     (three people are paused on a guess).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { TIER_CAPS, ULTRA_ADDON_GIVES, VENDOR_TIERS, holdsExtraSeats } from './vendor-tier-caps';
import { extraPeopleHeld } from './vendor-seats';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
const { reconcileSeatPauses } = require('./seat-pause.server') as typeof import('./seat-pause.server');

const FOUNDER = 'u-founder';
const ULTRA_PEOPLE = TIER_CAPS.enterprise.agentAccounts; // the plan's seats beside the owner

type Opts = {
  tier: string;
  /** How many counted members (Account Managers) the shop has beside the founder. */
  members: number;
  extraAgentSeats?: number | null;
  /** The live add-on count the RPC answers; 'error' = refused; 'malformed' = a null answer. */
  live?: number | 'error' | 'malformed';
};

/** A stub service-role client: records every write and every RPC, answers each read from `opts`. */
function stub(opts: Opts) {
  const writes: { table: string; patch: Record<string, unknown>; ids: string[] }[] = [];
  const rpcs: string[] = [];
  const team = [
    { vendor_team_member_id: 'm-founder', user_id: FOUNDER, role: 'admin', duty: 'shop_manager', created_at: '2026-01-01T00:00:00Z', deactivated_at: null, paused_by_plan_at: null },
    ...Array.from({ length: opts.members }, (_, i) => ({
      vendor_team_member_id: `m-${String(i + 1).padStart(2, '0')}`,
      user_id: `u-${i + 1}`,
      role: 'agent',
      duty: 'account_manager',
      created_at: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      deactivated_at: null,
      paused_by_plan_at: null,
    })),
  ];
  const from = (table: string) => {
    let patch: Record<string, unknown> | null = null;
    let ids: string[] = [];
    const answer = () => {
      if (patch) {
        writes.push({ table, patch, ids });
        return { data: [], error: null };
      }
      if (table === 'vendor_team_members') return { data: team, error: null };
      // No admin-edited rows: the plan's code values stand (`applyPlanContents`).
      if (table === 'vendor_plan_contents') return { data: [], error: null };
      return { data: [], error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      is: () => b,
      not: () => b,
      limit: () => b,
      in: (_col: string, list: string[]) => {
        ids = list;
        return b;
      },
      update: (p: Record<string, unknown>) => {
        patch = p;
        return b;
      },
      maybeSingle: () =>
        Promise.resolve(
          table === 'vendor_profiles'
            ? {
                data: { user_id: FOUNDER, tier_state: opts.tier, tier_expires_at: null, verification_state: 'verified', extra_agent_seats: opts.extraAgentSeats ?? 0 },
                error: null,
              }
            : { data: null, error: null },
        ),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(answer()).then(ok, bad),
    };
    return b;
  };
  const admin = {
    from,
    rpc: (name: string) => {
      rpcs.push(name);
      if (opts.live === 'error') return Promise.resolve({ data: null, error: { message: 'permission denied' } });
      if (opts.live === 'malformed') return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: opts.live ?? 0, error: null });
    },
  } as unknown as Parameters<typeof reconcileSeatPauses>[0];
  const paused = () => writes.filter((w) => w.table === 'vendor_team_members' && w.patch.paused_by_plan_at).flatMap((w) => w.ids);
  return { admin, writes, rpcs, paused };
}

test('the rule, in one home: paid single seats count on the plan that holds them; +3 people per live Ultra Add-on', () => {
  assert.equal(ULTRA_ADDON_GIVES.people, 3);
  assert.equal(extraPeopleHeld('enterprise', 2, 0), 2);
  assert.equal(extraPeopleHeld('enterprise', 0, 2), 2 * ULTRA_ADDON_GIVES.people);
  assert.equal(extraPeopleHeld('enterprise', 2, 1), 2 + ULTRA_ADDON_GIVES.people);
  // Below Ultra nothing bought counts — the same rule the downgrade sheet applies (`holdsExtraSeats`).
  for (const t of VENDOR_TIERS) {
    if (!holdsExtraSeats(t)) assert.equal(extraPeopleHeld(t, 4, 4), 0, `${t} counted bought people it does not hold`);
  }
  // Unreadable or absurd counts never grant.
  assert.equal(extraPeopleHeld('enterprise', null, undefined), 0);
  assert.equal(extraPeopleHeld('enterprise', -3, Number.NaN), 0);
  // The Team page's cap and the invite gate read the same function, and the pause job no longer asks the BUY rule.
  const WEB = join(__dirname, '..');
  const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
  assert.match(src('lib/seat-pause.server.ts'), /effectiveSeatCap\(base, extraPeopleHeld\(tier, s\.extra_agent_seats, liveAddOns\)\)/);
  assert.doesNotMatch(src('lib/seat-pause.server.ts'), /canBuyExtraSeats/, 'the pause job asks what a plan may BUY again');
  assert.match(src('lib/vendor-seats.ts'), /extra: extraPeopleHeld\(tier, seats, packs\)/);
  assert.match(src('app/vendor-dashboard/team/actions.ts'), /readExtraPeople\(supabase, ctx\.vendorProfileId, ctx\.tierState\)/);
  assert.match(src('app/vendor-dashboard/team/_components/team-screen.tsx'), /readExtraPeople\(supabase, vendorProfileId, ctx\.tierState\)/);
});

test('CONTROL: the job still pauses — an Ultra shop two people over its plan, holding nothing extra, has two paused', async () => {
  const s = stub({ tier: 'enterprise', members: ULTRA_PEOPLE + 2, extraAgentSeats: 0, live: 0 });
  const r = await reconcileSeatPauses(s.admin, 'shop');
  assert.deepEqual(r, { paused: 2, resumed: 0 }, 'the stub or the job is inert — the cases below would prove nothing');
  // The newest two.
  assert.deepEqual(s.paused(), [`m-${ULTRA_PEOPLE + 1}`, `m-${ULTRA_PEOPLE + 2}`]);
});

test('PAID SINGLE SEATS ARE NOT PAUSED: an Ultra shop holding 2 paid seats keeps its two extra people', async () => {
  const s = stub({ tier: 'enterprise', members: ULTRA_PEOPLE + 2, extraAgentSeats: 2, live: 0 });
  const r = await reconcileSeatPauses(s.admin, 'shop');
  assert.deepEqual(r, { paused: 0, resumed: 0 }, 'people in seats the shop pays for were paused');
  assert.deepEqual(s.writes, [], 'something was written');
});

test('ADD-ON PEOPLE ARE NOT PAUSED: one live Ultra Add-on keeps three more people, two keep six', async () => {
  const one = stub({ tier: 'enterprise', members: ULTRA_PEOPLE + ULTRA_ADDON_GIVES.people, live: 1 });
  assert.deepEqual(await reconcileSeatPauses(one.admin, 'shop'), { paused: 0, resumed: 0 }, 'the add-on’s three people were paused');
  assert.deepEqual(one.rpcs, ['vendor_live_ultra_addons_for'], 'the live add-on count was not read from the database’s own function');
  assert.deepEqual(one.writes, []);

  const two = stub({ tier: 'enterprise', members: ULTRA_PEOPLE + 2 * ULTRA_ADDON_GIVES.people + 1, live: 2 });
  // One over even with two add-ons: exactly that one pauses — the add-ons raise the cap, they do not switch it off.
  assert.deepEqual(await reconcileSeatPauses(two.admin, 'shop'), { paused: 1, resumed: 0 });
});

test('A FAILED ADD-ON READ PAUSES NOBODY: the job aborts (null) and writes nothing', async () => {
  for (const live of ['error', 'malformed'] as const) {
    // Three people who are only there because of an add-on: a 0 in place of "unread" would pause all three.
    const s = stub({ tier: 'enterprise', members: ULTRA_PEOPLE + ULTRA_ADDON_GIVES.people, live });
    const r = await reconcileSeatPauses(s.admin, 'shop');
    assert.equal(r, null, `an unread add-on count (${live}) did not abort the reconcile`);
    assert.deepEqual(s.writes, [], `an unread add-on count (${live}) still wrote — someone was paused on a guess`);
  }
});

test('below Ultra nothing bought counts and the add-on count is not even asked', async () => {
  const pro = TIER_CAPS.pro.agentAccounts;
  const s = stub({ tier: 'pro', members: pro + 2, extraAgentSeats: 2, live: 5 });
  assert.deepEqual(await reconcileSeatPauses(s.admin, 'shop'), { paused: 2, resumed: 0 });
  assert.deepEqual(s.rpcs, [], 'a plan that cannot hold an add-on paid for the read');
});
