import { Suspense, type ReactNode } from 'react';
import { Camera, Gauge, Layers, Link2, Sparkles, Wallet } from 'lucide-react';
import { Rows, Sec, ViewRow } from '../catalogue/_components/catalogue-rows';
import {
  TablePageSkeleton,
  GridPageSkeleton,
} from '@/components/skeletons';
import { requireAdmin } from '@/lib/admin/require-admin';
import { PricingSurface } from './_surfaces/pricing-surface';
import { PriceBandsSurface } from './_surfaces/price-bands-surface';
import { FreeWindowsSurface } from './_surfaces/free-windows-surface';
import { AiPricesSurface } from './_surfaces/ai-prices-surface';
import { PlanContentsSurface } from './_surfaces/plan-contents-surface';
import { PapicLadderSurface } from './_surfaces/papic-ladder-surface';

/**
 * Catalog Studio — the tabbed /admin/pricing shell that consolidates the Money
 * menu's pricing-config pages into ONE surface (owner: "yes" · Money split ·
 * 2026-07-10). Tabs: Pricing (the shell/default tab) · Setnayan AI prices ·
 * Papic shot prices · Price bands · Free windows. (The Custom plans tab was
 * removed 2026-11-06 with the Custom supplier plan itself.) Same pattern as the Accounts + Studio +
 * Insights studios (page shell + _surfaces/* + ?tab=).
 *
 * The Token bands tab was REMOVED 2026-08-07 with the rest of the token
 * currency (owner 2026-07-21: "token can retire, there should be nothing that
 * needs token anymore"). It edited the region → burn-band map for a burn that
 * was already neutralised — answering an inquiry has been free since #3531.
 *
 * The Add-ons tab was REMOVED 2026-07-21 (owner: "we do not need the bundle
 * maker as well", following the pricing-cleanup audit). It was the last surface
 * reading the legacy v1 `service_catalog`, and it was broken three ways: it
 * rendered only the 17 retired rows (it could not show the one active row), its
 * purchase counter joined v1 `sku_code` against `orders.service_key` (which
 * holds V2 codes) so every card read "No purchases yet", and its eligibility
 * dots joined `sku_code` against `feature_policy.feature_key` (which holds
 * slugs) so every dot was hollow. Its one worthwhile piece — the legacy-catalog
 * report download — moved onto the Pricing tab. /admin/addons still resolves:
 * it now redirects to the Pricing tab.
 *
 * MUTATION-SURFACE EDGES (why this shell is not a copy of the read-only
 * Insights shell):
 *  - /admin/pricing IS the shell path AND the pricing tab's own legacy route,
 *    so pricing is the DEFAULT tab (coerceTab fallback) and every pricing
 *    action redirect (…?saved / created / createError, no ?tab) lands here
 *    correctly — but ONLY if the shell FORWARDS those flash params into
 *    PricingSurface. Same for the other tabs' deep-link params.
 *  - force-dynamic: the surfaces do createAdminClient reads + the sibling tabs'
 *    actions revalidatePath('/admin/pricing') — a force-dynamic shell re-renders
 *    fresh on every request, so a just-saved band/plan never renders stale.
 *  - The four non-pricing legacy routes are param-forwarding redirect stubs.
 */
export const dynamic = 'force-dynamic';

const TABS = [
  'pricing',
  'setnayan-ai',
  'papic-shots',
  'price-bands',
  'free-windows',
  'plan-contents',
] as const;
type Tab = (typeof TABS)[number];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function coerceTab(v: string | undefined): Tab {
  return (TABS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'pricing';
}

/*
  ⚠ "Price bands" MEANT TWO DIFFERENT THINGS AND THAT IS HOW THE WRONG SCREEN
  GETS EDITED. The existing tab is the vendor Price-Position feature — what
  suppliers in a category typically charge, worked out from their own published
  prices. It has nothing to do with what Setnayan charges. Renamed to
  "Market price bands" (2026-08-28) so the new Setnayan AI band editor one tab
  away cannot be confused with it. The tab KEY is unchanged, so every existing
  deep link and redirect stub still resolves.
*/
const TAB_TITLE: Record<Tab, string> = {
  pricing: 'Pricing',
  'setnayan-ai': 'Setnayan AI prices',
  'papic-shots': 'Papic shot prices',
  'price-bands': 'Market price bands',
  'free-windows': 'Free windows',
  'plan-contents': 'Plan contents',
};

function tabSkeleton(tab: Tab): ReactNode {
  return tab === 'price-bands' ? (
    <GridPageSkeleton />
  ) : (
    <TablePageSkeleton />
  );
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props) {
  const tab = coerceTab(first((await searchParams).tab));
  return { title: `${TAB_TITLE[tab]} · Admin` };
}

function activeSurface(
  tab: Tab,
  search: Record<string, string | string[] | undefined>,
): ReactNode {
  // Each surface kept its own narrow searchParams type; hand it a promise
  // narrowed to exactly that shape. The FLASH params (pricing's saved/created/…,
  // price-bands' recomputed) MUST be forwarded or the success/error banners
  // silently stop rendering after a mutation.
  switch (tab) {
    case 'setnayan-ai':
      return (
        <AiPricesSurface
          searchParams={Promise.resolve({
            saved: first(search.saved),
            error: first(search.error),
          })}
        />
      );
    case 'papic-shots':
      return (
        <PapicLadderSurface
          searchParams={Promise.resolve({
            saved: first(search.saved),
            error: first(search.error),
          })}
        />
      );
    case 'price-bands':
      return (
        <PriceBandsSurface
          searchParams={Promise.resolve({
            recomputed: first(search.recomputed),
            funnelRecomputed: first(search.funnelRecomputed),
          })}
        />
      );
    case 'free-windows':
      return (
        <FreeWindowsSurface
          searchParams={Promise.resolve({
            created: first(search.created),
            saved: first(search.saved),
            deleted: first(search.deleted),
            createError: first(search.createError),
            error: first(search.error),
          })}
        />
      );
    case 'plan-contents':
      return (
        <PlanContentsSurface
          searchParams={Promise.resolve({
            plan: first(search.plan),
            saved: first(search.saved),
            error: first(search.error),
          })}
        />
      );
    default:
      return (
        <PricingSurface
          searchParams={Promise.resolve({
            saved: first(search.saved),
            skipped: first(search.skipped),
            error: first(search.error),
            created: first(search.created),
            createError: first(search.createError),
          })}
        />
      );
  }
}

export default async function CatalogStudioPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const tab = coerceTab(first(search.tab));

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ⚖ THE ONE SELECTOR (approved admin drawing, 14 Nov 2026 build · T2): which price view is open is chosen in
          the pinned row's `Catalogue · View ▾`, at every width. The pill strip that sat here was a second selector for
          the same choice, and is gone; every tab keeps its address (`?tab=…`), and each one is a view in
          `lib/admin/admin-tabs.ts` (Free windows is Money's). */}
      <Suspense key={tab} fallback={tabSkeleton(tab)}>
        {activeSurface(tab, search)}
      </Suspense>

      {tab === 'pricing' ? <ElsewhereInPrices /> : null}
    </div>
  );
}

/**
 * "Elsewhere in Prices" (approved drawing `catalogue.html`, screen `prices`): the other price views, one row each,
 * under the price list. Each opens its own view — nothing priced is shown or typed here.
 */
function ElsewhereInPrices() {
  return (
    <section className="mx-auto mt-10 max-w-3xl" aria-label="Elsewhere in Prices">
      <Sec label="Elsewhere in Prices" />
      <Rows label="Elsewhere in Prices">
        <ViewRow href="/admin/pricing?tab=plan-contents" icon={Layers} title="Plan contents" line="What each supplier and event plan includes" />
        <ViewRow href="/admin/pricing?tab=setnayan-ai" icon={Sparkles} title="Setnayan AI prices" line="Every kind of event has a price" />
        <ViewRow href="/admin/pricing?tab=papic-shots" icon={Camera} title="Papic shot prices" line="The ladder · per-type sizing" />
        <ViewRow href="/admin/pricing?tab=price-bands" icon={Gauge} title="Market price bands" line="Computed, never hand-set" />
        <ViewRow href="/admin/budget-planner" icon={Wallet} title="Budget benchmarks" line="Bands · seeded prices · engine" />
        <ViewRow href="/admin/vendor-recommendations" icon={Link2} title="Supplier recommendations" line="Service → product map" />
      </Rows>
    </section>
  );
}
