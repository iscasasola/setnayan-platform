/**
 * 🔑 AN UNREAD ULTRA ADD-ON COUNT IS NEVER "FULL", NEVER 0 (fix pass on PR #8019, 22 Nov).
 *
 * THE FAULT — one disease, four screens. The Ultra Add-on (+1 branch · +15 live cards · +3 people · +50 GB) has no
 * stored count: it is read live (`vendor_live_ultra_addons_for`). Every reader turned a FAILED read into 0, and then
 * drew a sentence about the shop from it:
 *   · /api/upload ........ "Your Ultra plan's 20 GB of storage is full"       (lib/supplier-storage.server.ts)
 *   · Plan › Storage ..... "20 GB of 20 GB used · full"                        (plan-screen.tsx)
 *   · Team › Seats ....... "15 of 15 seats used" / "You've reached your plan's limit" (team-screen.tsx, team/actions.ts)
 *   · Where you work ..... "Your plan's 3 included branches are in use"        (branch-panel.tsx → BranchManager)
 * to an Ultra shop that pays for an add-on. Same shape as vendor-dashboard/reads-are-honest.test.ts: Supabase RESOLVES
 * with `{ error }`, and a 0 made from that error is a claim nobody measured.
 *
 * THE RULE. A gate may still WITHHOLD on an unread count (fail closed) — but what is SAID must be "couldn't load" /
 * "couldn't check", never "full" and never a count:
 *   · `readLiveUltraAddOns` → `{ status: 'unread' }` (the soft `fetchLiveUltraAddOns` stays for gates);
 *   · `checkSupplierStorage` → `unavailable` past the plan's own floor (a file that fits the plan alone still fits);
 *   · `storageRowLine(…, null)` → `STORAGE_UNREAD`;  `seatLine(…, null)` → `SEATS_UNREAD`;
 *   · the invite / role gates refuse with "couldn't check", the branch form says `BRANCH_ALLOWANCE_UNREAD`.
 *
 * SABOTAGE THAT TURNS THIS RED (each run once, 22 Nov):
 *   · lib/supplier-storage.server.ts: answer `{ kind: 'full', … }` with 0 add-ons when the count is unread
 *     → "the upload check" fails;
 *   · lib/supplier-storage.ts: drop `if (ultraAddOns === null && holdsBoughtExtras(plan)) return STORAGE_UNREAD;`
 *     → "the Plan’s Storage row" fails;
 *   · lib/vendor-seats.ts: on a failed add-on RPC return `{ status: 'ok', extra: extraPeopleHeld(tier, seats, 0) }`
 *     → "the Team’s seats" fails;
 *   · _components/branch-manager.tsx: draw the "in use" sentence without the `allowanceUnread ?` arm → "branches" fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { STORAGE_CHECK_FAILED, STORAGE_UNREAD, storageFullMessage, storageRowLine } from './supplier-storage';
import { SEATS_UNREAD, seatLine, teamSeats } from './vendor-free-helper';
import { readExtraPeople } from './vendor-seats';
import { ULTRA_ADDON_GIVES } from './vendor-tier-caps';
import { fetchLiveUltraAddOns, readAddOnExtras, readLiveUltraAddOns } from './vendor-ultra-addons';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
const server = require('./supplier-storage.server') as typeof import('./supplier-storage.server');

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const GB = 1_000_000_000;

type Live = number | string | null | 'error' | 'throws';
/** A stub client that knows WHICH rpc is asked: the live add-on count and the stored bytes answer separately. */
function stub(opts: { tier?: string | null; used?: number; live?: Live; extraAgentSeats?: number | null; profileError?: boolean }) {
  const rpcs: string[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve(
              opts.profileError
                ? { data: null, error: { message: 'refused' } }
                : {
                    data: {
                      tier_state: opts.tier ?? null,
                      extra_agent_seats: opts.extraAgentSeats ?? 0,
                      extra_parent_categories: 0,
                      extra_services_per_leaf: 0,
                      extra_waitlist_acceptances: 0,
                      extra_bookings_per_date: 0,
                    },
                    error: null,
                  },
            ),
        }),
      }),
    }),
    rpc: (name: string) => {
      rpcs.push(name);
      if (name === 'vendor_storage_used_bytes') return Promise.resolve({ data: opts.used ?? 0, error: null });
      if (opts.live === 'throws') return Promise.reject(new Error('network'));
      if (opts.live === 'error') return Promise.resolve({ data: null, error: { message: 'permission denied' } });
      return Promise.resolve({ data: opts.live === undefined ? 0 : opts.live, error: null });
    },
  };
  return { client: client as unknown as Parameters<typeof readLiveUltraAddOns>[0], rpcs };
}

test('the live Ultra Add-on count is MEASURED or UNREAD — a refused, thrown or malformed answer is never 0', async () => {
  assert.deepEqual(await readLiveUltraAddOns(stub({ live: 2 }).client, 'shop'), { status: 'ok', count: 2 });
  assert.deepEqual(await readLiveUltraAddOns(stub({ live: '3' }).client, 'shop'), { status: 'ok', count: 3 }, 'an int may arrive as a string');
  assert.deepEqual(await readLiveUltraAddOns(stub({ live: 0 }).client, 'shop'), { status: 'ok', count: 0 }, 'a real 0 is 0');
  for (const live of ['error', 'throws', null, 'abc', -1] as Live[]) {
    assert.deepEqual(await readLiveUltraAddOns(stub({ live }).client, 'shop'), { status: 'unread' }, `${String(live)} read as a count`);
  }
  // The soft read a GATE uses still withholds (0) — it is the screens that may not draw it.
  assert.equal(await fetchLiveUltraAddOns(stub({ live: 'error' }).client, 'shop'), 0);
  // The combined read says which half was measured.
  const bad = await readAddOnExtras(stub({ live: 'error' }).client, 'shop');
  assert.equal(bad.ultraRead, false);
  assert.equal(bad.extras.ultra, 0);
  const good = await readAddOnExtras(stub({ live: 2 }).client, 'shop');
  assert.deepEqual([good.ultraRead, good.countsRead, good.extras.ultra], [true, true, 2]);
});

test('the upload check: an unread add-on count is `unavailable` past the plan’s own floor — never `full`', async () => {
  // An Ultra shop storing 30 GB. With its one add-on that is 30 of 70 GB; with the count unread, nobody knows.
  const blind = await server.checkSupplierStorage(stub({ tier: 'enterprise', used: 30 * GB, live: 'error' }).client, 'shop', 1_000_000);
  assert.equal(blind.kind, 'unavailable', 'a failed add-on read was drawn as "storage is full"');
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'enterprise', used: 30 * GB, live: 'throws' }).client, 'shop', 1_000_000)).kind, 'unavailable');
  // What IS known when blind: the plan's own 20 GB is a floor, so a file that fits it fits.
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'enterprise', used: 1 * GB, live: 'error' }).client, 'shop', 1_000_000)).kind, 'fits');
  // Measured, the add-on's 50 GB counts — and "full" is said only then, with the real allowance.
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'enterprise', used: 30 * GB, live: 1 }).client, 'shop', 1_000_000)).kind, 'fits');
  const full = await server.checkSupplierStorage(stub({ tier: 'enterprise', used: 70 * GB, live: 1 }).client, 'shop', 1_000_000);
  assert.equal(full.kind, 'full');
  assert.equal(full.kind === 'full' && full.message, storageFullMessage('enterprise', 70 * GB, 1_000_000, 1));
  assert.match(full.kind === 'full' ? full.message : '', /70 GB/, 'the refusal names the plan’s bare 20 GB to a shop holding an add-on');
  // Below Ultra the add-on is not part of the allowance: it is not asked, and a Pro shop at 12 GB is simply full.
  const pro = stub({ tier: 'pro', used: 12 * GB, live: 'error' });
  assert.equal((await server.checkSupplierStorage(pro.client, 'shop', 1)).kind, 'full');
  assert.deepEqual(pro.rpcs, ['vendor_storage_used_bytes'], 'a plan that cannot hold an add-on paid for the read');
  // Every reader of the check says "couldn't check" for `unavailable`.
  assert.match(STORAGE_CHECK_FAILED, /couldn’t check your storage/);
  assert.match(src('app/api/upload/route.ts'), /room\.kind === 'unavailable'[\s\S]{0,80}STORAGE_CHECK_FAILED/);
  assert.equal((src('app/api/vendor/papic-portfolio-import/route.ts').match(/\.kind === 'unavailable'[\s\S]{0,140}?STORAGE_CHECK_FAILED/g) ?? []).length, 2);
});

test('the Plan’s Storage row: an unread add-on count says it couldn’t read — never the plan’s bare number as "full"', () => {
  assert.equal(storageRowLine('enterprise', { status: 'ok', bytes: 20 * GB }, 1), '20 GB of 70 GB used');
  assert.equal(storageRowLine('enterprise', { status: 'ok', bytes: 20 * GB }, 0), '20 GB of 20 GB used · full', 'a MEASURED 0 is a fact');
  assert.equal(storageRowLine('enterprise', { status: 'ok', bytes: 20 * GB }, null), STORAGE_UNREAD, 'an unread count was drawn as "full"');
  assert.equal(storageRowLine('enterprise', { status: 'ok', bytes: 1 * GB }, null), STORAGE_UNREAD, 'an unread count was drawn against the bare 20 GB');
  assert.doesNotMatch(STORAGE_UNREAD, /full|\b0\b/);
  // Below Ultra the add-on count is not part of the allowance — unread or not, the row is the plan's.
  assert.equal(storageRowLine('pro', { status: 'ok', bytes: 10 * GB }, null), '10 GB of 10 GB used · full');
  assert.equal(storageRowLine('free', { status: 'ok', bytes: 1 * GB }, null), null);
  // The page hands the row the measured read: `null` when the live count was not read.
  const page = src('app/vendor-dashboard/subscription/_components/plan-screen.tsx');
  assert.match(page, /readAddOnExtras\(supabase, profile\.vendor_profile_id\)/);
  assert.match(page, /const ultraAddOnCount = ultraExtrasRead \? \(ultraExtrasRead\.ultraRead \? ultraExtrasRead\.extras\.ultra : null\) : 0;/);
  assert.match(page, /storageRowLine\([\s\S]{0,700}?ultraAddOnCount,\s*\)/);
  assert.doesNotMatch(page, /fetchAddOnExtras/, 'the Plan page draws from the soft read again');
});

test('the Team’s seats: an unread count says it couldn’t load, and the gates refuse with "couldn’t check" — never "limit reached"', async () => {
  // The read.
  const ultra = stub({ tier: 'enterprise', extraAgentSeats: 2, live: 1 });
  assert.deepEqual(await readExtraPeople(ultra.client, 'shop', 'enterprise'), { status: 'ok', extra: 2 + ULTRA_ADDON_GIVES.people });
  for (const live of ['error', 'throws', null] as Live[]) {
    assert.deepEqual(
      await readExtraPeople(stub({ tier: 'enterprise', extraAgentSeats: 2, live }).client, 'shop', 'enterprise'),
      { status: 'unread' },
      `an unread add-on count (${String(live)}) became a cap without its three people`,
    );
  }
  assert.deepEqual(await readExtraPeople(stub({ profileError: true }).client, 'shop', 'enterprise'), { status: 'unread' });
  // Below Ultra the add-on is not asked, and nothing bought counts.
  const pro = stub({ tier: 'pro', extraAgentSeats: 2, live: 'error' });
  assert.deepEqual(await readExtraPeople(pro.client, 'shop', 'pro'), { status: 'ok', extra: 0 });
  assert.deepEqual(pro.rpcs, []);

  // The line.
  const seats = teamSeats([], null);
  assert.equal(seatLine(seats, null), SEATS_UNREAD);
  assert.doesNotMatch(SEATS_UNREAD, /\d|used|limit/);
  assert.match(seatLine(seats, 15), /of 15 seats used/, 'a measured cap is still drawn');
  const screen = src('app/vendor-dashboard/team/_components/team-screen.tsx');
  assert.match(screen, /const effectiveCap = extraPeople\.status === 'ok' \? effectiveSeatCap\(baseSeatCap, extraPeople\.extra\) : null;/);
  assert.match(screen, /seatLine\(seats, effectiveCap\)/);

  // The gates: invite and role change. `null` cap → "couldn't check", before `canSeat` can say "limit".
  const act = src('app/vendor-dashboard/team/actions.ts');
  assert.match(act, /return held\.status === 'ok' \? effectiveSeatCap\(baseCap, held\.extra\) : null;/);
  assert.equal((act.match(/const seatCap = await seatCapFor\(supabase, ctx\);\s*if \(seatCap === null\) return err\(SEATS_CHECK_FAILED\);/g) ?? []).length, 2, 'a gate reads the cap without refusing an unread one');
  assert.match(act, /const SEATS_CHECK_FAILED = 'We couldn’t check your team’s seats just now\. Please try again\.';/);
});

test('branches: an unread count draws "couldn’t load" under Add, and the refusal says "couldn’t check" — never "all in use"', () => {
  const data = src('app/vendor-dashboard/profile/details-data.ts');
  assert.match(data, /addOnBranches = live\.status === 'ok' \? live\.count \* ULTRA_ADDON_GIVES\.branches : null;/);
  assert.doesNotMatch(data, /fetchAddOnExtras/, 'Where you work reads the soft count again');
  const panel = src('app/vendor-dashboard/shop/_components/branch-panel.tsx');
  assert.match(panel, /const allowanceUnread = addOnBranches === null;/);
  assert.match(panel, /allowanceUnread=\{allowanceUnread\}/);
  const mgr = src('app/vendor-dashboard/_components/branch-manager.tsx');
  assert.match(mgr, /export const BRANCH_ALLOWANCE_UNREAD =\s*'Couldn’t load your Ultra Add-ons just now/);
  // Both sentences that state a count — "N of M … left" and "… are in use" — sit behind the unread arm.
  assert.match(mgr, /\{allowanceUnread\s*\? BRANCH_ALLOWANCE_UNREAD\s*: `\$\{formatCount\(includedLeft\)\} of \$\{formatCount\(includedTotal\)\} included/);
  assert.match(mgr, /\{allowanceUnread\s*\? BRANCH_ALLOWANCE_UNREAD\s*: includedTotal > 0\s*\? `Your plan’s \$\{formatCount\(includedTotal\)\} included branches are in use/);
  assert.equal((mgr.match(/included branches are in use/g) ?? []).length, 1, 'an "in use" sentence is drawn outside the unread arm');
  // The server's own refusal re-asks, measured, before it says "all in use" on the plan that can hold an add-on.
  const act = src('app/vendor-dashboard/branches/actions.ts');
  const refusal = act.slice(act.indexOf('if (!canBuyExtraBranches(tier)) {'), act.indexOf('they are all in use'));
  assert.match(refusal, /canBuyTheUltraAddOn\(tier\) && \(await readLiveUltraAddOns\(supabase, vendorProfileId\)\)\.status !== 'ok'[\s\S]{0,80}We couldn’t check your Ultra Add-ons just now/);
});
