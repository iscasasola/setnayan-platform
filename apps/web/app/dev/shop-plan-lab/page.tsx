/**
 * /dev/shop-plan-lab — the public shop page's (`/v/[slug]`) card column by plan, on fixture data, for the supplier
 * website by plan (owner-approved 2026-10-30, `prototypes/build-contracts-2026-10-30/supplier-website-by-plan/`). No
 * sign-in, no database. DEV-ONLY: production builds 404 this route first thing. It mounts `SampleShopPage` — the REAL
 * pieces the page renders (`ShopReachLine` + `ShopReachMap` (the shipped `ReachMap`), `ShopAddresses`,
 * `PinnedReviewCard`), decided with the page's own rules (`lib/shop-page-plan.ts` over `lib/vendor-tier-caps.ts`), never a
 * copy. The same drawing is the plan-card miniature on /for-suppliers (ruling 5735), so what this lab shows per plan is
 * exactly what a supplier sees there.
 *
 *   ?plan=free|verified|solo|pro|ultra    (free = not verified yet; ultra = the `enterprise` tier)
 *   &outer=N                              the shop's own declared furthest distance (clamped to the plan)
 */
import { notFound } from 'next/navigation';
import { SAMPLE_SHOP_PLAN_TIER, SampleShopPage, type SampleShopPlan } from '@/app/v/[slug]/_components/sample-shop-page';

export default async function ShopPlanLabPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; outer?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const plan: SampleShopPlan = sp.plan && sp.plan in SAMPLE_SHOP_PLAN_TIER ? (sp.plan as SampleShopPlan) : 'free';
  return (
    <main className="min-h-dvh bg-cream">
      <p className="sr-only" data-lab-plan={plan}>
        Lab · {plan}
      </p>
      <div className="mx-auto w-full max-w-3xl">
        <SampleShopPage plan={plan} declaredOuterKm={sp.outer ? Number(sp.outer) : null} />
      </div>
    </main>
  );
}
