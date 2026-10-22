import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { studioHubHref } from '@/lib/studio-hub';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { eventHubOwnership, hubPartPrices } from '@/lib/couple-website-pro';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import { HUB_PARTS, type HubPartId } from '@/lib/hub-parts';
import { ProPartsBody } from './_components/pro-parts-body';
import { addOnHeroCopy } from '@/lib/add-ons-catalog';
import { UNLOCK_AND_APPLY_PARAM } from '@/lib/hub-pro-effects';

export const metadata = { title: 'Event Hub PRO' };

/* Name + promise from the one record every Studio row reads — never a second
   sentence written into this page. Throws rather than rendering a nameless
   hero if the catalog key is ever renamed. */
const HERO = addOnHeroCopy('website-pro');


/**
 * /dashboard/[eventId]/studio/website-pro — the couple-facing buy surface for
 * Event Hub PRO (the UMBRELLA · owner 2026-07-04). Price is read LIVE from the
 * catalog, never written here. Wires the EXISTING apply-then-pay flow (live
 * catalog price + platform BDO/GCash settings → InlineCheckoutDrawer →
 * submitOrderAction). No new payment mechanics.
 *
 * 🛑 THIS DOCBLOCK USED TO SAY "₱4,999 ... Save the Date openings, RSVP,
 * on-the-day, AND Editorial PRO". THREE OF THOSE FOUR CLAIMS WERE UNTRUE, and
 * BENEFITS below repeated two of them to a paying customer. Corrected
 * 2026-08-29 after enumerating every gate that actually reads this SKU:
 *   · the price was ₱3,500, not ₱4,999 — which is why no number is written
 *     into a comment here any more;
 *   · RSVP — NOTHING is gated. Every couple gets the RSVP page. The legacy
 *     PRO_RSVP / RSVP_PRO_WEBSITE keys this SKU "collapsed" were, in
 *     lib/couple-website-pro.ts's own words, "dead/never-wired";
 *   · on-the-day — NOTHING is gated either. Measured: every
 *     `eventCoupleWebsiteProActive` call under app/[slug] resolves the
 *     WATERMARK and nothing else;
 *   · Editorial PRO — real once, and now FREE FOR EVERYONE. It joined
 *     FREE_FOR_ALL_SKUS on 2026-08-23 ("keep it free if this costs us
 *     nothing"), and eventSkuActive checks that set BEFORE any order lookup,
 *     so a couple who pays for this gets nothing extra from that alias.
 *     ⚠ The alias in SKU_OWNERSHIP_ALIASES is deliberately UNTOUCHED — it is
 *     harmless and reversing the free ruling is the owner's call, not a copy
 *     fix. It simply may not be SOLD as an inclusion while it is free.
 *
 * 🔑 THE RULE THIS LEAVES BEHIND: a benefit line may name only something a
 * non-buyer is actually refused. If no gate reads this SKU for it, it is not
 * an inclusion — it is a sentence that survived the feature it described.
 *
 * Ownership-aware:
 *   • Active (admin-approved) → "Unlocked" + a link into the website hub.
 *   • Owned but pending → "Payment under review", no second drawer.
 *   • Owned nothing → the working buy drawer.
 * Event Hub PRO is the top tier, so there's no cross-sell line up from it.
 */

type Props = { params: Promise<{ eventId: string }>; searchParams?: Promise<{ from?: string; then?: string; buy?: string }> };

const WEBSITE_HUB_HREF = (eventId: string) => `/dashboard/${eventId}/website`;

/**
 * 💎 PART BY PART (owner 2026-10-22, prototype `pro_part_by_part_2026-10-22.html` frame 4): this page is the parts
 * page. Everything stays one tap at the top; the eleven parts follow, big then small, each with one line of what it
 * opens and its state on the right — "◆ ₱1,000", "✓ Yours", or "Under review". A row opens in place: the full list of
 * what that part unlocks (every gate of `HUB_PRO_GATES` that lives there — never a second list) and that part's own
 * button. Every figure is a catalogue read; the rest to everything is Full Pro less what this event has paid for parts.
 *
 * 🔑 THE RULE THAT REPLACED THE OLD BENEFITS LIST is the same rule, made structural: a line may name only something a
 * buyer of THAT part is actually let through — so the lines ARE the gate table (`lib/hub-parts.ts`).
 */

export default async function WebsiteProBuyPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  /* 💎 From the Maker's Apply sheet (`?from=maker`, owner 2026-09-28): the way
     back is the Maker, where the draft — every Pro effect they tried — waits
     untouched. A closed value, never a URL from the request. */
  const search = (await searchParams) ?? {};
  const fromMaker = search.from === 'maker';
  /* "Unlock … and Apply" (owner 2026-09-28): back in the Maker with
     `?apply=1`, which applies the draft once its parts are active — or reopens the
     sheet, draft untouched, when they are not (`unlockAndApplyOnReturn`). */
  const back = fromMaker
    ? {
        href: `/dashboard/${eventId}/launch${search.then === 'apply' ? `?${UNLOCK_AND_APPLY_PARAM}=1` : ''}`,
        label: 'Back to the Maker',
      }
    : { href: studioHubHref(eventId), label: 'Back to services' };

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Purchaser-scoped under orders RLS → the entitlement client so a co-host sees
  // the owned state too. active — admin-approved (unlocked). owned — counting a
  // pending order (double-buy prevention). owned && !active ⇒ under review.
  const ent = await eventEntitlementClient(eventId);
  const supabase = await createClient();
  const [active, owned, prices, settings, vatRatePct] = await Promise.all([
    eventHubOwnership(ent, eventId, 'active').catch(() => null),
    eventHubOwnership(ent, eventId, 'owned').catch(() => null),
    hubPartPrices(createAdminClient()).catch(() => null),
    fetchPlatformSettings(supabase),
    getEffectiveVatRatePct(supabase),
  ]);
  const view = (o: typeof active) => (o ? { full: o.full, parts: [...o.parts], paidPhp: o.paidPhp, fullPricePhp: o.fullPricePhp } : null);
  const partPricePhp: Partial<Record<HubPartId, number>> = {};
  for (const p of HUB_PARTS) {
    const php = prices?.onSale.has(p.sku) ? prices.parts.get(p.sku) : undefined;
    if (php !== undefined) partPricePhp[p.id] = php;
  }
  return (
    <ProPartsBody
      eventId={eventId}
      title={HERO.label}
      back={back}
      fromMaker={fromMaker}
      hubHref={WEBSITE_HUB_HREF(eventId)}
      active={view(active)}
      owned={view(owned)}
      partPricePhp={partPricePhp}
      fullPhp={prices?.full ?? null}
      buy={search.buy}
      settings={settings}
      vatRatePct={vatRatePct}
    />
  );
}
