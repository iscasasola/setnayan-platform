import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Sparkles,
  BadgeCheck,
  Coins,
  Gauge,
} from 'lucide-react';
import {
  TablePageSkeleton,
  GridPageSkeleton,
} from '@/components/skeletons';
import { requireAdmin } from '@/lib/admin/require-admin';
import { PricingSurface } from './_surfaces/pricing-surface';
import { AddonsSurface } from './_surfaces/addons-surface';
import { CustomPlansSurface } from './_surfaces/custom-plans-surface';
import { TokenBandsSurface } from './_surfaces/token-bands-surface';
import { PriceBandsSurface } from './_surfaces/price-bands-surface';

/**
 * Catalog Studio — the tabbed /admin/pricing shell that consolidates the Money
 * menu's pricing-config pages into ONE surface (owner: "yes" · Money split ·
 * 2026-07-10). Five tabs: Pricing (the shell/default tab) · Add-ons · Custom
 * plans · Token bands · Price bands. Same pattern as the Accounts + Studio +
 * Insights studios (page shell + _surfaces/* + ?tab=).
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

const TABS = ['pricing', 'addons', 'custom-plans', 'token-bands', 'price-bands'] as const;
type Tab = (typeof TABS)[number];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function coerceTab(v: string | undefined): Tab {
  return (TABS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'pricing';
}

const TAB_STRIP: { key: Tab; label: string; icon: typeof DollarSign }[] = [
  { key: 'pricing', label: 'Pricing', icon: DollarSign },
  { key: 'addons', label: 'Add-ons', icon: Sparkles },
  { key: 'custom-plans', label: 'Custom plans', icon: BadgeCheck },
  { key: 'token-bands', label: 'Token bands', icon: Coins },
  { key: 'price-bands', label: 'Price bands', icon: Gauge },
];

const TAB_TITLE: Record<Tab, string> = {
  pricing: 'Pricing',
  addons: 'Add-ons',
  'custom-plans': 'Custom plans',
  'token-bands': 'Token bands',
  'price-bands': 'Price bands',
};

function tabSkeleton(tab: Tab): ReactNode {
  return tab === 'token-bands' || tab === 'price-bands' ? (
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
    case 'addons':
      return <AddonsSurface searchParams={Promise.resolve({ sku: first(search.sku) })} />;
    case 'custom-plans':
      return (
        <CustomPlansSurface
          searchParams={Promise.resolve({ vendor: first(search.vendor) })}
        />
      );
    case 'token-bands':
      return <TokenBandsSurface />;
    case 'price-bands':
      return (
        <PriceBandsSurface
          searchParams={Promise.resolve({ recomputed: first(search.recomputed) })}
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
      <nav
        aria-label="Catalog sections"
        className="mb-6 flex flex-wrap gap-1.5 border-b border-ink/10 pb-3"
      >
        {TAB_STRIP.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={`/admin/pricing?tab=${t.key}`}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-mulberry/10 text-mulberry'
                  : 'text-ink/65 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Suspense key={tab} fallback={tabSkeleton(tab)}>
        {activeSurface(tab, search)}
      </Suspense>
    </div>
  );
}
