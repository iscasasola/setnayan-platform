import { cookies } from 'next/headers';
import {
  parseTempPasswordFlash,
  TEMP_PASSWORD_FLASH_COOKIE,
} from '@/lib/account-erasure';
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
export const metadata = { title: 'People & shops · Admin' };

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

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAccountsPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const tab = coerceTab(first(search.tab));

  // Temp-password flash — read the short-TTL httpOnly cookie set by
  // resetUserPassword (it replaced the plaintext-in-URL delivery). Rendered once
  // by UsersSurface below; the cookie self-expires (RSC can't clear it mid-render).
  const pwFlash =
    tab === 'users'
      ? parseTempPasswordFlash((await cookies()).get(TEMP_PASSWORD_FLASH_COOKIE)?.value ?? null)
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 pb-8 pt-2 sm:px-6 lg:px-8">
      {/* 📐 NO TAB STRIP (design template 2026-11-14, rule 1 · F-A-07): People · Shops · Events · Venues · Demo
          suppliers are the layout's pinned-row views ("People · Everyone ▾", `lib/admin/admin-tabs.ts`) — this
          wrapped strip duplicated them above every list. */}
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
          tempPassword={pwFlash?.password ?? null}
          forEmail={pwFlash?.email ?? null}
          expandUserId={first(search.expand) ?? null}
          grantBanner={first(search.grant_banner) ?? null}
          signedOut={first(search.signed_out) ?? null}
          error={first(search.error) ?? null}
        />
      )}
    </div>
  );
}
