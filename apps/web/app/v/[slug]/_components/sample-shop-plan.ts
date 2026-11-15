/**
 * The sample shop page's RULES — pure, no drawing (`sample-shop-page.tsx` draws them; it re-exports everything here).
 * Each plan difference is the page's own primitive, never typed: reach (`shopReach`), own web address
 * (`ownWebAddress` over `customWebsiteName`), pinned review (`premiumPage`), About + accent (`canPersonalize`), service
 * cards (`servicesPerLeaf`), branches (`branchesIncluded`). The look itself — verified or calm — follows `verified`,
 * exactly as `/v/[slug]` does (owner 13 Nov 2026, "two looks").
 */
import { ownWebAddress, pinnedQuote, shopReach, type ShopReach } from '@/lib/shop-page-plan';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { micrositeCan } from '@/lib/vendor-microsite';
import { nextSaturdays, type PeekDay } from './open-dates-peek';

/** The five plans a supplier can be on, in ladder order. `free` = not verified yet; `ultra` = the `enterprise` tier. */
export const SAMPLE_SHOP_PLAN_TIER = { free: 'free', verified: 'verified', solo: 'solo', pro: 'pro', ultra: 'enterprise' } as const;
export type SampleShopPlan = keyof typeof SAMPLE_SHOP_PLAN_TIER;
export const SAMPLE_SHOP_PLANS = Object.keys(SAMPLE_SHOP_PLAN_TIER) as SampleShopPlan[];

/** The sample shop — every word below is the sample's, never a real shop's. */
export const SAMPLE = {
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

/**
 * The sample shop's other branches (Tagaytay HQ) — sample data. As many as the top plan includes
 * (`branchesIncluded`, Ultra = 6); each plan draws the first `branchesIncluded` of them (`samplePlanBranchCities`).
 */
export const SAMPLE_BRANCH_CITIES = ['Lipa', 'Batangas City', 'Silang', 'Nasugbu', 'Calamba', 'Sta. Rosa'] as const;

const PHOTOS = '/marketing/for-suppliers-2026-11-06';
export const SAMPLE_CARDS = [
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
    personalize: can.canPersonalize,
    cardsPerCategory: caps.servicesPerLeaf,
  };
}

/**
 * The branches a plan's sample page draws — "Also in <city> · <city>" (owner 13 Nov 2026, DECISION_LOG "BRANCHES SHOW
 * ON THE SHOP PAGE, AS NEEDED": *"Show the branches as needed."* … *"the plan-preview miniatures for Pro/Ultra draw the
 * same line"*). The count is the plan's own `branchesIncluded` (lib/vendor-tier-caps.ts — Pro 3, Ultra 6, every other
 * plan 0), never typed here, so a plan without branches draws nothing. Pure.
 */
export function samplePlanBranchCities(plan: SampleShopPlan): readonly string[] {
  return SAMPLE_BRANCH_CITIES.slice(0, tierCaps(SAMPLE_SHOP_PLAN_TIER[plan]).branchesIncluded);
}

/**
 * The miniature's one caption line — each clause is a decision above, said in a few words (no new fact). Every verified
 * plan wears the same page (owner 13 Nov 2026, "two looks"), so the caption names what the PLAN adds to it.
 */
export function samplePlanCaption(plan: SampleShopPlan): string {
  const d = samplePlanShop(plan);
  const reach =
    d.reach.kind === 'ring' ? `${d.reach.km} km ring` : d.reach.kind === 'nationwide' ? 'Nationwide' : 'pin only, no ring';
  const parts: string[] = [];
  if (!d.verified) parts.push('Name shows once verified', reach, `${d.cardsPerCategory} card live`);
  else if (!d.personalize) parts.push('Your name on the photo with the Verified seal', reach);
  else {
    parts.push(reach);
    if (d.ownAddress) parts.push('your own web address');
    parts.push('About and your accent colour');
    if (d.quote) parts.push('pinned review');
    const branches = samplePlanBranchCities(plan).length;
    if (branches > 0) parts.push(`${branches} branches`);
  }
  const line = parts.join(' · ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * "Their real calendar" on sample days: the coming Saturdays from today (Manila), the second one not bookable, so the
 * peek shows both of its states. Drawn by the shipped `OpenDatesPeek` from the shipped `nextSaturdays`. Pure.
 */
export function samplePeekDays(today: string): PeekDay[] {
  const days = nextSaturdays(today, { from: today, to: '9999-12-31' }, []);
  return days.map((d, i) => (i === 1 ? { ...d, open: false } : d));
}
