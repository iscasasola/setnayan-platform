import Link from 'next/link';
import { Users, Briefcase, TestTube, CalendarDays, MapPin } from 'lucide-react';
import { UsersSurface } from './_surfaces/users-surface';
import { VendorsSurface } from './_surfaces/vendors-surface';
import { EventsSurface } from './_surfaces/events-surface';
import { VenuesSurface } from './_surfaces/venues-surface';
import { DemoVendorsSurface } from './_surfaces/demo-vendors-surface';

import { requireAdmin } from '@/lib/admin/require-admin';
/**
 * Accounts Studio (slice 4, final) — the tabbed /admin/accounts shell that
 * consolidates the Accounts menu (the `directory` group in ADMIN_NAV_GROUPS)
 * into one surface. All five tabs are now wired inline (Users + Vendors +
 * Events + Venues + Demo vendors); the Accounts menu is fully consolidated.
 * Detail/create sub-routes stay standalone (incl. the Demo vendors
 * inquiries + inquiries/[threadId] flows); the legacy list routes
 * (/admin/users, /admin/vendors, /admin/events, /admin/venues,
 * /admin/demo-vendors) redirect in, forwarding their query params.
 *
 * With every TAB_STRIP entry now wired:true, the legacyHref/wired distinction
 * is vestigial but left intact (harmless).
 *
 * force-dynamic: the surface bodies do admin-client reads (createAdminClient)
 * so this must never be statically generated.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accounts · Admin' };

// The WIRED tabs this slice renders inline. All 5 are now wired (final slice).
const TABS = ['users', 'vendors', 'events', 'venues', 'demo-vendors'] as const;
type Tab = (typeof TABS)[number];

// First value of a (possibly-array) search param — Next passes ?x=a&x=b as an
// array. Guards every param read below against that shape.
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function coerceTab(v: string | undefined): Tab {
  return (TABS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'users';
}

// The full 5-tab IA. `wired` tabs render inline via ?tab=; the not-yet-wired
// tabs link out to their still-standalone legacy routes (converted to real
// tabs in later slices) so the final IA is visible and nothing is a dead link.
const TAB_STRIP: {
  key: string;
  label: string;
  icon: typeof Users;
  wired: boolean;
  legacyHref: string;
}[] = [
  { key: 'users', label: 'Users', icon: Users, wired: true, legacyHref: '/admin/users' },
  { key: 'vendors', label: 'Vendors', icon: Briefcase, wired: true, legacyHref: '/admin/vendors' },
  { key: 'demo-vendors', label: 'Demo vendors', icon: TestTube, wired: true, legacyHref: '/admin/demo-vendors' },
  { key: 'events', label: 'Events', icon: CalendarDays, wired: true, legacyHref: '/admin/events' },
  { key: 'venues', label: 'Venues', icon: MapPin, wired: true, legacyHref: '/admin/venues' },
];

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAccountsPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const tab = coerceTab(first(search.tab));

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Accounts sections"
        className="mb-6 flex flex-wrap gap-1.5 border-b border-ink/10 pb-3"
      >
        {TAB_STRIP.map((t) => {
          const active = t.wired && t.key === tab;
          const href = t.wired ? `/admin/accounts?tab=${t.key}` : t.legacyHref;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-terracotta/10 text-terracotta-700'
                  : 'text-ink/65 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab === 'demo-vendors' ? (
        <DemoVendorsSurface />
      ) : tab === 'venues' ? (
        <VenuesSurface
          q={first(search.q) ?? ''}
          type={first(search.type) ?? ''}
          city={first(search.city) ?? ''}
        />
      ) : tab === 'events' ? (
        <EventsSurface q={first(search.q) ?? ''} archived={first(search.archived) ?? null} />
      ) : tab === 'vendors' ? (
        <VendorsSurface q={first(search.q) ?? ''} status={first(search.status) ?? ''} />
      ) : (
        <UsersSurface
          q={first(search.q) ?? ''}
          filter={first(search.filter) ?? 'all'}
          tempPassword={first(search.temp_password) ?? null}
          forEmail={first(search.for_email) ?? null}
          expandUserId={first(search.expand) ?? null}
          grantBanner={first(search.grant_banner) ?? null}
          signedOut={first(search.signed_out) ?? null}
          error={first(search.error) ?? null}
        />
      )}
    </div>
  );
}
