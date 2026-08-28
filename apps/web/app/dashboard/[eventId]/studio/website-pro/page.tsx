import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock, Globe2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import {
  eventOwnsCoupleWebsitePro,
  eventCoupleWebsiteProActive,
} from '@/lib/couple-website-pro';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { PageMasthead } from '@/app/_components/page-masthead';
import { StudioBuyHero } from '@/app/dashboard/[eventId]/studio/_components/studio-buy-hero';
import { addOnHeroCopy } from '@/lib/add-ons-catalog';

export const metadata = { title: 'Event Hub PRO' };

/* Name + promise from the one record every Studio row reads — never a second
   sentence written into this page. Throws rather than rendering a nameless
   hero if the catalog key is ever renamed. */
const HERO = addOnHeroCopy('website-pro');

const SKU_CODE = 'COUPLE_WEBSITE_PRO';

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

type Props = { params: Promise<{ eventId: string }> };

const WEBSITE_HUB_HREF = (eventId: string) => `/dashboard/${eventId}/website`;

/**
 * Every line here is a thing a couple WITHOUT this upgrade is refused, checked
 * against the gate that refuses them. Nothing else belongs in this list.
 *   1 → SKU_OWNERSHIP_ALIASES grants STD_PREMIUM_OPENINGS, and the reveal is
 *       sold nowhere else (its own row is off sale, so this is the only door).
 *   2 → website/site-chrome gates the looping music + the video hero.
 *   3 → website/our-photos renders WebsiteProLock without this.
 *   4 → website/colors refuses to persist a colour without this, server-side.
 *   5 → the watermark drops on the Event Hub, the recap, the printable sheet
 *       and the story — four surfaces, all reading this one SKU.
 */
const BENEFITS = [
  'The cinematic reveal on your Save the Date — it comes only with this.',
  'Background music and a video across the top of your Event Hub.',
  'Your own photo gallery on your Event Hub — your engagement or pre-wedding photos.',
  'Your own colours for the page and its buttons.',
  'The Setnayan mark taken off everywhere your guests see it — the page, the printable version, your story and the recap.',
];

export default async function WebsiteProBuyPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Purchaser-scoped under orders RLS → admin client so a co-host sees the
  // owned state too.
  const admin = createAdminClient();

  // active — admin-approved (feature unlocked). owned — owned INCLUDING a
  // pending 'submitted' order (double-buy prevention). owned && !active ⇒
  // payment under review.
  const [active, owned] = await Promise.all([
    eventCoupleWebsiteProActive(admin, eventId).catch(() => false),
    eventOwnsCoupleWebsitePro(admin, eventId).catch(() => false),
  ]);

  const supabase = await createClient();
  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? null;
  const priceCentavos = skuRecord?.price_centavos ?? null;
  const settings = await fetchPlatformSettings(supabase);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to services
      </Link>

      {/*
        The buy state opens with the product's name, its promise and its price;
        every other state keeps the quiet masthead. `PageMasthead` renders its
        title `sr-only` — right for a page you live in, wrong for the one state
        where nothing has been decided yet. ⚠ One h1 per page: either/or.
      */}
      {active || owned ? (
        <PageMasthead title={HERO.label} />
      ) : (
        <StudioBuyHero
          productName={HERO.label}
          promise={HERO.blurb}
          price={pricePhp != null ? formatPhp(pricePhp) : undefined}
          priceNote={pricePhp != null ? 'One upgrade, for the whole Event Hub' : undefined}
        />
      )}

      {/* What it covers — benefit language, no implementation names. */}
      <ul className="sn-tile space-y-2 p-5">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-ink/75">
            <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" strokeWidth={1.75} />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {active ? (
        /* ── Owned + admin-approved. ── */
        <div className="rounded-xl border border-success-200 bg-success-50 p-5">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-success-800">
            <CheckCircle2 aria-hidden className="h-5 w-5" strokeWidth={2} /> Unlocked
          </p>
          <p className="text-sm text-ink/70">
            Event Hub PRO is active. Every premium touch is on across your Event Hub, watermark-free.
          </p>
          <Link
            href={WEBSITE_HUB_HREF(eventId)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            Open your Event Hub
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      ) : owned ? (
        /* ── Pending order (submitted, not yet approved). No second drawer. ── */
        <div className="rounded-xl border border-mulberry/20 bg-mulberry/5 p-5">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-mulberry">
            <Clock aria-hidden className="h-5 w-5" strokeWidth={1.75} /> Payment under review
          </p>
          <p className="text-sm text-ink/70">
            We&rsquo;ve received your Event Hub PRO order. Our team reconciles within one business day —
            you&rsquo;ll get an email when it moves to approved, and every premium touch unlocks
            automatically.
          </p>
          <Link
            href={`/dashboard/${eventId}/orders`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-mulberry underline underline-offset-2 hover:text-mulberry-600"
          >
            Track your order
          </Link>
        </div>
      ) : priceCentavos != null && pricePhp != null ? (
        /* ── NOT OWNED — the working buy drawer. ── */
        <InlineCheckoutDrawer
          serviceKey={SKU_CODE}
          displayName="Event Hub PRO"
          originalPriceCentavos={String(priceCentavos)}
          eventId={eventId}
          settings={settings}
          triggerLabel="Unlock Event Hub PRO"
        />
      ) : (
        <p className="text-sm text-ink/65">
          Pricing loads from your catalog &mdash; please refresh in a moment.
        </p>
      )}
    </section>
  );
}
