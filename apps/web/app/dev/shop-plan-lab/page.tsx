/**
 * /dev/shop-plan-lab — the public shop page's (`/v/[slug]`) card column by plan, on fixture data, for the supplier
 * website by plan (owner-approved 2026-10-30, `prototypes/build-contracts-2026-10-30/supplier-website-by-plan/`). No
 * sign-in, no database. DEV-ONLY: production builds 404 this route first thing. It mounts the REAL pieces the page
 * renders — `ShopReachLine` + `ShopReachMap` (the shipped `ReachMap`), `ShopAddresses`, `PinnedReviewCard` — and
 * decides them with the page's own rules (`lib/shop-page-plan.ts` over `lib/vendor-tier-caps.ts`), never a copy.
 *
 *   ?plan=free|verified|solo|pro|ultra    (free = not verified yet; ultra = the `enterprise` tier)
 *   &outer=N                              the shop's own declared furthest distance (clamped to the plan)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { ShopReachLine, ShopReachMap } from '@/app/v/[slug]/_components/shop-reach';
import { ShopAddresses } from '@/app/v/[slug]/_components/shop-addresses';
import { PinnedReviewCard } from '@/app/v/[slug]/_components/pinned-review-card';
import { ownWebAddress, pinnedQuote, shopReach } from '@/lib/shop-page-plan';
import { verifiedBadge } from '@/lib/shop-badges';
import { tierCaps } from '@/lib/vendor-tier-caps';

const PLAN_TIER = { free: 'free', verified: 'verified', solo: 'solo', pro: 'pro', ultra: 'enterprise' } as const;
type Plan = keyof typeof PLAN_TIER;

export default async function ShopPlanLabPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; outer?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const plan: Plan = sp.plan && sp.plan in PLAN_TIER ? (sp.plan as Plan) : 'free';
  const tier = PLAN_TIER[plan];
  const verified = plan !== 'free';
  const caps = tierCaps(tier);
  const reach = shopReach({ verified, tier, declaredOuterKm: sp.outer ? Number(sp.outer) : null });
  const ownAddress = ownWebAddress({ planAllows: caps.customWebsiteName, domain: 'sampaguitatable.com', verifiedAt: '2026-10-01' });
  const quote = caps.customWebsiteName
    ? pinnedQuote('Plated service ran on time for 180 guests — the kare-kare got asked about all night.')
    : null;
  const name = verified ? 'Sampaguita Table' : 'A caterer in Tagaytay';

  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <Wordmark size={22} />
          </Link>
          <span className="hidden text-sm font-medium text-ink/70 sm:inline">Plan with Setnayan</span>
        </div>
      </header>
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section className="flex flex-col items-start gap-6 border-b border-ink/10 pb-8 sm:flex-row">
          <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
            ST
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45" data-lab-plan={plan}>
              Lab · {plan}
            </p>
            <h1 className="font-serif text-4xl font-normal italic tracking-[-0.02em] text-ink sm:text-5xl">{name}</h1>
            <p className="text-base text-ink/70">Filipino feasts, plated or family-style</p>
            {verified ? <ShopBadgePill badge={verifiedBadge()} className="w-fit" /> : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
              <ShopReachLine reach={reach} city="Tagaytay" />
              <span className="inline-flex items-center gap-1">
                <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Replies in your Setnayan inbox
              </span>
            </div>
            <ShopReachMap reach={reach} latitude={14.1153} longitude={120.9621} city="Tagaytay" />
            <ShopAddresses setnayanAddress="setnayan.com/sampaguita-table" ownAddress={ownAddress} />
            {quote ? (
              <PinnedReviewCard quote={quote} stars={5} author="Verified couple" when="Mar 2026" />
            ) : null}
          </div>
        </section>
      </article>
    </main>
  );
}
