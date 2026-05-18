import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { Logo } from '@/app/_components/logo';
import { RoleSwitchPill } from '@/app/_components/role-switch-pill';
import { fetchUserRoleSummary } from '@/lib/roles';

export const metadata = { title: 'Admin · Setnayan' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [{ data: profile }, roles] = await Promise.all([
    supabase
      .from('users')
      .select('display_name, email, account_type, is_internal, is_team_member, theme_preference')
      .eq('user_id', user.id)
      .maybeSingle(),
    fetchUserRoleSummary(supabase, user.id),
  ]);

  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';

  // Non-admins shouldn't even see the route exists — render a 404 instead of
  // bouncing to /dashboard, which could leak the existence of /admin.
  if (!isAdmin) notFound();

  const theme = profile?.theme_preference ?? 'setnayan_default';
  const displayName = profile?.display_name ?? profile?.email ?? 'Admin';
  const badge = profile?.is_internal
    ? { label: '🟣 Internal', tone: 'bg-purple-100 text-purple-800' }
    : profile?.is_team_member
      ? { label: '🟢 Team Pool', tone: 'bg-emerald-100 text-emerald-800' }
      : { label: 'Admin', tone: 'bg-ink/10 text-ink/70' };

  return (
    <div data-theme={theme} className="flex min-h-dvh flex-col bg-cream">
      <header className="border-b border-ink/10 bg-cream">
        <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center text-ink">
            <Logo height={32} withWordmark title="Setnayan · Admin" />
          </Link>
          <div className="flex items-center gap-2">
            <RoleSwitchPill
              currentRole="admin"
              hasCustomerAccess={roles.hasCustomerAccess}
              hasVendorAccess={roles.hasVendorAccess}
              hasAdminAccess={roles.hasAdminAccess}
              vendorProfiles={roles.vendorProfiles}
            />
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${badge.tone}`}
            >
              {badge.label}
            </span>
            <span className="hidden text-sm text-ink/70 sm:inline">{displayName}</span>
            <form action="/auth/sign-out" method="post">
              <button className="button-secondary h-9 px-3 text-xs" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl flex-nowrap gap-1 overflow-x-auto px-4 pb-2 text-sm whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:px-6 lg:px-8">
          <AdminTab href="/admin" label="Overview" />
          <AdminTab href="/admin/users" label="Users" />
          <AdminTab href="/admin/events" label="Events" />
          <AdminTab href="/admin/vendors" label="Vendors" />
          <AdminTab href="/admin/verify" label="Verification" />
          <AdminTab href="/admin/payments" label="Payments" />
          <AdminTab href="/admin/payouts" label="Payouts" />
          <AdminTab href="/admin/receipts" label="Receipts" />
          <AdminTab href="/admin/ads" label="Ads" />
          <AdminTab href="/admin/bir/2307" label="BIR 2307" />
          <AdminTab href="/admin/reviews" label="Reviews" />
          <AdminTab href="/admin/help" label="Help inbox" />
          <AdminTab href="/admin/funnels" label="Funnels" />
          <AdminTab href="/admin/force-majeure" label="Force majeure" />
          <AdminTab href="/admin/concierge-abuse" label="Concierge abuse" />
          <AdminTab href="/admin/website" label="Website" />
          <AdminTab href="/admin/settings" label="Settings" />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function AdminTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-full bg-ink/5 px-3 py-1 text-ink/70 hover:bg-ink/10 hover:text-ink"
    >
      {label}
    </Link>
  );
}
