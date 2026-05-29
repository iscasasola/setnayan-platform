import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { Logo } from '@/app/_components/logo';
import { RoleSwitchPill } from '@/app/_components/role-switch-pill';
import { fetchUserRoleSummary } from '@/lib/roles';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { AdminSidebar } from './_components/admin-sidebar';
import { AdminBottomNav } from './_components/admin-bottom-nav';

export const metadata = { title: 'Admin · Setnayan' };

/**
 * Admin layout — v2.1 Navigation Phase 3 (admin doorway).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin 28-surface lock + 2026-05-28 11th
 * + 14th rows + v2.1 brief canonical lock (10th 2026-05-28 row). Replaces
 * the prior horizontal pill bar (apps/web/app/admin/_components/admin-nav.tsx
 * 19-110) with the shared SidebarShell + SidebarSection + SidebarItem
 * primitives from PR #603. Mobile chrome moves to AdminBottomNav with
 * 4 overflow landing pages at /admin/queues + /admin/directory +
 * /admin/money + /admin/more.
 *
 * STRUCTURE: SidebarShell owns the desktop layout split (sidebar at lg+,
 * main content area with offset). topBar slot carries the admin utilities
 * cluster (brand logo · role-switch pill · admin badge · display name ·
 * sign-out). Mobile chrome (BottomNav at bottom) is rendered as a sibling
 * of SidebarShell — both auto-hide / show via their own breakpoint
 * primitives (sidebar lg:flex, bottom-nav lg:hidden).
 *
 * GuidedTour preserved unchanged — fires on first login per the existing
 * tour_seen_keys check.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/admin'));
  const supabase = await createClient();

  const [{ data: profile }, roles] = await Promise.all([
    supabase
      .from('users')
      .select(
        'display_name, email, account_type, is_internal, is_team_member, tour_seen_keys',
      )
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

  const displayName = profile?.display_name ?? profile?.email ?? 'Admin';
  const badge = profile?.is_internal
    ? { label: '🟣 Internal', tone: 'bg-purple-100 text-purple-800' }
    : profile?.is_team_member
      ? { label: '🟢 Team Pool', tone: 'bg-emerald-100 text-emerald-800' }
      : { label: 'Admin', tone: 'bg-ink/10 text-ink/70' };

  // Top bar lives inside SidebarShell's topBar slot. Carries the admin
  // utilities cluster — brand logo (links back to overview), role-switch
  // pill, admin badge, display name, sign-out form. Pre-Phase 3 this
  // sat inside a <header> element above the horizontal pill nav; now it
  // sits inside the sticky top slot above the main content scroll.
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
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
  );

  return (
    <>
      <SidebarShell sidebar={<AdminSidebar />} topBar={topBar}>
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math. */}
        <div className="pb-20 lg:pb-0">{children}</div>
      </SidebarShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside SidebarShell so it doesn't
          inherit the desktop sidebar offset. */}
      <AdminBottomNav />
      {!(profile?.tour_seen_keys ?? []).includes('admin_welcome_v1') ? (
        <GuidedTour tourKey="admin_welcome_v1" completeAction={completeTour} />
      ) : null}
    </>
  );
}
