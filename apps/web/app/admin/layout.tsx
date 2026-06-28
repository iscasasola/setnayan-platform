import { notFound, redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSocialFlush } from '@/lib/social/flush';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { countUnread } from '@/lib/notifications';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { logQueryError } from '@/lib/supabase/error-detect';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { SidebarShell } from '@/app/_components/nav/sidebar-shell';
import { DoorwaySidebarHeader } from '@/app/_components/nav/doorway-sidebar-header';
import { AdminSidebar } from './_components/admin-sidebar';
import { AdminBottomNav } from './_components/admin-bottom-nav';
import { AdminNavFab } from './_components/admin-nav-fab';
import Link from 'next/link';
import { TriangleAlert, Clock } from 'lucide-react';
import { getNavSlotMap } from '@/lib/nav-registry';
import {
  getAdminQueueDigest,
  deriveQueueUrgency,
  type AdminQueueCounts,
  type AdminQueueDigest,
} from '@/lib/admin/queue-counts';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';

export const metadata = { title: 'Setnayan HQ' };

/**
 * Admin layout — v2.1 Navigation Phase 3 (admin doorway).
 *
 * STRUCTURE: SidebarShell owns the desktop layout split (sidebar at lg+,
 * main content area with offset). The sidebarHeader carries the brand
 * wordmark + HQ label + AccountSwitcherStandalone (matching the customer
 * doorway pattern — owner directive 2026-06-18). The topBar is right-aligned:
 * unread bell · role badge · display name · sign-out · AccountSwitcher
 * (mobile-only pill; desktop uses the sidebar AccountSwitcherStandalone).
 *
 * EventSwitcher was retired from this doorway on 2026-06-18 — the unified
 * AccountSwitcher owns identity + event switching + cross-console hopping on
 * all three doorways, consistent with the customer doorway that already shipped
 * this pattern.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/admin'));
  const supabase = await createClient();

  const minimalSwitcherFallback: SwitcherData = {
    userId: user.id,
    displayName: null,
    email: user.email ?? '',
    isAnonymous: !!user.is_anonymous,
    photoUrl: null,
    events: [],
    gallery: [],
    favorites: [],
    context: { hasVendor: false, vendorName: null, isAdmin: true },
  };

  const [{ data: profile }, unreadCount, switcherData] = await Promise.all([
    supabase
      .from('users')
      .select(
        'display_name, email, account_type, is_internal, is_team_member, tour_seen_keys',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    countUnread(supabase, user.id),
    getSwitcherData(user.id).catch((err: unknown) => {
      logQueryError(
        'AdminLayout (getSwitcherData threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return minimalSwitcherFallback;
    }),
  ]);

  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';

  // Non-admins get a 404 rather than a redirect so the /admin route doesn't
  // leak its own existence.
  if (!isAdmin) notFound();

  // Social auto-publish flush — cron-free: dispatch piggybacks on admin
  // traffic via after(). Fire-and-forget; the 10-min throttle inside
  // runSocialFlush makes this effectively free, and it never throws.
  after(() => runSocialFlush().catch(() => {}));

  const displayName = profile?.display_name ?? profile?.email ?? 'Setnayan Team';

  const badge = profile?.is_internal
    ? { label: '🟣 Internal', tone: 'bg-purple-100 text-purple-800' }
    : profile?.is_team_member
      ? { label: '🟢 Team Pool', tone: 'bg-success-100 text-success-800' }
      : { label: 'Setnayan Team', tone: 'bg-ink/10 text-ink/70' };

  // Nav registry + live queue digest (count + oldest-open age per Work queue).
  // Fails open to {}. cache()'d, so the /admin/work command center shares this
  // exact fetch in the same request. Counts feed the badge number; urgency
  // feeds the badge TONE (red only when actually overdue) + the topbar pill.
  const [navSlots, digest] = await Promise.all([
    getNavSlotMap(),
    getAdminQueueDigest().catch(() => ({}) as AdminQueueDigest),
  ]);
  const queueCounts: AdminQueueCounts = Object.fromEntries(
    Object.entries(digest).map(([k, v]) => [k, v.count]),
  );
  const urgency = deriveQueueUrgency(digest, Date.now());

  // Top bar — right-aligned utilities cluster. AccountSwitcher pill is
  // mobile-only (lg:hidden); desktop users open the switcher from the
  // AccountSwitcherStandalone row in the sidebar header. The overdue/due-soon
  // escalation pill leads the cluster so a breach is visible on EVERY admin
  // page, not just when the eye is on the Work nav group.
  const topBar = (
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
      {urgency.overdue > 0 ? (
        <Link
          href="/admin/work"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-90"
          style={{ background: '#FEE4E2', color: '#B42318' }}
          aria-label={`${urgency.overdue} ${urgency.overdue === 1 ? 'queue is' : 'queues are'} past SLA — open the work list`}
        >
          <TriangleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
          {urgency.overdue} overdue
        </Link>
      ) : urgency.dueSoon > 0 ? (
        <Link
          href="/admin/work"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-90"
          style={{ background: '#FEF0C7', color: '#B54708' }}
          aria-label={`${urgency.dueSoon} ${urgency.dueSoon === 1 ? 'queue is' : 'queues are'} approaching SLA — open the work list`}
        >
          <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
          {urgency.dueSoon} due soon
        </Link>
      ) : null}
      <UnreadBellBadge
        userId={user.id}
        initialUnread={unreadCount}
        href="/admin/notifications"
        ariaBaseLabel="Notifications"
        ariaUnreadSuffix="unread"
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
      <div className="lg:hidden">
        <AccountSwitcher data={switcherData} />
      </div>
    </div>
  );

  return (
    <div className="app-surface">
      <SidebarShell
        sidebarHeader={<DoorwaySidebarHeader label="Setnayan HQ" switcherData={switcherData} />}
        sidebar={
          <AdminSidebar
            navSlots={navSlots}
            queueCounts={queueCounts}
            queueStates={urgency.states}
          />
        }
        topBar={topBar}
      >
        {/* Pad the bottom on mobile so BottomNav doesn't cover the last
            row of content. SidebarShell already handles the desktop
            sidebar offset via its lg:pl-[var(--shell-main-offset)] math. */}
        <div className="pb-20 lg:pb-0">{children}</div>
      </SidebarShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside SidebarShell so it doesn't
          inherit the desktop sidebar offset. */}
      <AdminBottomNav
        navSlots={navSlots}
        queueCounts={queueCounts}
        overdue={urgency.overdue}
        dueSoon={urgency.dueSoon}
      />
      {/* NAV-2 broken-out action — Payment requests (a sibling of the pill,
          never a tab). Hides itself when a docked SubNav is up. */}
      <AdminNavFab />
      {!(profile?.tour_seen_keys ?? []).includes('admin_welcome_v1') ? (
        <GuidedTour tourKey="admin_welcome_v1" completeAction={completeTour} />
      ) : null}
    </div>
  );
}
