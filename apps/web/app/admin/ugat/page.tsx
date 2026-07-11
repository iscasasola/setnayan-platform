import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { Shapes, Compass, BookOpen, Brain } from 'lucide-react';
import { ListPageSkeleton, TablePageSkeleton } from '@/components/skeletons';
import { requireAdmin } from '@/lib/admin/require-admin';
import { MenusSurface } from './_surfaces/menus-surface';
import { OnboardingSurface } from './_surfaces/onboarding-surface';
import { WeddingTraditionsSurface } from './_surfaces/wedding-traditions-surface';
import { BrainSurface } from './_surfaces/brain-surface';

/**
 * Ugat Studio — the tabbed /admin/ugat shell that consolidates the Ugat
 * Console's data-structure config pages into ONE surface (Money-split-style
 * fold · 2026-07-10). Four tabs: Menus & icons (shell/default) · Onboarding ·
 * Traditions · AI brain. Replaces the former card-hub landing.
 *
 * TAXONOMY is DELIBERATELY NOT a tab — /admin/taxonomy is already its own
 * ?view= studio, and folding it would collide ?view with the studio ?tab (the
 * add-ons collision lesson); it stays a standalone Ugat sidebar link.
 *
 * Unlike the Catalog/Settings shells, /admin/ugat does NOT equal any tab's
 * legacy route (menus lives at /admin/menus), so there's no shell-path
 * matchPrefix collision — each folded sidebar row keeps a normal matchPrefix
 * on its own legacy path.
 *
 * force-dynamic: the surfaces do createAdminClient reads + the folded actions
 * revalidatePath('/admin/ugat'), so the shell must never be statically served.
 */
export const dynamic = 'force-dynamic';

const TABS = ['menus', 'onboarding', 'wedding-traditions', 'brain'] as const;
type Tab = (typeof TABS)[number];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function coerceTab(v: string | undefined): Tab {
  return (TABS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'menus';
}

const TAB_STRIP: { key: Tab; label: string; icon: typeof Shapes }[] = [
  { key: 'menus', label: 'Menus & icons', icon: Shapes },
  { key: 'onboarding', label: 'Onboarding', icon: Compass },
  { key: 'wedding-traditions', label: 'Traditions', icon: BookOpen },
  { key: 'brain', label: 'AI brain', icon: Brain },
];

const TAB_TITLE: Record<Tab, string> = {
  menus: 'Menus & icons',
  onboarding: 'Onboarding',
  'wedding-traditions': 'Wedding traditions',
  brain: 'Setnayan AI brain',
};

function tabSkeleton(tab: Tab): ReactNode {
  return tab === 'brain' ? <TablePageSkeleton /> : <ListPageSkeleton />;
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
  switch (tab) {
    case 'onboarding':
      // Flash pair — forward or the Saved./error banners stop rendering.
      return (
        <OnboardingSurface
          searchParams={Promise.resolve({
            saved: first(search.saved),
            error: first(search.error),
          })}
        />
      );
    case 'wedding-traditions':
      return <WeddingTraditionsSurface />;
    case 'brain':
      return <BrainSurface />;
    default:
      return <MenusSurface />;
  }
}

export default async function UgatStudioPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const tab = coerceTab(first(search.tab));

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Ugat Console sections"
        className="mb-6 flex flex-wrap gap-1.5 border-b border-ink/10 pb-3"
      >
        {TAB_STRIP.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={`/admin/ugat?tab=${t.key}`}
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
