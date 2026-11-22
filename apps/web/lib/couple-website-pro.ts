import type { SupabaseClient } from '@supabase/supabase-js';
import {
  eventActiveSkus,
  eventSkuLinesFor,
  eventOwnsSku,
  eventSkuActive,
  orderStatusConfersAccess,
  orderStatusConfersOwnership,
} from '@/lib/entitlements';
import { askedOnce } from '@/lib/request-once';
import {
  EVENT_PLUS_SKU,
  EVERYTHING_SKU,
  FULL_PRO_SKU,
  HUB_PARTS_ORDER_KEY,
  HUB_PART_PAID_CODES,
  HUB_PART_SKUS,
  hubLegacyPartLinesFrom,
  hubOwnershipFrom,
  hubPartOfPaidCode,
  hubPart,
  holdsProPlan,
  ownsHubGate,
  type HubOwnership,
  type HubPartId,
  type HubPlanGate,
} from '@/lib/hub-parts';

/** The Cinematic Reveal openings' unlock (gate 1) — spelled here, not imported, so this module takes no cycle through
 *  `lib/std-openings.ts` (which asks THIS module for the gate). Held equal by `event-plans-recut-part2.test.ts`. */
const STD_PREMIUM_OPENINGS_SKU = 'STD_PREMIUM_OPENINGS';
/** Event Ultra's code — spelled here like the openings' (no cycle through lib/event-ultra.ts); held equal by
 *  `event-plus-holds-the-whole-hub.test.ts`. */
const EVENT_ULTRA_PLAN_SKU = 'EVENT_ULTRA';

/**
 * apps/web/lib/couple-website-pro.ts
 *
 * Ownership / active gate for the paid COUPLE_WEBSITE_PRO SKU — Event Pro,
 * the single "Pro website" unlock (migration 20270103020000). ⚠ NO PRICE IS
 * WRITTEN HERE: this docblock carried ₱3,999 while a second one four lines
 * further down carried ₱4,999 and the live row said ₱3,500 — three figures for
 * one product, in one file. Read the catalog. Mirrors
 * lib/animated-monogram.ts exactly — a thin, bundle-aware wrapper over the
 * shared lib/entitlements.ts readers so this couple SKU gates orders ONE way
 * (refund-aware, graceful-degrade, defense-in-depth).
 *
 * CANONICAL SKU (load-bearing): COUPLE_WEBSITE_PRO is the ONE website-Pro key.
 * It COLLAPSED the three dead/never-wired keys PRO_WEBSITE, PRO_RSVP and
 * EVENT_WEBSITE (owner 2026-06-14, quoted as HISTORY — the ₱3,999 in his
 * wording is that day's price, not today's; the catalog is the price). Gate
 * EVERY couple-website Pro perk on THIS key, not the legacy ones. The legacy
 * lib/pro-website.ts (PRO_WEBSITE_SERVICE_KEY) was dead-but-inert and was DELETED
 * 2026-08-06 (zero importers). Kept in this note so the next reader does not go
 * looking for it. Do not gate
 * new perks on it.
 *
 * THE V1 PERK · removing the freemium "Powered by Setnayan · setnayan.com"
 * footer WATERMARK from the couple's wedding site + recap + editorial colophon
 * when the SKU is ACTIVE (admin-approved). The free baseline website keeps the
 * watermark; a Pro couple's site sheds it. (The editorial "Powered by Setnayan"
 * SERVICE-CREDITS strip — the chip row listing the SKUs the couple availed — is
 * CONTENT, not a watermark, and is intentionally NOT gated.) Bigger Pro perks
 * (premium templates · custom domain · theme systems) remain an owner product
 * decision and are NOT built here.
 *
 * SAFETY · queries the existing `orders` table via lib/entitlements.ts — no new
 * table, no migration. Graceful-degrade on a missing/changed `orders` table
 * resolves to "not owned" (the safe default — KEEP the watermark) rather than
 * crashing the public page.
 */

export const COUPLE_WEBSITE_PRO_SERVICE_KEY = 'COUPLE_WEBSITE_PRO';

/**
 * Does this event own the paid Couple Website Pro upgrade? Bundle-aware buy-
 * surface reader — counts a still-in-reconciliation 'submitted' order as owned
 * so a couple mid-review can't double-buy. Use this to drive buy/upsell UI.
 */
export async function eventOwnsCoupleWebsitePro(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  // 💎 Full Pro outright, or the parts' cap reached (owner 2026-10-22) — the buy
  // surface must not offer everything again to an event that has paid for it.
  return (await eventHubOwnership(supabase, eventId, 'owned')).full;
}

/**
 * Is the paid Couple Website Pro ACTIVE (admin-approved)? THE FEATURE GATE —
 * the watermark drops only after the Setnayan team verifies the payment (owner
 * 2026-06-18 handshake). Render gates call THIS; buy surfaces call
 * eventOwnsCoupleWebsitePro.
 */
export async function eventCoupleWebsiteProActive(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  // 💎 EVERYTHING — Full Pro outright, or the parts' cap reached (owner
  // 2026-10-22: "when it reaches the Full Pro price, the event owns everything
  // (incl. footer)"). The footer (gate 37) asks THIS and nothing narrower.
  return (await eventHubOwnership(supabase, eventId, 'active')).full;
}

/**
 * 💎 THE EVENT PRO PLAN (owner 2026-11-19) — Pro or Ultra. Event Plus is the whole Hub (20 Nov) and is NOT the plan: it keeps one small mark. What the plan
 * itself gives asks THIS, never the everything gate above: no Setnayan mark (`eventSetnayanMark`), the footer and the
 * watermark off, the schedule for one person. The 11 parts and Editorial ask `eventHubPartActive` /
 * `eventCoupleWebsiteProActive` (everything). Admin-approved, like every feature gate.
 */
export async function eventProPlanActive(supabase: SupabaseClient, eventId: string): Promise<boolean> {
  return holdsProPlan(await eventHubOwnership(supabase, eventId, 'active'));
}

/** Buy-surface twin of `eventProPlanActive` — a pending order counts, so Pro is never offered twice. */
export async function eventOwnsProPlan(supabase: SupabaseClient, eventId: string): Promise<boolean> {
  return holdsProPlan(await eventHubOwnership(supabase, eventId, 'owned'));
}

/* ══════════════════════════════════════════════════════════════════════════
   💎 EVENT PRO, PART BY PART (owner 2026-10-22) — `lib/hub-parts.ts`
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Everything this event holds of Event Pro: Full Pro, each part, and what
 * it has paid toward everything (the cap).
 *
 *   · `'active'` — the FEATURE GATE (admin-approved orders only), like
 *                  `eventSkuActive`. Gates call this.
 *   · `'owned'`  — the BUY SURFACE (a pending order counts, so nobody is asked
 *                  to pay twice mid-review), like `eventOwnsSku`.
 *
 * Full Pro is read through the SAME chain every SKU is (order, bundle, onboarding
 * basket, comp, promo, internal host, founder seat), so an event that owns
 * everything today still owns every part. Each part is read the same way under
 * its own code. The cap then sums the paid part orders at their CATALOGUE price
 * (the web value — an app purchase counts the same), and reaching the Full Pro
 * price is everything. No order of a part → no catalogue read at all.
 *
 * 🔑 One answer per render per (authority, event, mode) — `askedOnce` — so the
 * many gates of one page ask the chain once.
 */
export function eventHubOwnership(
  supabase: SupabaseClient,
  eventId: string,
  mode: 'active' | 'owned' = 'active',
): Promise<HubOwnership> {
  return askedOnce(supabase, 'hub-ownership', [eventId, mode], async () => {
    // 1. 🏛 THE WHOLE HUB (owner 20 Nov 2026, "EVENT PLUS = 1,000 PAPIC CREDITS + THE WHOLE EVENT HUB"): Event Plus, Pro
    //    or Ultra held through the whole chain — an order, a basket, a bundle, a comp, a gift, an internal or founder
    //    host — is everything, and nothing else is read. Pro and Ultra also hold the Pro PLAN (`proPlan`: no mark,
    //    Schedule Release, View as); Plus does not. Asked in one step (the guest page's read depth).
    const holds = (sku: string) => (mode === 'active' ? eventSkuActive(supabase, eventId, sku) : eventOwnsSku(supabase, eventId, sku));
    const counts = mode === 'active' ? orderStatusConfersAccess : orderStatusConfersOwnership;
    const [plusHeldOutright, proHeld, ultraHeld] = await Promise.all([
      holds(EVENT_PLUS_SKU),
      holds(FULL_PRO_SKU),
      holds(EVENT_ULTRA_PLAN_SKU),
    ]);
    if (proHeld || ultraHeld) return everyHubPartHeld(true);
    if (plusHeldOutright) {
      // 💳 A PAID Event Plus counts toward Pro and Ultra (owner 2026-11-04 "upgrade for the difference"; 2026-11-13 "Pay
      //    the difference"): the whole Hub is held, AND `paidPhp` carries the Plus row it was paid at — its own order or a
      //    basket line in a status that counts in this mode, never a comp or a gift (not paid). Without it a Plus event
      //    was refused Pro (`hubPartsCharge` saw everything held) and charged Ultra in full. The price is read only when
      //    the Plus was paid, so a gifted or comped Plus costs no extra read.
      //    …and Hub parts paid before the Plus count too, at their web value, exactly as they did toward Pro on main
      //    (#8004 review: crediting Plus alone dropped them). Read beside the Plus lines — no extra step.
      const [plusLines, partLines] = await Promise.all([
        eventSkuLinesFor(supabase, eventId, [EVENT_PLUS_SKU]),
        eventSkuLinesFor(supabase, eventId, HUB_PART_PAID_CODES, HUB_PARTS_ORDER_KEY),
      ]);
      const plusPaidHere = plusLines.some((r) => r.service_key === EVENT_PLUS_SKU && counts(r.status));
      if (!plusPaidHere) return everyHubPartHeld(false);
      const plusPrices = await hubPartPrices(supabase);
      return hubOwnershipFrom({
        fullHeld: true,
        partHeld: () => true,
        paidParts: partLines
          .filter((r) => counts(r.status))
          .map((r) => hubPartOfPaidCode(r.service_key))
          .filter((p): p is HubPartId => p !== null),
        prices: withPlanPrices(plusPrices),
        fullPrice: plusPrices.everything,
        plusPaid: true,
      });
    }
    // 2. Each part on its own. A part is sold only by its own order (or gifted by
    //    a comp, or freed by a promo) — never in a bundle or the onboarding basket,
    //    and an internal/founder host already answered in step 1 — so the ONE batch
    //    reader (orders + comps + promos, `eventActiveSkus`) answers all eleven.
    //    💎 …and a part bought inside a multi-part order is a LINE of that order (`HUB_PARTS_ORDER_KEY`), read with the
    //    order's own status (`eventSkuLinesFor`) — held, and counted toward the cap, exactly like its own order.
    const [batch, rows, planRows] = await Promise.all([
      eventActiveSkus(supabase, eventId),
      eventSkuLinesFor(supabase, eventId, HUB_PART_PAID_CODES, HUB_PARTS_ORDER_KEY),
      // 💎 Event Plus paid toward the cap (owner 2026-11-04) — its own order and basket lines, read with their own status.
      eventSkuLinesFor(supabase, eventId, [EVENT_PLUS_SKU]),
    ]);
    const plusPaid = planRows.some((r) => r.service_key === EVENT_PLUS_SKU && counts(r.status));
    // 🎟 THE PLAN GATE LEFT (owner 2026-11-18 ruling 34; 20 Nov): Event Plus, Pro and Ultra returned in step 1 — since
    //    20 Nov they hold everything — so here only the openings' own unlock (`STD_PREMIUM_OPENINGS`, sold on its own)
    //    passes a gate: gate 1, a Cinematic Reveal opening, outside its part. Asked with the same reader and mode as
    //    step 1, so the buy surface and the gate cannot disagree.
    const openingsHeld = await holds(STD_PREMIUM_OPENINGS_SKU);
    const gates: HubPlanGate[] = [];
    if (openingsHeld) gates.push('1');
    const heldSku = (sku: string) =>
      batch.active.has(sku) || (mode === 'owned' && batch.pending.has(sku)) || rows.some((r) => r.service_key === sku && counts(r.status));
    // 3. The cap: the parts PAID for, each at its catalogue (web) price, with a paid Plus — measured against
    //    EVERYTHING's price, Event Plus's row (owner 20 Nov: the whole Hub is Event Plus).
    const paidParts = rows
      .filter((r) => counts(r.status))
      .map((r) => hubPartOfPaidCode(r.service_key))
      .filter((p): p is HubPartId => p !== null);
    const prices = paidParts.length === 0 && !plusPaid ? null : await hubPartPrices(supabase);
    const priceMap = prices ? withPlanPrices(prices) : new Map<string, number>();
    const own = hubOwnershipFrom({
      fullHeld: false,
      partHeld: (id) => heldSku(hubPart(id).sku),
      paidParts,
      prices: priceMap,
      fullPrice: prices?.everything ?? null,
      plusPaid,
      gates,
    });
    // 4. ⚖ The old cap, kept (owner 2026-10-28): asked ONLY for an event that has paid parts and has not reached
    //    today's price — the few part-holders of 22–26 Oct — so no other event pays for the extra read.
    if (own.full || paidParts.length === 0) return own;
    const legacy = await hubLegacyPartLines(supabase, eventId);
    if (!legacy) return own;
    return hubOwnershipFrom({
      fullHeld: false,
      partHeld: (id) => heldSku(hubPart(id).sku),
      paidParts,
      prices: priceMap,
      fullPrice: prices?.everything ?? null,
      plusPaid,
      gates,
      legacy: {
        capPhp: legacy.capPhp,
        paidParts: legacy.lines
          .filter((r) => counts(r.status))
          .map((r) => hubPartOfPaidCode(r.service_key))
          .filter((p): p is HubPartId => p !== null),
      },
    });
  });
}

/** Everything, held outright (Plus, Pro or Ultra) — no price was read, none is needed. `proPlan` for Pro and Ultra. */
function everyHubPartHeld(proPlan: boolean): HubOwnership {
  return hubOwnershipFrom({ fullHeld: true, partHeld: () => true, paidParts: [], prices: new Map(), fullPrice: null, proPlan });
}

/** The catalogue map the cap reads: each part, Plus and Pro, at its row price. */
function withPlanPrices(prices: { parts: ReadonlyMap<string, number>; full: number | null }): ReadonlyMap<string, number> {
  const m = new Map(prices.parts);
  if (prices.full !== null) m.set(FULL_PRO_SKU, prices.full);
  return m;
}

/**
 * ⚖ The part lines this event bought BEFORE Full Pro moved to its one price, and the old cap they are measured against
 * (owner 2026-10-28, "Keep their full Pro") — one RPC, `event_hub_pro_legacy_part_lines`; the cap and the cutover live
 * only in that migration. Null on any failure: the grandfather is then not applied (logged, never silent).
 */
async function hubLegacyPartLines(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ capPhp: number; lines: ReadonlyArray<{ service_key: string; status: string | null }> } | null> {
  const { data, error } = await supabase.rpc('event_hub_pro_legacy_part_lines', {
    p_event_id: eventId,
    p_codes: [...HUB_PART_PAID_CODES],
  });
  if (error) {
    // Service role only (like `event_entitlement_facts`): a session client is refused and the grandfather is not
    // applied — logged, never silent. Gates read through `eventEntitlementClient`, which is the service role.
    console.error('[supabase-error] couple-website-pro: legacy part lines', error);
    return null;
  }
  return hubLegacyPartLinesFrom(data);
}

/**
 * The parts' and Full Pro's catalogue prices — read, never typed. Asked once per
 * render. A failed read returns null prices, which can never reach the cap.
 */
export function hubPartPrices(
  supabase: SupabaseClient,
): Promise<{
  parts: ReadonlyMap<string, number>;
  full: number | null;
  onSale: ReadonlySet<string>;
  fullTitle: string | null;
  /** 🏛 Everything's price — the Event Plus row (owner 20 Nov: the whole Hub is Event Plus). Null when unread. */
  everything: number | null;
  /** 💎 …and its name, read from that row. */
  everythingTitle: string | null;
}> {
  return askedOnce(supabase, 'hub-part-prices', [], async () => {
    const { data, error } = await supabase
      .from('platform_retail_catalog_v2')
      // `title` rides the same read: the plan's NAME is the catalogue's (RW-306 — "read it, never type it"; `fullTitle`).
      .select('service_code, title, retail_price_php, is_active')
      .in('service_code', [...HUB_PART_SKUS, FULL_PRO_SKU, EVENT_PLUS_SKU]);
    if (error || !data) {
      if (error) console.error('[supabase-error] couple-website-pro: hub part prices', error);
      return { parts: new Map(), full: null, onSale: new Set<string>(), fullTitle: null, everything: null, everythingTitle: null };
    }
    const parts = new Map<string, number>();
    const onSale = new Set<string>();
    let full: number | null = null;
    let fullTitle: string | null = null;
    let everything: number | null = null;
    let everythingTitle: string | null = null;
    for (const r of data as Array<{ service_code: string; title?: string | null; retail_price_php: number | string | null; is_active?: boolean | null }>) {
      if (r.service_code === FULL_PRO_SKU && r.title?.trim()) fullTitle = r.title.trim();
      if (r.service_code === EVERYTHING_SKU && r.title?.trim()) everythingTitle = r.title.trim();
      const php = Number(r.retail_price_php);
      if (!Number.isFinite(php) || php <= 0) continue;
      /* A part taken off sale still COUNTS toward the cap at its price (it was paid for); it just cannot be bought. */
      if (r.is_active) onSale.add(r.service_code);
      if (r.service_code === FULL_PRO_SKU) full = php;
      else parts.set(r.service_code, php);
      // 🏛 Everything's price is Event Plus's row (owner 20 Nov) — it stays in `parts` too, where a paid Plus is credited.
      if (r.service_code === EVERYTHING_SKU) everything = php;
    }
    return { parts, full, onSale, fullTitle, everything, everythingTitle };
  });
}

/**
 * THE PART GATE — is this one part ACTIVE for the event (its own order, Full
 * Pro, or the cap)? Every Pro gate that is not the footer asks THIS with its
 * part (`HUB_PRO_GATES`), never `eventCoupleWebsiteProActive`.
 */
export async function eventHubPartActive(
  supabase: SupabaseClient,
  eventId: string,
  part: HubPartId,
): Promise<boolean> {
  const own = await eventHubOwnership(supabase, eventId, 'active');
  return own.full || own.parts.has(part);
}

/** Buy-surface twin of `eventHubPartActive` — a pending order counts. */
export async function eventOwnsHubPart(
  supabase: SupabaseClient,
  eventId: string,
  part: HubPartId,
): Promise<boolean> {
  const own = await eventHubOwnership(supabase, eventId, 'owned');
  return own.full || own.parts.has(part);
}

/**
 * 🎟 THE PLAN-GATE GATE (owner 2026-11-18) — is gate 1 (a Cinematic Reveal opening) or gate 13 (a ready-made Pro theme)
 * ACTIVE for the event: everything, the gate's part, or Event Plus (`ownsHubGate`). Every consumer of either gate asks
 * this (or `ownsHubGate` of the ownership it already read), never the part alone.
 */
export async function eventHubGateActive(supabase: SupabaseClient, eventId: string, gate: HubPlanGate): Promise<boolean> {
  return ownsHubGate(await eventHubOwnership(supabase, eventId, 'active'), gate);
}

/** Buy-surface twin of `eventHubGateActive` — a pending order counts. */
export async function eventOwnsHubGate(supabase: SupabaseClient, eventId: string, gate: HubPlanGate): Promise<boolean> {
  return ownsHubGate(await eventHubOwnership(supabase, eventId, 'owned'), gate);
}

/** The part's catalogue code — re-exported so a caller never spells one. */
export function hubPartSku(part: HubPartId): string {
  return hubPart(part).sku;
}

/** Standalone à-la-carte Editorial PRO SKU (owner 2026-07-04). Unlocks
 *  the same "Editor's Desk" authorship perks as the Couple Website PRO umbrella,
 *  bought on its own. The catalog row lands via a parallel PR; until then an
 *  absent/inactive SKU simply reads false, so there's no ordering dependency. */
export const EDITORIAL_PRO_SERVICE_KEY = 'EDITORIAL_PRO';

/**
 * Editorial PRO gate — the "Editor's Desk" authorship perks (named moments +
 * per-moment write-ups + the manual chapter/order/guest-wishes editors +
 * no-watermark).
 *
 * DUAL UNLOCK (owner 2026-07-04): a couple has Editorial PRO when EITHER
 *   • the standalone à-la-carte EDITORIAL_PRO SKU is active, OR
 *   • the Event Pro umbrella is active.
 * ⚠ AND SINCE 2026-08-23 THE FIRST ARM IS ALWAYS TRUE: EDITORIAL_PRO joined
 * FREE_FOR_ALL_SKUS, which eventSkuActive checks before any order lookup, so
 * every couple passes here. The dual unlock is kept because the free ruling is
 * reversible and the owner's to reverse — but Event Pro may NOT be SOLD on
 * this inclusion while it is free (see the buy surface's own docblock).
 * Both are checked bundle-aware + admin-approved via eventSkuActive; an absent
 * EDITORIAL_PRO catalog row just returns false (graceful-degrade in
 * lib/entitlements), so the umbrella path keeps working before the à-la-carte
 * SKU exists.
 *
 * WHY a single helper: gate ALL editor-side authorship features (chapter
 * curation, section reorder, guest-wishes editor) on THIS, so the dual-unlock
 * rule lives in ONE place (a future packaging change is a one-line edit here) —
 * exactly as the render watermark gates on eventCoupleWebsiteProActive.
 */
export async function isEditorialProActive(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  if (await eventSkuActive(supabase, eventId, EDITORIAL_PRO_SERVICE_KEY)) return true;
  return eventCoupleWebsiteProActive(supabase, eventId);
}

/**
 * BUY-SURFACE reader for Editorial PRO — bundle- + alias-aware, and it COUNTS a
 * still-in-reconciliation 'submitted' order as owned so a couple mid-review can't
 * double-buy. eventOwnsSku(EDITORIAL_PRO) already matches an order under the
 * COUPLE_WEBSITE_PRO umbrella (SKU_OWNERSHIP_ALIASES), so a couple who bought
 * the umbrella reads as owning Editorial PRO here too. Drives the Editorial PRO
 * buy surface (owned/included/pending states); the render/authoring gate stays
 * isEditorialProActive (admin-approved only).
 */
export async function eventOwnsEditorialPro(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventOwnsSku(supabase, eventId, EDITORIAL_PRO_SERVICE_KEY);
}
