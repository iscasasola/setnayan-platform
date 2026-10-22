import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import Link from 'next/link';
import { studioHubHref } from '@/lib/studio-hub';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { formatPhp } from '@/lib/php';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { eventHubOwnership, hubPartPrices } from '@/lib/couple-website-pro';
import { getEffectiveVatRatePct } from '@/lib/platform-settings';
import {
  FULL_PRO_SKU,
  HUB_PARTS,
  HUB_PARTS_ORDER_KEY,
  HUB_PRO_GATES,
  hubPart,
  hubPartsLabel,
  isHubPartId,
  type HubPartId,
} from '@/lib/hub-parts';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { addOnHeroCopy } from '@/lib/add-ons-catalog';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
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
  const fullPhp = prices?.full ?? null;
  /* Everything you pay for parts counts toward everything — the rest, never below zero (the cap). */
  const paidPhp = owned?.paidPhp ?? 0;
  const restPhp = fullPhp === null ? null : Math.max(0, fullPhp - paidPhp);
  const partPrice = (id: HubPartId): number | null => {
    const sku = hubPart(id).sku;
    return prices?.onSale.has(sku) ? (prices.parts.get(sku) ?? null) : null;
  };
  const stateOf = (id: HubPartId): 'yours' | 'review' | 'buy' =>
    active && (active.full || active.parts.has(id)) ? 'yours' : owned && (owned.full || owned.parts.has(id)) ? 'review' : 'buy';
  /** Never charge above the rest — a part that would cost more than everything is offered at the rest (and unlocks it). */
  const chargeOf = (php: number) => (restPhp === null ? php : Math.min(php, restPhp));

  /* `?buy=` — the Apply sheet's pick, carried here: "style,motion" or "full". Unknown or owned parts are dropped. */
  const buyFull = search.buy === 'full';
  const buyParts = buyFull
    ? []
    : (search.buy ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(isHubPartId)
        .filter((id, i, all) => all.indexOf(id) === i && stateOf(id) === 'buy');
  const buyPricePhp = buyParts.reduce<number | null>((sum, id) => {
    const php = partPrice(id);
    return sum === null || php === null ? null : sum + php;
  }, 0);

  const drawer = (input: { serviceKey: string; name: string; php: number; label: string; hubParts?: readonly HubPartId[] }) => (
    <InlineCheckoutDrawer
      serviceKey={input.serviceKey}
      displayName={input.name}
      originalPriceCentavos={String(Math.round(input.php * 100))}
      vatRatePct={vatRatePct}
      eventId={eventId}
      settings={settings}
      triggerLabel={input.label}
      {...(input.hubParts ? { hubParts: input.hubParts.join(',') } : {})}
    />
  );

  const big = HUB_PARTS.filter((p) => p.size === 'big');
  const small = HUB_PARTS.filter((p) => p.size === 'small');
  const bandPrice = (parts: typeof HUB_PARTS) => {
    const figures = [...new Set(parts.map((p) => partPrice(p.id)).filter((n): n is number => n !== null))];
    return figures.length === 1 ? `${formatPhp(figures[0]!)} each` : null;
  };

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 sm:px-6" data-pro-parts-page="">
      <Link href={back.href} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft aria-hidden className="h-4 w-4" /> {back.label}
      </Link>

      <header className="space-y-2">
        <h1 className="font-serif text-4xl text-ink">{HERO.label}</h1>
        <p className="text-[15px] leading-snug text-ink/65">
          {paidPhp > 0 && !active?.full
            ? `You've paid ${formatPhp(paidPhp)} toward everything.`
            : 'Buy the parts you use, or everything at once. Each unlock is for this event and everyone on it.'}
        </p>
      </header>

      {/* ── EVERYTHING — one tap, on top. ── */}
      {active?.full ? (
        <div className="rounded-3xl bg-ink/[0.04] p-5" data-pro-everything="yours">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-success-800">
            <PaidMark state="unlocked" label={paidMarkLabel('unlocked', 'Event Hub Pro')} size="lg" tone="current" /> Unlocked
          </p>
          <p className="text-sm text-ink/70">
            Everything is on across your Event Hub — all {HUB_PARTS.length} parts — and the &ldquo;Powered by Setnayan&rdquo; footer is off.
          </p>
          <Link
            href={fromMaker ? back.href : WEBSITE_HUB_HREF(eventId)}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-mulberry px-4 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            {fromMaker ? back.label : 'Open your Event Hub'}
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      ) : owned?.full ? (
        <div className="rounded-3xl bg-mulberry/5 p-5" data-pro-everything="review">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-mulberry">
            <Clock aria-hidden className="h-5 w-5" strokeWidth={1.75} /> Payment under review
          </p>
          <p className="text-sm text-ink/70">
            We&rsquo;ve received your Event Hub Pro order. Our team reconciles within one business day — every part unlocks
            automatically once it is approved.
          </p>
          <Link href={`/dashboard/${eventId}/orders`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-mulberry underline underline-offset-2">
            Track your order
          </Link>
        </div>
      ) : restPhp !== null ? (
        <div className={`rounded-3xl bg-ink/[0.04] p-5 ${buyFull ? 'ring-2 ring-terracotta/50' : ''}`} data-pro-everything="buy">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold text-ink">Everything</span>
            <span className="font-mono text-lg font-bold text-ink">{paidPhp > 0 ? `${formatPhp(restPhp)} more` : formatPhp(restPhp)}</span>
          </p>
          <p className="mt-1 text-sm leading-snug text-ink/65">
            {paidPhp > 0
              ? `The other parts, and the "Powered by Setnayan" footer comes off. ${formatPhp(fullPhp ?? 0)} in all — you've paid ${formatPhp(paidPhp)} of it.`
              : `All ${HUB_PARTS.length} parts, and the "Powered by Setnayan" footer comes off your Hub, invite, prints and story.`}
          </p>
          <div className="mt-3">
            {drawer({
              serviceKey: FULL_PRO_SKU,
              name: 'Event Hub Pro · everything',
              php: restPhp,
              label: paidPhp > 0 ? `Unlock the rest · ${formatPhp(restPhp)}` : `Unlock everything · ${formatPhp(restPhp)}`,
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink/65">Pricing loads from your catalog &mdash; please refresh in a moment.</p>
      )}

      {/* ── THE APPLY SHEET'S PICK (`?buy=`) — one order, one payment. ── */}
      {!active?.full && !owned?.full && buyParts.length > 0 && buyPricePhp !== null ? (
        <div className="rounded-3xl bg-ink/[0.04] p-5 ring-2 ring-terracotta/50" data-pro-buy-pick={buyParts.join(',')}>
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold text-ink">{hubPartsLabel(buyParts)}</span>
            <span className="font-mono text-lg font-bold text-ink">{formatPhp(chargeOf(buyPricePhp))}</span>
          </p>
          <p className="mt-1 text-sm text-ink/65">The {buyParts.length === 1 ? 'part' : 'parts'} your draft uses. What you pay counts toward everything.</p>
          <div className="mt-3">
            {drawer({
              serviceKey: buyParts.length === 1 ? hubPart(buyParts[0]!).sku : HUB_PARTS_ORDER_KEY,
              name: `Event Hub Pro · ${hubPartsLabel(buyParts)}`,
              php: chargeOf(buyPricePhp),
              label: `Unlock ${hubPartsLabel(buyParts)} · ${formatPhp(chargeOf(buyPricePhp))}`,
              ...(buyParts.length > 1 ? { hubParts: buyParts } : {}),
            })}
          </div>
        </div>
      ) : null}

      {/* ── THE ELEVEN PARTS, big then small. ── */}
      {[
        { title: 'Big parts', parts: big },
        { title: 'Small parts', parts: small },
      ].map((band) => (
        <section key={band.title} aria-label={band.title} data-pro-parts-band={band.title}>
          <p className="flex items-baseline justify-between border-b border-ink/15 pb-2 pt-2">
            <span className="text-sm font-semibold text-ink">{band.title}</span>
            {bandPrice(band.parts) ? <span className="font-mono text-[13px] text-ink/55">{bandPrice(band.parts)}</span> : null}
          </p>
          <ul>
            {band.parts.map((p) => {
              const state = stateOf(p.id);
              const php = partPrice(p.id);
              const gates = HUB_PRO_GATES.filter((g) => g.home === p.id);
              return (
                <li key={p.id} className="border-b border-ink/10" data-pro-part={p.id} data-pro-part-state={state}>
                  <details className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-ink">{p.name}</span>
                        <span className="block text-sm leading-snug text-ink/60">{p.blurb}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 pt-0.5">
                        {state === 'yours' ? (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-terracotta-700">
                            <Check aria-hidden className="h-4 w-4" strokeWidth={2.4} /> Yours
                          </span>
                        ) : state === 'review' ? (
                          <span className="text-sm font-semibold text-mulberry">Under review</span>
                        ) : php !== null ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-sm text-ink">
                            <PaidMark state="try" bare label="Event Hub Pro" size="xs" /> {formatPhp(php)}
                          </span>
                        ) : null}
                        <ChevronRight aria-hidden className="h-4 w-4 text-ink/40 transition-transform group-open:rotate-90" strokeWidth={2} />
                      </span>
                    </summary>
                    <div className="pb-4 pl-1">
                      {gates.length > 0 ? (
                        <ul className="space-y-1 text-sm text-ink/70" data-pro-part-gates="">
                          {gates.map((g) => (
                            <li key={g.id} className="flex gap-2">
                              <span aria-hidden className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-ink/30" />
                              <span>{g.gate}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {state === 'buy' && php !== null && !owned?.full ? (
                        <div className="mt-3">
                          {drawer({
                            serviceKey: p.sku,
                            name: `Event Hub Pro · ${p.name}`,
                            php: chargeOf(php),
                            label: `Unlock ${p.name} · ${formatPhp(chargeOf(php))}`,
                          })}
                          {chargeOf(php) < php ? (
                            <p className="mt-2 text-[13px] text-ink/60">This reaches everything — every part, and the footer comes off.</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="pt-2 text-center text-sm leading-snug text-ink/60">
        Everything you pay here counts toward everything.{fullPhp !== null ? ` At ${formatPhp(fullPhp)}, it all unlocks.` : ''} Every
        guest&rsquo;s ticket and the all-guests QR sheet are free for everyone.
      </p>
    </section>
  );
}
