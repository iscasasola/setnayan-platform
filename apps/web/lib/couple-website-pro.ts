import type { SupabaseClient } from '@supabase/supabase-js';
import {
  eventActiveSkus,
  eventOrderRowsFor,
  eventOwnsSku,
  eventSkuActive,
  orderStatusConfersAccess,
  orderStatusConfersOwnership,
} from '@/lib/entitlements';
import { askedOnce } from '@/lib/request-once';
import {
  FULL_PRO_SKU,
  HUB_PART_SKUS,
  hubOwnershipFrom,
  hubPart,
  hubPartOfSku,
  type HubOwnership,
  type HubPartId,
} from '@/lib/hub-parts';

/**
 * apps/web/lib/couple-website-pro.ts
 *
 * Ownership / active gate for the paid COUPLE_WEBSITE_PRO SKU — Event Hub PRO,
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

/* ══════════════════════════════════════════════════════════════════════════
   💎 EVENT HUB PRO, PART BY PART (owner 2026-10-22) — `lib/hub-parts.ts`
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Everything this event holds of Event Hub Pro: Full Pro, each part, and what
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
    // 1. Full Pro through the whole chain — an internal or founder host, a basket,
    //    a bundle, a comp: any of them is everything, and nothing else is read.
    const fullHeld =
      mode === 'active'
        ? await eventSkuActive(supabase, eventId, FULL_PRO_SKU)
        : await eventOwnsSku(supabase, eventId, FULL_PRO_SKU);
    if (fullHeld) return hubOwnershipFrom({ fullHeld, partHeld: () => true, paidParts: [], prices: new Map(), fullPrice: null });
    // 2. Each part on its own. A part is sold only by its own order (or gifted by
    //    a comp, or freed by a promo) — never in a bundle or the onboarding basket,
    //    and an internal/founder host already answered in step 1 — so the ONE batch
    //    reader (orders + comps + promos, `eventActiveSkus`) answers all eleven.
    const [batch, rows] = await Promise.all([
      eventActiveSkus(supabase, eventId),
      eventOrderRowsFor(supabase, eventId, HUB_PART_SKUS),
    ]);
    const heldSku = (sku: string) => batch.active.has(sku) || (mode === 'owned' && batch.pending.has(sku));
    // 3. The cap: the parts PAID for, each at its catalogue (web) price.
    const counts = mode === 'active' ? orderStatusConfersAccess : orderStatusConfersOwnership;
    const paidParts = rows
      .filter((r) => counts(r.status))
      .map((r) => hubPartOfSku(r.service_key))
      .filter((p): p is HubPartId => p !== null);
    const prices = paidParts.length === 0 ? null : await hubPartPrices(supabase);
    return hubOwnershipFrom({
      fullHeld: false,
      partHeld: (id) => heldSku(hubPart(id).sku),
      paidParts,
      prices: prices?.parts ?? new Map(),
      fullPrice: prices?.full ?? null,
    });
  });
}

/**
 * The parts' and Full Pro's catalogue prices — read, never typed. Asked once per
 * render. A failed read returns null prices, which can never reach the cap.
 */
export function hubPartPrices(
  supabase: SupabaseClient,
): Promise<{ parts: ReadonlyMap<string, number>; full: number | null }> {
  return askedOnce(supabase, 'hub-part-prices', [], async () => {
    const { data, error } = await supabase
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php, is_active')
      .in('service_code', [...HUB_PART_SKUS, FULL_PRO_SKU]);
    if (error || !data) {
      if (error) console.error('[supabase-error] couple-website-pro: hub part prices', error);
      return { parts: new Map(), full: null };
    }
    const parts = new Map<string, number>();
    let full: number | null = null;
    for (const r of data as Array<{ service_code: string; retail_price_php: number | string | null }>) {
      const php = Number(r.retail_price_php);
      if (!Number.isFinite(php) || php <= 0) continue;
      if (r.service_code === FULL_PRO_SKU) full = php;
      else parts.set(r.service_code, php);
    }
    return { parts, full };
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
 *   • the Event Hub PRO umbrella is active.
 * ⚠ AND SINCE 2026-08-23 THE FIRST ARM IS ALWAYS TRUE: EDITORIAL_PRO joined
 * FREE_FOR_ALL_SKUS, which eventSkuActive checks before any order lookup, so
 * every couple passes here. The dual unlock is kept because the free ruling is
 * reversible and the owner's to reverse — but Event Hub PRO may NOT be SOLD on
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
