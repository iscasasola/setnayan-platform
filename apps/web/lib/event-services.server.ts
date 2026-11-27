import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { eventHubOwnership } from '@/lib/couple-website-pro';
import {
  SKU_OWNERSHIP_ALIASES,
  bundlesGrantingSku,
  eventHasCompGrant,
  eventHostHoldsFounderSeat,
  eventHostIsInternal,
  eventOwnsSku,
  eventSkuActive,
  fetchBundleComponents,
} from '@/lib/entitlements';
import { eventBasketOrdersGranting } from '@/lib/onboarding-order-items';
import { holdsProPlan } from '@/lib/hub-parts';
import { fetchV2CustomerCatalog } from '@/lib/v2-catalog';
import { PLAN_PRICE_CODES, type PlanCoverage } from '@/lib/event-plans';
import { PLAN_NAME } from '@/lib/plan-buy-doors';
import { resolveOrderChargeCentavos } from '@/lib/order-charge-authority';
import { loadPoolRungs } from '@/lib/papic-pool-rungs';
import { readEventPoolStatus } from '@/lib/papic-event-pool';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/vendor-funnel';
import { readPapicFreeGrantRead } from '@/lib/papic-tier-config-read';
import { papicFreeCreditPromise } from '@/lib/papic-free-credit-promise';
import { PRO_PEEK, ULTRA_PEEK, plusPeek, proMore, ultraMore } from '@/app/_components/frontdoor/front-door-landing-data';
import {
  PACK_KEYS,
  SINGLE_CODES,
  SINGLE_KEYS,
  packFits,
  packSavingPhp,
  type EventServicesFacts,
  type HeldPlan,
  type PackFact,
  type PackKey,
  type PhotoFact,
  type ServiceState,
  type SingleFact,
} from '@/lib/event-services';

/**
 * 🛒 EVENT SERVICES — THE ONE READ (owner 2026-11-23, v4 approved). Everything the page draws and the order mint checks,
 * in ONE batched step (`Promise.all`), so the page and the bill read the same facts:
 *
 *   · what the event holds — each plan through the whole ownership chain (`eventHubOwnership`, `eventSkuActive` /
 *     `eventOwnsSku`: orders, the one-bill lines, comps, gifts, internal hosts), active vs paid-and-being-checked;
 *   · what THIS event would pay for each pack and single — `resolveOrderChargeCentavos`, the authority the order is
 *     billed by (an upgrade pays the difference; Setnayan AI by the event's type while that switch is on). A refusal
 *     (already owned, off sale, a read error) reads as no price, never a remembered one;
 *   · the photo sizes on sale (`loadPoolRungs`), photos left (`readEventPoolStatus`), suppliers booked (for "Fits").
 *
 * A read that FAILED is null all the way to the screen ("Couldn't read"), never 0, "Free" or empty.
 */

type Quote = { php: number | null; refused: string | null };

async function quote(serviceKey: string, eventId: string): Promise<Quote> {
  try {
    const c = await resolveOrderChargeCentavos({ serviceKey, eventId });
    if (!c.ok) return { php: null, refused: c.refusal };
    const php = Number(c.total) / 100;
    return Number.isFinite(php) && php > 0 ? { php, refused: null } : { php: null, refused: 'unpriced' };
  } catch {
    return { php: null, refused: 'read_error' };
  }
}

const stateOf = (active: boolean, owned: boolean): ServiceState => (active ? 'yours' : owned ? 'review' : 'buy');

async function bookedCount(db: SupabaseClient, eventId: string): Promise<number | null> {
  const { count, error } = await db
    .from('event_vendors')
    .select('event_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', [...BOOKED_EVENT_VENDOR_STATUSES]);
  if (error) {
    // "Fits" then marks nothing — a count that could not be read never reads as zero suppliers.
    console.error('[event-services] booked count read failed:', error.message);
    return null;
  }
  return count ?? 0;
}

async function eventLine(db: SupabaseClient, eventId: string): Promise<string | null> {
  const { data, error } = await db.from('events').select('display_name, event_date').eq('event_id', eventId).maybeSingle();
  if (error) console.error('[event-services] event line read failed:', error.message);
  if (error || !data) return null;
  const row = data as { display_name?: string | null; event_date?: string | null };
  const name = (row.display_name ?? '').trim();
  const [y, m, d] = (row.event_date ?? '').split('-').map(Number);
  const date =
    y && m && d
      ? new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(',', '')
      : '';
  const line = [name, date].filter(Boolean).join(' · ');
  return line || null;
}

export async function readEventServices(eventId: string): Promise<EventServicesFacts> {
  const ent = await eventEntitlementClient(eventId);
  const admin = createAdminClient();
  const no = () => false;
  const [
    hubActive,
    hubOwned,
    plusActive,
    plusOwned,
    ultraActive,
    ultraOwned,
    aiActive,
    aiOwned,
    liveActive,
    liveOwned,
    catalog,
    rungs,
    pool,
    booked,
    eyebrow,
    freeGrant,
    ...quotes
  ] = await Promise.all([
    eventHubOwnership(ent, eventId, 'active').catch(() => null),
    eventHubOwnership(ent, eventId, 'owned').catch(() => null),
    eventSkuActive(ent, eventId, PLAN_PRICE_CODES.plus).catch(no),
    eventOwnsSku(ent, eventId, PLAN_PRICE_CODES.plus).catch(no),
    eventSkuActive(ent, eventId, PLAN_PRICE_CODES.ultra).catch(no),
    eventOwnsSku(ent, eventId, PLAN_PRICE_CODES.ultra).catch(no),
    eventSkuActive(ent, eventId, SINGLE_CODES.ai).catch(no),
    eventOwnsSku(ent, eventId, SINGLE_CODES.ai).catch(no),
    eventSkuActive(ent, eventId, SINGLE_CODES.live).catch(no),
    eventOwnsSku(ent, eventId, SINGLE_CODES.live).catch(no),
    fetchV2CustomerCatalog().catch(() => []),
    loadPoolRungs(admin).catch(() => null),
    readEventPoolStatus(admin, eventId),
    bookedCount(ent, eventId).catch(() => null),
    eventLine(ent, eventId).catch(() => null),
    readPapicFreeGrantRead(),
    ...PACK_KEYS.map((k) => quote(PLAN_PRICE_CODES[k], eventId)),
    ...SINGLE_KEYS.map((k) => quote(SINGLE_CODES[k], eventId)),
  ]);
  const packQuotes = quotes.slice(0, PACK_KEYS.length);
  const singleQuotes = quotes.slice(PACK_KEYS.length);

  // ── the plan held now ─────────────────────────────────────────────────────
  const proActive = Boolean(hubActive && holdsProPlan(hubActive));
  const proOwned = Boolean(hubOwned && holdsProPlan(hubOwned));
  const planRead = hubActive !== null && hubOwned !== null;
  const plan: HeldPlan | null = !planRead ? null : ultraActive ? 'ultra' : proActive ? 'pro' : plusActive ? 'plus' : 'free';
  const row = (code: string) => catalog.find((r) => r.service_code === code);
  const titleOf = (k: PackKey) => row(PLAN_PRICE_CODES[k])?.title?.trim() || PLAN_NAME[k];
  const creditsOf = (k: PackKey): number | null => {
    const v = Number(row(PLAN_PRICE_CODES[k])?.included_papic_credits);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const heldCredits = plan && plan !== 'free' ? (creditsOf(plan) ?? 0) : 0;
  const planFacts = {
    plusCredits: creditsOf('plus'),
    proCredits: creditsOf('pro'),
    ultraCredits: creditsOf('ultra'),
    freePapic: papicFreeCreditPromise(freeGrant)?.sentence ?? null,
  };
  const info: Record<PackKey, readonly string[]> = {
    plus: plusPeek(planFacts),
    pro: [...PRO_PEEK, ...proMore(planFacts)],
    ultra: ['Everything in Event Pro', ...ULTRA_PEEK, ...ultraMore(planFacts)],
  };
  const packState: Record<PackKey, ServiceState> = {
    plus: stateOf(plusActive, plusOwned),
    pro: stateOf(proActive, proOwned),
    ultra: stateOf(ultraActive, ultraOwned),
  };
  const paidToward = Boolean(hubOwned && hubOwned.paidPhp > 0);

  const singles: SingleFact[] = SINGLE_KEYS.map((k, i) => {
    const q = singleQuotes[i] as Quote;
    const state =
      k === 'hub'
        ? stateOf(Boolean(hubActive?.full), Boolean(hubOwned?.full))
        : k === 'ai'
          ? stateOf(aiActive, aiOwned)
          : stateOf(liveActive, liveOwned);
    return { key: k, code: SINGLE_CODES[k], php: state === 'buy' ? q.php : null, state };
  });

  const photos: PhotoFact[] | null = rungs
    ? rungs
        .filter((r) => Number.isInteger(r.points) && r.points > 0 && Number.isFinite(r.pricePhp) && r.pricePhp > 0)
        .map((r) => ({ code: r.serviceCode, points: r.points, php: r.pricePhp }))
        .sort((a, b) => a.points - b.points)
    : null;

  const hubOn = Boolean(hubActive?.full);
  const packs: PackFact[] = PACK_KEYS.map((k, i) => {
    const q = packQuotes[i] as Quote;
    const credits = creditsOf(k);
    const state = packState[k];
    const base: PackFact = {
      key: k,
      code: PLAN_PRICE_CODES[k],
      name: titleOf(k),
      credits,
      addsCredits: credits === null ? null : Math.max(0, credits - heldCredits),
      php: state === 'buy' ? q.php : null,
      // Paid toward a plan below this one → the authority's figure is the difference (Pro: `resolveHubProCharge`;
      // Ultra: `readUltraUpgradeCharge`), and no "Save" is said against a difference.
      upgrade: state === 'buy' && paidToward && (k === 'pro' || k === 'ultra'),
      state,
      savePhp: null,
      fits: null,
      info: info[k],
    };
    return base;
  });
  // "Fits" — at most one pack, and only on Free (owner's drawing: a count that could not be read marks nothing).
  if (plan === 'free') {
    const fit = packs.find((p) => p.state === 'buy' && packFits(p.key, booked, hubOn) !== null);
    if (fit) fit.fits = packFits(fit.key, booked, hubOn);
  }
  for (const p of packs) p.savePhp = packSavingPhp(p, singles, photos);

  const remaining = pool.ok ? (pool.status.applies ? pool.status.remainingPoints : 0) : null;

  return {
    eyebrow,
    plan,
    planName: plan === null ? null : plan === 'free' ? 'Free' : titleOf(plan),
    photosLeft: remaining,
    packs,
    singles,
    photos,
  };
}

/**
 * 🚪 The plan held now, for the door on Today — the light half of `readEventServices` (no prices, no quotes): the same
 * ownership chain, asked once per render (`askedOnce` inside the readers). Null = the read failed.
 */
export async function readEventPlanHeld(eventId: string): Promise<{ key: HeldPlan; name: string } | null> {
  try {
    const ent = await eventEntitlementClient(eventId);
    const [hub, plus, ultra] = await Promise.all([
      eventHubOwnership(ent, eventId, 'active'),
      eventSkuActive(ent, eventId, PLAN_PRICE_CODES.plus),
      eventSkuActive(ent, eventId, PLAN_PRICE_CODES.ultra),
    ]);
    const key: HeldPlan = ultra ? 'ultra' : holdsProPlan(hub) ? 'pro' : plus ? 'plus' : 'free';
    return { key, name: key === 'free' ? 'Free' : PLAN_NAME[key] };
  } catch {
    return null;
  }
}

/**
 * 🧾 WHAT COVERS THE PLAN, for "Orders and receipts" (L5 · C10) — `readEventPlanHeld`, then, for a paid plan, the same
 * chain `eventSkuActive` walks: the order keys that confer it (its code, its aliases, the packs that include it), the
 * one-bill orders whose lines include it, and whether a real grant holds it (comp · internal host · founder seat).
 * `planHeldWithoutOrder` decides the row. Free stops after the first step. Null = the read failed (no row is guessed).
 */
export async function readEventPlanCoverage(eventId: string): Promise<PlanCoverage<HeldPlan> | null> {
  const held = await readEventPlanHeld(eventId);
  if (!held) return null;
  if (held.key === 'free') return { held, coveringKeys: [], basketOrderIds: [], granted: false };
  try {
    const ent = await eventEntitlementClient(eventId);
    const code = PLAN_PRICE_CODES[held.key];
    const ownKeys = [code, ...(SKU_OWNERSHIP_ALIASES[code] ?? [])];
    const [composition, baskets, comp, internal, founder] = await Promise.all([
      fetchBundleComponents(ent),
      Promise.all(ownKeys.map((k) => eventBasketOrdersGranting(ent, eventId, k))),
      eventHasCompGrant(ent, eventId, code),
      eventHostIsInternal(ent, eventId),
      eventHostHoldsFounderSeat(ent, eventId),
    ]);
    const packs = ownKeys.flatMap((k) => bundlesGrantingSku(composition, k));
    return {
      held,
      coveringKeys: [...new Set([...ownKeys, ...packs])],
      basketOrderIds: baskets.flat().map((b) => b.orderId),
      granted: comp || internal || founder,
    };
  } catch {
    return null;
  }
}
