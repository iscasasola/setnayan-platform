import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import Link from 'next/link';
import { studioHubHref } from '@/lib/studio-hub';
import { redirect } from 'next/navigation';
import { ArrowLeft, Diamond, Globe2, ImageIcon, Sparkles } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import {
  eventOwnsCoupleWebsitePro,
  eventCoupleWebsiteProActive,
} from '@/lib/couple-website-pro';
import { PageMasthead } from '@/app/_components/page-masthead';
import { addOnHeroCopy } from '@/lib/add-ons-catalog';
import { ServicePageBand } from '@/app/dashboard/[eventId]/studio/_components/service-page-band';
import { HubProSections } from './_components/hub-pro-sections';
import { HUB_PRO_NAMES, hubProGlance } from '@/lib/services-glance';
import { homeCoverAndHubLookFor } from '@/lib/home-cover.server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { UNLOCK_AND_APPLY_PARAM } from '@/lib/hub-pro-effects';

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

type Props = { params: Promise<{ eventId: string }>; searchParams?: Promise<{ from?: string; then?: string; buy_error?: string }> };


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
  // Colours left this list 2026-09-28 — they are free for every couple now
  // (owner: "only when you start adding themes will it be pro. adding media
  // for background"). Media behind a scene or the page is what Pro adds.
  'Your own photo or video behind any scene, or behind the whole page.',
  'A Pro theme for your invite link — it opens on your own photo, in your colour.',
  'The Setnayan mark taken off everywhere your guests see it — the page, the printable version, your story and the recap.',
];

export default async function WebsiteProBuyPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  /* 💎 From the Maker's Apply sheet (`?from=maker`, owner 2026-09-28): the way
     back is the Maker, where the draft — every Pro effect they tried — waits
     untouched. A closed value, never a URL from the request. */
  const search = (await searchParams) ?? {};
  const fromMaker = search.from === 'maker';
  /* "Unlock Pro and Apply" (owner 2026-09-28): back in the Maker with
     `?apply=1`, which applies the draft once Pro is active — or reopens the
     sheet, draft untouched, when it is not (`unlockAndApplyOnReturn`). */
  const back = fromMaker
    ? {
        href: `/dashboard/${eventId}/launch${search.then === 'apply' ? `?${UNLOCK_AND_APPLY_PARAM}=1` : ''}`,
        label: 'Back to the Maker',
      }
    : { href: studioHubHref(eventId), label: 'Back to services' };

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // active — admin-approved (feature unlocked). owned — owned INCLUDING a
  // pending 'submitted' order (double-buy prevention). owned && !active ⇒
  // waiting for payment. Both ride the render's one orders read.
  const [active, owned, storeShell] = await Promise.all([
    eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId).catch(() => false),
    eventOwnsCoupleWebsitePro(await eventEntitlementClient(eventId), eventId).catch(() => false),
    isStoreShellRequest(),
  ]);

  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? null;
  // What Pro has unlocked on THIS event — read only for an owner (the cover's own two reads).
  const look = active ? (await homeCoverAndHubLookFor(eventId).catch(() => null))?.look ?? null : null;

  /* ✅ EVENT HUB PRO'S ONE BAND (owner 2026-10-14 🧾 + ✅ the services prototype): owned
     "Pro on · <theme> · <background>" · Open the Maker; not added → the price and "Add for ₱…"
     (the one sheet → /pay). ◆ marks Pro and never blocks: the free Maker stays a door. */
  const glance = hubProGlance({
    ownership: active ? 'on' : owned ? 'waiting' : 'none',
    price: pricePhp,
    theme: look?.theme ?? null,
    background: look?.background ?? null,
  });

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft aria-hidden className="h-4 w-4" /> {back.label}
      </Link>

      <PageMasthead title={HERO.label} />

      <div>
        <ServicePageBand name={HUB_PRO_NAMES.plain} brand={HUB_PRO_NAMES.brand} eventId={eventId} glance={glance} label="Your Event Hub Pro" storeShell={storeShell} buyError={search.buy_error ?? null} />
        {/* ✅ THE SECTIONS AS DRAWN (prototype `sections('hub')`) — each opens the Maker, where a theme
            or a background is picked; a ◆ choice is tried freely and applied with Pro. */}
        <HubProSections eventId={eventId} on={active} theme={look?.theme ?? null} background={look?.background ?? null} />
      </div>

      {/* What it covers — benefit language, no implementation names. */}
      <ul className="sn-tile space-y-2 p-5">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-ink/75">
            <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" strokeWidth={1.75} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
