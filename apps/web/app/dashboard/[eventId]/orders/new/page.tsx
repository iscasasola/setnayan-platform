import { redirect } from 'next/navigation';

/**
 * apps/web/app/dashboard/[eventId]/orders/new/page.tsx
 *
 * RETIRED 2026-05-29 (Day 2 inline-checkout sprint).
 *
 * WHY · Day 2 of the 4-day pre-pilot voucher + inline-checkout sprint
 *       (CLAUDE.md 2026-05-29 Day 2 row · V1 SCOPE EXPANSION approved
 *       by owner · pilot 2026-06-01 in 4 days). Owner directive: replace
 *       the 2-step /orders/new → /orders/[id] flow with a single drawer
 *       that mounts on every add-on detail page. The drawer surfaces
 *       voucher apply · BDO + GCash QR · screenshot upload · reference
 *       number · submit all in one place.
 *
 *       The new entry point is the per-add-on detail page (e.g.
 *       /dashboard/[eventId]/add-ons/panood) which renders the
 *       <InlineCheckoutDrawer> client component. Direct-URL traffic
 *       to /orders/new (bookmarks · email links from prior pilot
 *       comms · legacy chat shares) lands here and bounces to the
 *       add-ons grid so couples can pick the SKU they wanted.
 *
 *       NOTE on the legacy /orders/new flow: it supported a "custom
 *       request" path where couples described what they needed in
 *       free-text. The drawer is per-SKU only · custom requests during
 *       pilot route through admin chat instead (System_Wiring_Map
 *       2026-05-28 § cross-doorway hand-offs).
 *
 *       Self-comp (CLAUDE.md 2026-05-15 § 3.1a) is also NOT in the
 *       drawer for pilot · vendors needing self-comp during pilot
 *       polish can use the legacy createOrder server action directly
 *       via admin tooling. V1.x adds self-comp to the drawer.
 *
 * Cross-references:
 *   • CLAUDE.md 2026-05-29 Day 2 row (this retirement)
 *   • apps/web/app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx
 *     (the replacement)
 *   • apps/web/app/dashboard/[eventId]/checkout/actions.ts (submit/apply)
 *   • apps/web/app/dashboard/[eventId]/orders/actions.ts (legacy
 *     createOrder retained for the self-comp branch + admin tooling)
 *   • PR #594 + PR #595 (Day 1 + Day 1.5 schema substrate)
 */

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function RetiredNewOrderPage({ params }: Props) {
  const { eventId } = await params;
  redirect(`/dashboard/${eventId}/add-ons`);
}
