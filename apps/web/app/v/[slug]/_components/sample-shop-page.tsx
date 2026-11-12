/**
 * SampleShopPage — THE one drawing of "your shop page on <plan>", on sample data, for the two places that show a plan's
 * page without a real shop behind it:
 *   · /dev/shop-plan-lab (dev only — the lab the supplier website by plan was built on, owner-approved 2026-10-30);
 *   · /for-suppliers § 13 · PLANS (ruling 5735, owner-approved 13 Nov 2026, corpus
 *     `prototypes/plan_previews_2026-11-13/index.html`): each plan card's 3:4 miniature AND the full-screen view it rises
 *     into are THIS component — the miniature is it scaled, never a separate picture.
 *
 * 🔑 NOT A SECOND COPY OF THE PAGE'S RULES. It mounts the REAL card-column pieces `/v/[slug]` renders — `ShopReachLine`
 * + `ShopReachMap` (the shipped `ReachMap` / pin map), `ShopAddresses`, `PinnedReviewCard`, `ShopBadgePill`,
 * `NotYetVerifiedNotice` — and decides every plan difference with the page's own primitives:
 *   · reach            → `shopReach` (lib/shop-page-plan.ts over `serviceRadiusKm`, lib/vendor-tier-caps.ts);
 *   · own web address  → `ownWebAddress` over `tierCaps(tier).customWebsiteName` (Solo+);
 *   · pinned review + cover band → `tierCaps(tier).premiumPage` (Pro+, the page's `premiumLayout`);
 *   · cinematic hero with the name on the photo → `micrositeCan(tier).isEnterprise` (Ultra, the page's `cinematicHero`);
 *   · About + accent colour → `micrositeCan(tier).canPersonalize` (Solo+) and `micrositeAccentVars` (the page's own);
 *   · service cards    → `tierCaps(tier).servicesPerLeaf`.
 * The hero, About and service-card blocks are drawn on the page's own classes (`app/v/[slug]/page.tsx`, the
 * `cinematicHero` / `heroPhotoUrl` branches and the About section); they are inline in that page, not components.
 *
 * No headings inside: the drawing sits in another page (the supplier front page has its own h1/h2 and styles them), so
 * the name and the About label are paragraphs with the page's classes — the look is the same, the outline is not lied to.
 * Every word marks itself as a sample ("Sample shop"). Server-rendered; the only client parts are the shipped map and ⓘ.
 */
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { MessageCircle, Send, CalendarCheck } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { SampleMarker } from '@/app/_components/sample-marker';
import { ShopReachLine, ShopReachMap } from './shop-reach';
import { ShopAddresses } from './shop-addresses';
import { PinnedReviewCard } from './pinned-review-card';
import { NotYetVerifiedNotice } from './not-yet-verified-notice';
import { ownWebAddress, pinnedQuote, shopReach, type ShopReach } from '@/lib/shop-page-plan';
import { verifiedBadge } from '@/lib/shop-badges';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { micrositeAccentVars, micrositeCan } from '@/lib/vendor-microsite';

/** The five plans a supplier can be on, in ladder order. `free` = not verified yet; `ultra` = the `enterprise` tier. */
export const SAMPLE_SHOP_PLAN_TIER = { free: 'free', verified: 'verified', solo: 'solo', pro: 'pro', ultra: 'enterprise' } as const;
export type SampleShopPlan = keyof typeof SAMPLE_SHOP_PLAN_TIER;
export const SAMPLE_SHOP_PLANS = Object.keys(SAMPLE_SHOP_PLAN_TIER) as SampleShopPlan[];

/** The sample shop — every word below is the sample's, never a real shop's. */
const SAMPLE = {
  name: 'Sampaguita Table',
  placeholder: 'A caterer in Tagaytay',
  initials: 'ST',
  tagline: 'Filipino feasts, plated or family-style',
  kicker: 'Catering · Tagaytay',
  city: 'Tagaytay',
  lat: 14.1153,
  lng: 120.9621,
  setnayanAddress: 'setnayan.com/sampaguita-table',
  domain: 'sampaguitatable.com',
  review: 'Plated service ran on time for 180 guests — the kare-kare got asked about all night.',
  about:
    'Two of us cook, four of us serve. We plate Filipino food the way a lola would want it seen — generous, warm, and on time. Tasting is free before you book.',
  /** A preset accent (lib/vendor-microsite.ts MICROSITE_ACCENTS), so Solo+ shows a page retinted by the page's own vars. */
  accent: 'sage',
} as const;

const PHOTOS = '/marketing/for-suppliers-2026-11-06';
const SAMPLE_CARDS = [
  { title: 'Plated dinner', line: '3-course menu · service staff · tableware', photo: `${PHOTOS}/supplier-caterer-hero.webp` },
  { title: 'Family-style feast', line: 'Shared platters · rice station · service staff', photo: `${PHOTOS}/supplier-team-hero.webp` },
  { title: 'Grazing table', line: 'Cheese · fruit · charcuterie · styled table', photo: `${PHOTOS}/15-consultation.webp` },
] as const;

/** What the page decides for one plan — read from the shipped rules, never typed. Pure. */
export function samplePlanShop(plan: SampleShopPlan, declaredOuterKm: number | null = null) {
  const tier = SAMPLE_SHOP_PLAN_TIER[plan];
  const verified = plan !== 'free';
  const caps = tierCaps(tier);
  const can = micrositeCan(tier);
  const reach: ShopReach = shopReach({ verified, tier, declaredOuterKm });
  return {
    tier,
    verified,
    reach,
    ownAddress: ownWebAddress({ planAllows: caps.customWebsiteName, domain: SAMPLE.domain, verifiedAt: '2026-10-01' }),
    quote: caps.premiumPage ? pinnedQuote(SAMPLE.review) : null,
    coverBand: caps.premiumPage && !can.isEnterprise,
    cinematicHero: can.isEnterprise,
    personalize: can.canPersonalize,
    cardsPerCategory: caps.servicesPerLeaf,
  };
}

/** The miniature's one caption line — each clause is a decision above, said in a few words (no new fact). */
export function samplePlanCaption(plan: SampleShopPlan): string {
  const d = samplePlanShop(plan);
  const reach =
    d.reach.kind === 'ring' ? `${d.reach.km} km ring` : d.reach.kind === 'nationwide' ? 'Nationwide' : 'pin only, no ring';
  const parts: string[] = [];
  if (!d.verified) parts.push('Name shows once verified', reach, `${d.cardsPerCategory} card live`);
  else if (!d.personalize) parts.push('Your name and the Verified seal', reach);
  else {
    parts.push(reach);
    if (d.cinematicHero) parts.push('your name on the photo', 'flagship page');
    else if (d.coverBand) {
      parts.push('cover photo');
      if (d.quote) parts.push('pinned review');
      parts.push('premium page');
    } else {
      if (d.ownAddress) parts.push('your own web address');
      parts.push('About and your accent colour');
    }
  }
  const line = parts.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

export function SampleShopPage({ plan, declaredOuterKm = null }: { plan: SampleShopPlan; declaredOuterKm?: number | null }) {
  const d = samplePlanShop(plan, declaredOuterKm);
  const name = d.verified ? SAMPLE.name : SAMPLE.placeholder;
  const accentVars = d.personalize ? micrositeAccentVars(SAMPLE.accent) : undefined;
  const cards = SAMPLE_CARDS.slice(0, Math.max(1, Math.min(d.cardsPerCategory, SAMPLE_CARDS.length)));

  return (
    <div
      data-sample-shop-page={plan}
      className="min-h-full bg-cream text-ink"
      style={accentVars as CSSProperties | undefined}
    >
      <div className="flex items-center justify-between gap-4 border-b border-ink/5 px-4 py-4">
        <Wordmark size={22} />
        <SampleMarker>Sample shop</SampleMarker>
      </div>
      {d.verified ? null : <NotYetVerifiedNotice />}
      <div className="space-y-8 px-4 pb-10 pt-8">
        {d.cinematicHero ? (
          /* the page's Enterprise flagship branch — the name on the photo */
          <div data-sample-hero="cinematic" className="relative h-80 w-full overflow-hidden rounded-2xl bg-ink">
            <Image src={SAMPLE_CARDS[0].photo} alt="" fill sizes="430px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cream/80">{SAMPLE.kicker}</p>
              <p className="mt-3 font-serif text-4xl font-normal italic tracking-[-0.02em] text-cream">{name}</p>
              <p className="mt-2 max-w-xl text-base text-cream/85">{SAMPLE.tagline}</p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cream px-5 py-2.5 text-sm font-medium text-ink">
                <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Inquire
              </span>
            </div>
          </div>
        ) : d.coverBand ? (
          /* the page's Pro hero-photo band */
          <div data-sample-hero="band" className="relative h-44 w-full overflow-hidden rounded-2xl bg-ink/5">
            <Image src={SAMPLE_CARDS[1].photo} alt="" fill sizes="430px" className="object-cover" />
          </div>
        ) : null}

        <section className="flex flex-col items-start gap-6 border-b border-ink/10 pb-8">
          <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
            {d.verified ? SAMPLE.initials : '?'}
          </span>
          <div className="w-full min-w-0 space-y-2">
            {d.cinematicHero ? null : (
              <>
                <p className="font-serif text-4xl font-normal italic tracking-[-0.02em] text-ink">{name}</p>
                <p className="text-base text-ink/70">{SAMPLE.tagline}</p>
              </>
            )}
            {d.verified ? <ShopBadgePill badge={verifiedBadge()} className="w-fit" /> : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
              <ShopReachLine reach={d.reach} city={SAMPLE.city} />
              <span className="inline-flex items-center gap-1">
                <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Replies in your Setnayan inbox
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-cream">
                <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Inquire
              </span>
              <span className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink">
                <CalendarCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Check a date
              </span>
            </div>
            <ShopReachMap reach={d.reach} latitude={SAMPLE.lat} longitude={SAMPLE.lng} city={SAMPLE.city} />
            <ShopAddresses setnayanAddress={SAMPLE.setnayanAddress} ownAddress={d.ownAddress} />
            {d.quote ? <PinnedReviewCard quote={d.quote} stars={5} author="Verified couple" when="Mar 2026" /> : null}
          </div>
        </section>

        {d.personalize ? (
          /* the page's About section (Solo+) */
          <section data-sample-about="" className="space-y-3 border-b border-ink/10 pb-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">About</p>
            <p className="max-w-2xl text-base leading-relaxed text-ink/75">{SAMPLE.about}</p>
          </section>
        ) : null}

        <section data-sample-cards={cards.length} className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Services &amp; pricing</p>
          <p className="text-sm text-ink/65">Starting prices set by the shop. Final quotes happen in chat.</p>
          <div className="grid gap-3">
            {cards.map((c) => (
              <div key={c.title} className="overflow-hidden rounded-2xl bg-ink/[0.03] shadow-sm">
                <div className="relative h-28 w-full bg-ink/5">
                  <Image src={c.photo} alt="" fill sizes="430px" className="object-cover" />
                </div>
                <div className="space-y-1 px-4 pb-4 pt-3">
                  <p className="text-base font-medium text-ink">{c.title}</p>
                  <p className="text-sm text-ink/60">{c.line}</p>
                  <p className="pt-1 text-sm font-medium text-terracotta-700">Inquire about this →</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-ink/60">
            {d.verified
              ? `Up to ${d.cardsPerCategory} service card${d.cardsPerCategory === 1 ? '' : 's'} per category on this plan.`
              : `${d.cardsPerCategory} live · more open once verified.`}
          </p>
        </section>
      </div>
      <p className="px-4 pb-10 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        Sample shop · drawn, not a real shop
      </p>
    </div>
  );
}
