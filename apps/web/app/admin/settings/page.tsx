import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { Settings, ShieldCheck, Bell, FlaskConical } from 'lucide-react';
import {
  FormPageSkeleton,
  GridPageSkeleton,
  ListPageSkeleton,
} from '@/components/skeletons';
import { requireAdmin } from '@/lib/admin/require-admin';
import { SettingsSurface } from './_surfaces/settings-surface';
import { ComplianceSurface } from './_surfaces/compliance-surface';
import { NotificationsSurface } from './_surfaces/notifications-surface';
import { DemoModeSurface } from './_surfaces/demo-mode-surface';

/**
 * Settings Studio — the tabbed /admin/settings shell that consolidates the
 * Money menu's settings tail into ONE surface (owner: "yes" · Money split ·
 * 2026-07-10). Four tabs: Settings (the shell/default tab) · Compliance ·
 * Notifications · Demo mode. Same pattern as the Catalog / Insights studios.
 *
 * MUTATION-SURFACE EDGES:
 *  - /admin/settings IS the shell path AND the settings tab's legacy route, so
 *    settings is the DEFAULT tab and every settings action redirect (…?saved /
 *    error / brand_icon / …, no ?tab) lands here — but ONLY if the shell
 *    FORWARDS those flash params into SettingsSurface.
 *  - demo-mode was NESTED at /admin/settings/demo-mode; it's now a tab. Its
 *    toggle POSTs to /api/admin/demo-mode/toggle, whose 303 redirect was
 *    repointed to /admin/settings?tab=demo-mode&toggled=… (shell forwards it).
 *  - /admin/settings/payment-methods stays STANDALONE (a separate Money item),
 *    NOT a tab — the settings surface's "Manage payment methods →" card links to it.
 *  - force-dynamic: compliance + demo-mode (cookies()) need it; it also keeps
 *    compliance's revalidatePath('/admin/settings') fresh.
 */
export const dynamic = 'force-dynamic';

const TABS = ['settings', 'compliance', 'notifications', 'demo-mode'] as const;
type Tab = (typeof TABS)[number];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function coerceTab(v: string | undefined): Tab {
  return (TABS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'settings';
}

const TAB_STRIP: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'demo-mode', label: 'Demo mode', icon: FlaskConical },
];

const TAB_TITLE: Record<Tab, string> = {
  settings: 'Settings',
  compliance: 'Compliance',
  notifications: 'Notifications',
  'demo-mode': 'Demo mode',
};

function tabSkeleton(tab: Tab): ReactNode {
  switch (tab) {
    case 'compliance':
      return <GridPageSkeleton />;
    case 'notifications':
      return <ListPageSkeleton />;
    default:
      return <FormPageSkeleton />;
  }
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
    case 'compliance':
      return <ComplianceSurface />;
    case 'notifications':
      return <NotificationsSurface />;
    case 'demo-mode':
      return <DemoModeSurface searchParams={Promise.resolve({ toggled: first(search.toggled) })} />;
    default:
      return (
        <SettingsSurface
          searchParams={Promise.resolve({
            saved: first(search.saved),
            error: first(search.error),
            brand_icon: first(search.brand_icon),
            brand_icon_removed: first(search.brand_icon_removed),
            loader_saved: first(search.loader_saved),
          })}
        />
      );
  }
}

export default async function SettingsStudioPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const tab = coerceTab(first(search.tab));

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Settings sections"
        className="mb-6 flex flex-wrap gap-1.5 border-b border-ink/10 pb-3"
      >
        {TAB_STRIP.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={`/admin/settings?tab=${t.key}`}
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
