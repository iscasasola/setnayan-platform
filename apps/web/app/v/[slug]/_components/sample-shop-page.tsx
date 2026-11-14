/**
 * SampleShopPage — THE one drawing of "your shop page on <plan>", on sample data, for the places that show a shop page
 * without a real shop behind it:
 *   · /dev/shop-plan-lab (dev only — the lab the supplier website by plan was built on, owner-approved 2026-10-30);
 *   · /for-suppliers § 13 · PLANS (ruling 5735, owner-approved 13 Nov 2026, corpus
 *     `prototypes/plan_previews_2026-11-13/index.html`): each plan card's 3:4 miniature AND the full-screen view it rises
 *     into are THIS component — the miniature is it scaled, never a separate picture;
 *   · /for-coordinators "Your page is your marketing tool" — the Verified page, in the same miniature row.
 *
 * 🪞 THE SAMPLE IS THE REAL PAGE (owner 13 Nov 2026, DECISION_LOG "THREE PUBLIC PAGES APPROVED — AND THE FRONT PAGES
 * FOLLOW": *"also adapt the frontpages that shows a sample page and where the websites are presented"*). Since #7574 the
 * shop page has two looks, and this drawing is built from the SAME shipped pieces `/v/[slug]` renders:
 *   · verified (Verified · Solo · Pro · Ultra alike) → `ShopHero` (the name on the photo, the circular Verified seal +
 *     `SealCaption`), the calling card (`SHOP_CALLING_CARD_CLASS`) with the open-dates peek (`OpenDatesPeek`) and the
 *     one filled Inquire, `ShopSectionBar` (About · Services · Reviews), the "can't do" panel (`ShopCanDoPanel`);
 *   · free (not verified yet) → the calm column (`SHOP_CALM_COLUMN_CLASS`) under `NotYetVerifiedNotice`, the section bar
 *     Services · Reviews · Where, the pin-only map under Where; no date check, no web address.
 * Plus the card pieces it always mounted — `ShopReachLine` + `ShopReachMap`, `ShopAddresses`, `ShopBranchesLine`,
 * `PinnedReviewCard`. What still differs by plan is decided with the page's own primitives, never typed:
 *   · reach            → `shopReach` (lib/shop-page-plan.ts over `serviceRadiusKm`, lib/vendor-tier-caps.ts);
 *   · own web address  → `ownWebAddress` over `tierCaps(tier).customWebsiteName` (Solo+);
 *   · pinned review    → `tierCaps(tier).premiumPage` (Pro+);
 *   · About + accent colour → `micrositeCan(tier).canPersonalize` (Solo+) and `micrositeAccentVars` (the page's own);
 *   · service cards    → `tierCaps(tier).servicesPerLeaf`;
 *   · branches         → `tierCaps(tier).branchesIncluded` (`samplePlanBranchCities`).
 *
 * It is a DRAWING: the buttons are the page's buttons, drawn (no door to a shop that does not exist), and the hero name
 * is a paragraph — the page it sits in owns its headings (`ShopHero frame="sample"`, which also keeps the phone sizes
 * at any screen width, since the drawing lives in a phone-width frame). It is marked "Sample shop" (owner, 13 Nov 2026:
 * *"make it sample shop instead of demo only"*) — an illustration, not a demo shop row; real `is_demo` shops keep
 * "(DEMO ONLY)". Server-rendered; the client parts are the shipped map, the ⓘ and the section bar.
 */
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { MessageCircle, Send, Bookmark, Share } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { ImageBadge } from '@/app/_components/image-badge';
import { SampleMarker } from '@/app/_components/sample-marker';
import { ShopReachLine, ShopReachMap } from './shop-reach';
import { ShopAddresses } from './shop-addresses';
import { ShopBranchesLine } from './shop-branches-line';
import { PinnedReviewCard } from './pinned-review-card';
import { NotYetVerifiedNotice } from './not-yet-verified-notice';
import { ShopHero, SealCaption, shopMotion } from './shop-hero';
import { ShopSectionBar, type ShopSectionTab } from './shop-section-bar';
import { ShopCanDoPanel } from './shop-can-do-panel';
import { OpenDatesPeek } from './open-dates-peek';
import { CheckADateLink } from './check-a-date-link';
import { SHOP_CALLING_CARD_CLASS, SHOP_CALM_COLUMN_CLASS, SHOP_CARD_SECTION_CLASS } from './shop-columns';
import { verifiedBadge } from '@/lib/shop-badges';
import { badgeImageOf } from '@/lib/shop-badge-row';
import { pinnedQuote } from '@/lib/shop-page-plan';
import { micrositeAccentVars } from '@/lib/vendor-microsite';
import { todayInManila } from '@/lib/schedule-shift-notice';
import { SAMPLE, SAMPLE_CARDS, samplePeekDays, samplePlanShop, type SampleShopPlan } from './sample-shop-plan';

// The plan rules live in a pure module (tests read them without the page's CSS); every importer keeps this address.
export {
  SAMPLE_BRANCH_CITIES,
  SAMPLE_SHOP_PLAN_TIER,
  SAMPLE_SHOP_PLANS,
  samplePeekDays,
  samplePlanBranchCities,
  samplePlanCaption,
  samplePlanShop,
  type SampleShopPlan,
} from './sample-shop-plan';

/** The drawn button look — the page's own classes, with no door behind them. */
const DRAWN_PRIMARY = 'button-primary inline-flex items-center gap-2';
const DRAWN_SECONDARY = 'button-secondary inline-flex items-center gap-2';

/**
 * `branchCities` — the shop's other branches, drawn by the shipped `ShopBranchesLine` ("Also in …", PR #7561). The lab
 * passes as many as its `?branches=` asks; the /for-suppliers plan cards pass `samplePlanBranchCities(plan)` — the
 * plan's included branches, so Pro and Ultra draw the line and the others do not (owner 13 Nov 2026, "Show the
 * branches as needed", which settled the question ruling 5735 left open).
 */
export function SampleShopPage({
  plan,
  declaredOuterKm = null,
  branchCities = [],
}: {
  plan: SampleShopPlan;
  declaredOuterKm?: number | null;
  branchCities?: readonly string[];
}) {
  const d = samplePlanShop(plan, declaredOuterKm);
  const name = d.verified ? SAMPLE.name : SAMPLE.placeholder;
  const accentVars = d.personalize ? micrositeAccentVars(SAMPLE.accent) : undefined;
  const cards = SAMPLE_CARDS.slice(0, Math.max(1, Math.min(d.cardsPerCategory, SAMPLE_CARDS.length)));
  // Each plan's drawing has its own ids, so five drawings (and a sheet) on one page never share an anchor.
  const id = (part: string) => `sample-${plan}-${part}`;
  const tabs: ShopSectionTab[] = d.verified
    ? [
        { id: id('about'), label: 'About' },
        { id: id('services'), label: 'Services' },
        { id: id('reviews'), label: 'Reviews' },
      ]
    : [
        { id: id('services'), label: 'Services' },
        { id: id('reviews'), label: 'Reviews' },
        { id: id('where'), label: 'Where' },
      ];
  const seal = verifiedBadge();

  return (
    <div
      id={id('top')}
      data-sample-shop-page={plan}
      className={`min-h-full bg-page text-ink ${d.verified ? shopMotion.verified : ''}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-ink/5 px-4 py-4">
        <Wordmark size={22} />
        <SampleMarker>Sample shop</SampleMarker>
      </div>
      {d.verified ? (
        <ShopHero
          frame="sample"
          name={name}
          kicker={SAMPLE.kicker}
          tagline={SAMPLE.tagline}
          photoUrl={SAMPLE_CARDS[0].photo}
          photoIsMarked={false}
          badges={
            <div data-shop-hero-badges="" className="flex flex-wrap items-center gap-2">
              <span className="inline-flex leading-[0]" data-shop-badge={seal.key}>
                <ImageBadge {...badgeImageOf(seal)} uid={`sample-${plan}-verified`} size={48} label={seal.label} drawn />
              </span>
              <SealCaption />
            </div>
          }
        />
      ) : null}

      <div
        className={`w-full px-4 ${d.verified ? 'pb-12' : `py-8 ${shopMotion.calm}`}`}
        style={accentVars as CSSProperties | undefined}
      >
        {d.verified ? null : (
          <div className={SHOP_CALM_COLUMN_CLASS}>
            <NotYetVerifiedNotice />
          </div>
        )}
        <div className={d.verified ? '' : SHOP_CALM_COLUMN_CLASS}>
          {/* 🎴 Verified: the raised calling card over the hero's foot. Unverified: the calm, profile-like header. */}
          <div data-sample-card="" className={d.verified ? `${SHOP_CALLING_CARD_CLASS} ${shopMotion.card}` : 'min-w-0'}>
            <section className={SHOP_CARD_SECTION_CLASS}>
              <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
                {d.verified ? SAMPLE.initials : '?'}
              </span>
              <div className="w-full min-w-0 space-y-2">
                {d.verified ? (
                  <p className="text-[1.02rem] font-semibold leading-snug text-ink">{name}</p>
                ) : (
                  <>
                    <p className="font-serif text-4xl font-normal italic tracking-[-0.02em] text-ink">{name}</p>
                    <p className="text-base text-ink/70">{SAMPLE.tagline}</p>
                  </>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
                  {d.verified ? <ShopReachLine reach={d.reach} city={SAMPLE.city} /> : null}
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Replies in your Setnayan inbox
                  </span>
                </div>
                {branchCities.length > 0 ? <ShopBranchesLine cities={branchCities} hqCity={SAMPLE.city} /> : null}
                {d.verified ? <OpenDatesPeek days={samplePeekDays(todayInManila())} checkHref={null} /> : null}
                {/* The calling card's row, in the page's order: Inquire (filled) · Add to your event, then Check a date
                    (verified only) · Share. Drawn — there is no shop behind the sample to message. */}
                <div className="flex flex-wrap items-center gap-2 pt-4">
                  <span className={DRAWN_PRIMARY}>
                    <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Inquire
                  </span>
                  <span className={DRAWN_SECONDARY}>
                    <Bookmark className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Add to your event
                  </span>
                  {d.verified ? <CheckADateLink href={null} className={DRAWN_SECONDARY} /> : null}
                  <span className={DRAWN_SECONDARY}>
                    <Share className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Share
                  </span>
                </div>
                {d.verified ? (
                  <>
                    <ShopReachMap reach={d.reach} latitude={SAMPLE.lat} longitude={SAMPLE.lng} city={SAMPLE.city} mapHref={null} />
                    <ShopAddresses setnayanAddress={SAMPLE.setnayanAddress} ownAddress={d.ownAddress} />
                  </>
                ) : null}
                {d.quote ? (
                  <PinnedReviewCard quote={d.quote} stars={5} author="Verified couple" when="Mar 2026" reviewsHref={`#${id('reviews')}`} />
                ) : null}
              </div>
            </section>
          </div>

          <div className="min-w-0">
            <ShopSectionBar tabs={tabs} topId={id('top')} />

            {d.verified ? (
              <div id={id('about')} data-shop-section="" className="scroll-mt-14">
                {d.personalize ? (
                  /* the page's About (Solo+), in the verified look's large serif */
                  <section data-sample-about="" className="space-y-3 border-b border-ink/10 py-8">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">About</p>
                    <p className="max-w-3xl font-serif text-[1.75rem] italic leading-[1.18] tracking-[-0.005em] text-ink">
                      {SAMPLE.about}
                    </p>
                  </section>
                ) : null}
                <div className="py-6">
                  <ShopCanDoPanel checkHref={null} hasPackages={false} />
                </div>
              </div>
            ) : null}

            <div id={id('services')} data-shop-section="" className="scroll-mt-14">
              <section data-sample-cards={cards.length} className="space-y-3 border-b border-ink/10 py-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Services &amp; pricing</p>
                <p className="text-sm text-ink/65">Starting prices set by the shop. Final quotes happen in chat.</p>
                <div className="grid gap-3">
                  {cards.map((c) => (
                    <div key={c.title} data-service-card="" className="overflow-hidden rounded-2xl bg-ink/[0.03] shadow-sm">
                      <div className="relative h-28 w-full bg-ink/5">
                        <Image src={c.photo} alt="" fill sizes="430px" className="object-cover" />
                      </div>
                      <div className="space-y-1 px-4 pb-4 pt-3">
                        <p className="text-base font-medium text-ink">{c.title}</p>
                        <p className="text-sm text-ink/60">{c.line}</p>
                        <p className="pt-1 text-sm font-medium text-terracotta-700">Choose this service →</p>
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

            <div id={id('reviews')} data-shop-section="" className="scroll-mt-14">
              <section className="space-y-3 border-b border-ink/10 py-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Reviews</p>
                <PinnedReviewCard
                  quote={pinnedQuote(SAMPLE.review) ?? SAMPLE.review}
                  stars={5}
                  author="Verified couple"
                  when="Mar 2026"
                  reviewsHref={`#${id('reviews')}`}
                />
              </section>
            </div>

            {d.verified ? null : (
              /* the unverified page's Where: the reach line and the pin, no ring */
              <div id={id('where')} data-shop-section="" className="scroll-mt-14">
                <section className="space-y-3 border-b border-ink/10 py-8">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Where</p>
                  <p className="text-sm text-ink/70">
                    <ShopReachLine reach={d.reach} city={SAMPLE.city} />
                  </p>
                  <ShopReachMap reach={d.reach} latitude={SAMPLE.lat} longitude={SAMPLE.lng} city={SAMPLE.city} mapHref={null} />
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="px-4 pb-10 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        Sample shop · drawn, not a real shop
      </p>
    </div>
  );
}
