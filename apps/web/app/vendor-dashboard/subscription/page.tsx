import { PlanScreen, type PlanSearch } from './_components/plan-screen';

/**
 * /vendor-dashboard/subscription — the vendor Plan hub. Its screen is `PlanScreen` (`_components/plan-screen.tsx`),
 * which the Shop ⚙'s "Plan and billing" fold mounts too (2026-10-31, DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS
 * ONCE") — one drawing, two seats; every old link to this page still lands here.
 */
export const metadata = { title: 'Plan · Supplier' };

export default async function VendorSubscriptionPage({ searchParams }: { searchParams: Promise<PlanSearch> }) {
  return <PlanScreen search={await searchParams} />;
}
