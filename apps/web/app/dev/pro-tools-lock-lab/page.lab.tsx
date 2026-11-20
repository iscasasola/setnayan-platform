/**
 * /dev/pro-tools-lock-lab — fixture data, no sign-in, no database. DEV-ONLY: production builds 404 this route.
 *
 * The §4 proof for "photo challenge + 3D booth come with Pro and up" (owner 20 Nov). It draws the two client-page
 * cards in their below-Pro state with the REAL shared `LockedFeature` and the REAL lock rows (`photoChallenge`,
 * `boothBranding` in lib/locks.ts), plus the Pro shop's "Comes with your plan" line. The live cards
 * (`vendor-challenge-section.tsx`, `booth-event-section.tsx`) are async server components that read the database
 * gate `vendor_pro_tools_included`; this lab copies only their outer markup around the same lock component.
 */
import { notFound } from 'next/navigation';
import { Check, Store, Trophy } from 'lucide-react';

import { LockedFeature } from '@/app/_components/lock/locked-feature';
import { InfoTip } from '@/app/_components/info-tip';
import { Badge } from '@/app/_components/badge';
import { ShopCard } from '@/app/vendor-dashboard/_components/kit';
import { PRO_TOOLS_MIN_TIER } from '@/lib/specialized-tools-access';

const NEED = { kind: 'plan', plan: PRO_TOOLS_MIN_TIER, price: null, href: '/vendor-dashboard/subscription' } as const;

function ChallengeCard({ pro }: { pro: boolean }) {
  return (
    <ShopCard pad="roomy">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Trophy aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Papic Challenges
        {pro ? <Badge tone="ok" data="challenges-on">On</Badge> : null}
      </h3>
      <div className="mt-1 text-[13px] text-ink/70">
        <InfoTip label="Set a guest photo mission at this event" align="start">
          Ask guests to photograph your service (your signature dish, the booth, the pour). It&rsquo;s free and fun for
          every guest; each challenge needs the couple&rsquo;s okay before it goes live.
        </InfoTip>
      </div>
      {pro ? null : (
        <div className="mt-4" data-challenge-locked="">
          <LockedFeature lock="photoChallenge" need={NEED} />
        </div>
      )}
    </ShopCard>
  );
}

function BoothCard({ pro }: { pro: boolean }) {
  return (
    <ShopCard pad="roomy">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Store aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Your booth in their 3D Plan
        {pro ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-[11px] font-semibold text-terracotta-700">
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Branded
          </span>
        ) : null}
      </h3>
      {pro ? (
        <p className="mt-1 text-xs text-ink/55" data-booth-included="">
          Comes with your plan — your logo and poster are on in the couple&rsquo;s room. Nothing to buy.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-ink/55">Right now the couple sees a plain booth with your name.</p>
          <div className="mt-3" data-booth-locked="">
            <LockedFeature lock="boothBranding" need={NEED} />
          </div>
        </>
      )}
    </ShopCard>
  );
}

export default async function ProToolsLockLab({ searchParams }: { searchParams: Promise<{ pro?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const pro = (await searchParams).pro === '1';
  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8" data-lab-cards="">
        <section data-lab-card="challenge">
          <ChallengeCard pro={pro} />
        </section>
        <section data-lab-card="booth">
          <BoothCard pro={pro} />
        </section>
      </div>
    </main>
  );
}
