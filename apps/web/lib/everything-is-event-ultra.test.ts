/**
 * 💎 EVERYTHING IS EVENT ULTRA (owner 19 Nov 2026, specs DECISION_LOG "Event plans part 2 (#8004) — four calls",
 * verbatim "all your picks"; PLAN_RULINGS_2026-11-18 ruling 34).
 *
 *   (A) The 11 Event Hub parts and Editorial move from Event Pro to Event Ultra, for NEW buyers. A Pro held through any
 *       path dated before 19 Nov 00:00 PHT (an order, a bundle, a basket line, an admin comp, a supplier's gift) keeps
 *       everything — one service-role reader, `event_hub_pro_kept_lines`. A newer Pro is the Pro PLAN: the plan's own
 *       perks (no Setnayan mark, the footer and watermark off, the schedule for one person) and the plan gates 1 · 13.
 *   (B) What an event paid (parts, Plus, Pro) counts toward Ultra's price, not Pro's.
 *   (C) The Maker asks for Ultra — "Unlock Ultra and Apply" — and the iPhone sells `event_ultra`, or to a paid Pro the
 *       upgrade product at the difference.
 *
 * SABOTAGE, measured by hand on 2026-11-19 (each alone turns this file red, then restored):
 *   · `if (await holds(EVERYTHING_SKU))` → `holds(FULL_PRO_SKU)` in eventHubOwnership     → (D) red (a new Pro gets everything)
 *   · `hubProKeptFrom` returns true on an unknown shape                                    → (C) red
 *   · drop `proPaid` from the cap's sum                                                    → (B) red
 *   · the mark asks `eventCoupleWebsiteProActive` again                                    → (F) red
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  EVERYTHING_SKU,
  FULL_PRO_SKU,
  EVENT_PLUS_SKU,
  HUB_PARTS,
  everyHubPart,
  holdsProPlan,
  hubOwnershipFrom,
  hubOwnershipOfView,
  hubOwnershipView,
  hubPartsCharge,
} from '@/lib/hub-parts';
import { EVENT_ULTRA_SKU } from '@/lib/event-ultra';
import { eventHubOwnership, hubProKeptFrom } from '@/lib/couple-website-pro';
import { orderStatusConfersAccess, orderStatusConfersOwnership } from '@/lib/entitlements';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(A) the everything code is Event Ultra’s, spelled once and held equal', () => {
  assert.equal(EVERYTHING_SKU, EVENT_ULTRA_SKU);
  assert.equal(everyHubPart().proPlan, true, 'everything is always the Pro plan too');
});

test('(B) a paid Pro counts toward everything at Pro’s row, and reaching Ultra’s price is everything', () => {
  const prices = new Map([
    [FULL_PRO_SKU, 5000],
    [EVENT_PLUS_SKU, 3000],
  ]);
  const base = { fullHeld: false, partHeld: () => false, paidParts: [], prices, fullPrice: 9000 } as const;
  const pro = hubOwnershipFrom({ ...base, proPaid: true, proPlan: true });
  assert.equal(pro.full, false, 'a Pro bought from 19 Nov is not everything');
  assert.equal(pro.proPlan, true);
  assert.equal(pro.paidPhp, 5000, 'the Pro it paid for is not counted toward Ultra');
  assert.equal(hubOwnershipFrom({ ...base, proPaid: true, plusPaid: true, proPlan: true }).full, false);
  assert.equal(hubOwnershipFrom({ ...base, fullPrice: 8000, proPaid: true, plusPaid: true }).full, true, 'the cap at Ultra’s price no longer opens everything');
  // An unread Pro price never counts (fail-closed).
  assert.equal(hubOwnershipFrom({ ...base, prices: new Map(), proPaid: true }).paidPhp, 0);
  // The client view carries the plan.
  assert.equal(hubOwnershipOfView(hubOwnershipView(pro)).proPlan, true);
  assert.equal(holdsProPlan(hubOwnershipView(pro)), true);
  assert.equal(holdsProPlan(hubOwnershipFrom({ ...base })), false);
  // Pro is not sold twice to a Pro plan, and everything (Ultra) is still priced as the rest.
  assert.deepEqual(hubPartsCharge({ parts: 'full', owned: pro, prices, fullPrice: 5000 }), { ok: false, why: 'already_owned' });
});

test('(C) the kept-Pro answer is read strictly — a granted comp or gift, or a line whose status counts', () => {
  assert.equal(hubProKeptFrom({ lines: [], granted: true }, orderStatusConfersAccess), true);
  assert.equal(hubProKeptFrom({ lines: [{ status: 'paid' }], granted: false }, orderStatusConfersAccess), true);
  assert.equal(hubProKeptFrom({ lines: [{ status: 'submitted' }], granted: false }, orderStatusConfersAccess), false, 'a pending order opens everything');
  assert.equal(hubProKeptFrom({ lines: [{ status: 'submitted' }], granted: false }, orderStatusConfersOwnership), true);
  assert.equal(hubProKeptFrom({ lines: [{ status: 'refunded' }], granted: false }, orderStatusConfersOwnership), false, 'a refund keeps everything');
  for (const bad of [null, undefined, [], 'yes', { lines: 'x' }, { granted: 'true' }, { lines: [{ status: 1 }] }]) {
    assert.equal(hubProKeptFrom(bad, orderStatusConfersOwnership), false, `an unknown answer keeps everything: ${JSON.stringify(bad)}`);
  }
});

/** Orders of `owned` codes in `status`; `event_hub_pro_kept_lines` answers `kept` (or an error). */
function world(owned: Set<string>, status: string, kept: unknown | 'error' = null): SupabaseClient {
  // One query chain per `from()` — the readers ask in parallel, so a shared filter would cross the answers.
  const chain = (): Record<string, unknown> => {
    let keys: string[] | null = null;
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      not: () => q,
      in(col: string, vals: unknown) {
        if (col === 'service_key' && Array.isArray(vals)) keys = vals as string[];
        return q;
      },
      then(resolve: (v: unknown) => unknown) {
        const data = keys && keys.some((k) => owned.has(k)) ? [{ status }] : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return q;
  };
  const b: Record<string, unknown> = {
    from: () => chain(),
    rpc: (fn: string) =>
      Promise.resolve(
        fn === 'event_hub_pro_kept_lines'
          ? kept === 'error'
            ? { data: null, error: { message: 'refused' } }
            : { data: kept, error: null }
          : { data: null, error: null },
      ),
  };
  return b as unknown as SupabaseClient;
}

test('(D) a Pro bought from 19 Nov is the Pro plan with the plan gates — not everything', async () => {
  const own = await eventHubOwnership(world(new Set([FULL_PRO_SKU]), 'submitted'), 'evt_new_pro', 'owned');
  assert.equal(own.full, false, 'a new Pro got all 11 parts');
  assert.equal(own.proPlan, true);
  assert.equal(own.parts.size, 0);
  assert.deepEqual([...(own.gates ?? [])].sort(), ['1', '13'], 'a Pro plan lost what Plus has');
});

test('(D) a Pro kept from before 19 Nov keeps everything; an Ultra order is everything; a failed read is the plan', async () => {
  const kept = await eventHubOwnership(world(new Set([FULL_PRO_SKU]), 'submitted', { lines: [{ status: 'submitted' }], granted: false }), 'evt_kept', 'owned');
  assert.equal(kept.full, true, 'a Pro bought before 19 Nov lost the parts');
  assert.equal(kept.parts.size, HUB_PARTS.length);
  const ultra = await eventHubOwnership(world(new Set([EVENT_ULTRA_SKU]), 'paid'), 'evt_ultra', 'active');
  assert.equal(ultra.full, true);
  const lost = await eventHubOwnership(world(new Set([FULL_PRO_SKU]), 'paid', 'error'), 'evt_lost', 'active');
  assert.equal(lost.full, false, 'a lost read opened the parts for free');
  assert.equal(lost.proPlan, true);
});

test('(E) the grandfather lives in one migration, service role only, dated 19 Nov 00:00 PHT', () => {
  const sql = readFileSync(join(WEB, '..', '..', 'supabase/migrations/20271352097874_event_hub_pro_keeps_everything_before_19_nov.sql'), 'utf8');
  assert.match(sql, /c_cutover CONSTANT TIMESTAMPTZ := '2026-11-18 16:00:00\+00';/);
  assert.match(sql, /IF coalesce\(auth\.role\(\), ''\) <> 'service_role' THEN\s+RETURN NULL;/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.event_hub_pro_kept_lines\(UUID\) FROM PUBLIC, anon, authenticated;/);
  for (const path of ['public.orders o', 'public.onboarding_order_items i', 'public.bundle_components b', 'public.comp_grants cg', 'public.shop_gift_stock_entries e']) {
    assert.ok(sql.includes(path), `the grandfather forgot a path: ${path}`);
  }
  // Four dated reads: the order (its own code or a bundle's), the basket line, the comp, the gift.
  assert.equal((sql.match(/< c_cutover/g) ?? []).length, 4, 'one of the paths is not dated');
});

test('(F) the plan’s own perks ask the Pro plan; everything stays everything', () => {
  const lib = code('lib/couple-website-pro.ts');
  assert.match(lib, /return \(await eventHubOwnership\(supabase, eventId, 'active'\)\)\.full;/, 'everything no longer means everything');
  assert.match(lib, /return holdsProPlan\(await eventHubOwnership\(supabase, eventId, 'active'\)\);/);
  assert.match(code('lib/setnayan-mark-by-plan.server.ts'), /eventProPlanActive\(supabase, eventId\)/, 'the mark asks for everything again');
  assert.match(code('app/[slug]/_lib/loaders.ts'), /proWatermarkHiddenAhead = startAhead\(proPlanActiveFor\(event\.event_id\)\)/);
});

test('(G) the plan page: Pro is a plan card in the owner’s words, Ultra is Everything, the parts list is Ultra’s', () => {
  const offer = code('app/dashboard/[eventId]/studio/website-pro/_components/plan-offer.tsx');
  assert.match(offer, /`Everything in Plus · Setnayan AI · no Setnayan mark\$\{facts\.proCredits !== null && facts\.proCredits > 0 \? ` · \$\{formatCount\(facts\.proCredits\)\} credits` : ''\}`/);
  assert.match(offer, /Event Ultra · Everything/);
  assert.match(offer, /Your Event Pro keeps all \$\{HUB_PARTS\.length\} Hub parts and Editorial\. Nothing you had is taken away\./);
  assert.doesNotMatch(offer, /2,000|3,000|6,000|₱\s?\d/, 'a credit count or a price is typed on the plan page');
  const body = code('app/dashboard/[eventId]/studio/website-pro/_components/pro-parts-body.tsx');
  assert.match(body, /const restPhp = everythingPhp === null \? null : Math\.max\(0, everythingPhp - paidPhp\);/);
});

test('(H) the Maker asks for Ultra, at the event’s own difference read from the server', () => {
  const sheet = code('app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx');
  assert.match(sheet, /Unlock Ultra and Apply/);
  assert.match(sheet, /'Apply needs Event Ultra'/);
  assert.match(sheet, /Apply without the Ultra effects/);
  const store = code('lib/hub-draft-store.ts');
  assert.match(store, /readUltraUpgradeCharge\(createAdminClient\(\), eventId\)/);
  assert.match(store, /formatV2Sku\(EVENT_ULTRA_SKU\)/);
});
