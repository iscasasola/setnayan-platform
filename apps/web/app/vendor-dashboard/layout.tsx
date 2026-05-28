import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/app/_components/logo';
import {
  Bell,
  Briefcase,
  ClipboardList,
  FileSignature,
  FileText,
  Megaphone,
  MessageSquare,
  Palette,
  ShieldCheck,
  Star,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { countUnread } from '@/lib/notifications';
import { fetchUserRoleSummary } from '@/lib/roles';
import { VendorSubnavTab } from './_components/subnav-tab';
import { RoleSwitchPill } from '@/app/_components/role-switch-pill';

export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/vendor-dashboard'));
  const supabase = await createClient();

  const [profileRes, unreadCount, roles] = await Promise.all([
    supabase
      .from('users')
      .select(
        'account_type, email, display_name, deleted_at',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    countUnread(supabase, user.id),
    fetchUserRoleSummary(supabase, user.id),
  ]);
  const profile = profileRes.data;

  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Non-vendors get bounced to the couple-side dashboard.
  if (profile?.account_type !== 'vendor') {
    redirect('/dashboard');
  }

  // 2026-05-22 brand pivot: per-wrapper `data-theme` retired; light/dark
  // toggled by the global ThemeProvider's `html.dark` class. See CLAUDE.md.
  const displayName = profile?.display_name ?? profile?.email ?? 'Vendor';

  // v2.1 deep-fix (2026-05-28) — outer chrome paper backgrounds use
  // --m-paper-2 (#F4EFE5) parchment-warm surface; sticky header strip
  // sits on --m-paper @ 95% with --m-line hairline. Matches the couple
  // dashboard deep-fix pattern shipped via PR #587 + the v2.1 brief
  // canonical lock at CLAUDE.md 10th 2026-05-28 row. Width treatment +
  // subnav layout (horizontal 14-tab) unchanged — sidebar variant from
  // vendor-aside.jsx is a UX change that needs explicit owner approval
  // per [[feedback_setnayan_button_preservation]].
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--m-paper-2)' }}>
      <header
        style={{
          background: 'rgba(251, 248, 242, 0.95)' /* --m-paper @ 95% */,
          borderBottom: '1px solid var(--m-line)',
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/vendor-dashboard" className="flex items-center text-ink">
            <Logo height={32} withWordmark title="Setnayan · Vendor" />
          </Link>
          <div className="flex items-center gap-2">
            <RoleSwitchPill
              currentRole="vendor"
              hasCustomerAccess={roles.hasCustomerAccess}
              hasVendorAccess={roles.hasVendorAccess}
              hasAdminAccess={roles.hasAdminAccess}
              vendorProfiles={roles.vendorProfiles}
            />
            <span className="hidden text-sm text-ink/70 sm:inline">{displayName}</span>
            <form action="/auth/sign-out" method="post">
              <button className="button-secondary h-9 px-3 text-xs" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="Vendor sections"
          className="mx-auto flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6 lg:px-8"
        >
          <VendorSubnavTab
            href="/vendor-dashboard"
            label="Profile"
            icon={<User aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="exact"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/services"
            label="Services"
            icon={<Briefcase aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/attributes"
            label="Attributes"
            icon={<ClipboardList aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/bookings"
            label="Bookings"
            icon={<ClipboardList aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/contracts"
            label="Contracts"
            icon={<FileSignature aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/messages"
            label="Messages"
            icon={<MessageSquare aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/reviews"
            label="Reviews"
            icon={<Star aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/team"
            label="Team"
            icon={<Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/earnings"
            label="Earnings"
            icon={<Wallet aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/verify"
            label="Verify"
            icon={<ShieldCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/marketing"
            label="Marketing"
            icon={<Megaphone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/moodboard-library"
            label="Moodboard"
            icon={<Palette aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/tax-documents"
            label="Tax docs"
            icon={<FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            match="prefix"
          />
          <VendorSubnavTab
            href="/vendor-dashboard/notifications"
            label="Notifications"
            icon={<Bell aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            badge={unreadCount}
            match="prefix"
            liveNotificationsUserId={user.id}
          />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
