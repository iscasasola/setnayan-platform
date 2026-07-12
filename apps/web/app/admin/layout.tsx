import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSocialFlush } from '@/lib/social/flush';
import { runAdminDigestFlush } from '@/lib/admin/digest-flush';
import { maybeRecomputeSpotlightAwards } from '@/lib/spotlight-awards';
import { maybeRunFraudClusterSweep } from '@/lib/fraud-cluster-sweep';
import { runSeoPeriodicJobs } from '@/lib/seo/seo-cron-jobs';
import { maybeRunRetentionSweep } from '@/lib/retention-sweep';
import { maybeRunPapicFullResDrop } from '@/lib/papic-fullres-drop';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin/require-admin';
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

  // Shared admin gate (lib/admin/require-admin.ts · council fix #1): login
  // redirect when signed out, 404 (never a redirect — the /admin route doesn't
  // leak its own existence) when signed in but not admin. The same cache()'d
  // gate is called by admin PAGES directly, because a layout alone is not a
  // safe auth boundary in front of the service-role client.
  await requireAdmin();

  // Social auto-publish flush — cron-free: dispatch piggybacks on admin
  // traffic via after(). Fire-and-forget; the 10-min throttle inside
  // runSocialFlush makes this effectively free, and it never throws.
  after(() => runSocialFlush().catch(() => {}));
  // Morning-digest flush (cron-free, throttled, single-claim, OFF by default).
  // Also hooked on the public /explore page so it fires when no admin is around.
  after(() => runAdminDigestFlush().catch(() => {}));
  // Spotlight Awards monthly recompute — cron-free: fires AT MOST once per
  // period per instance on the first admin page view of a new month, then
  // short-circuits. Idempotent (UPSERT) + never throws. The admin "Run now"
  // button is the manual fallback if no admin visits.
  after(() => maybeRecomputeSpotlightAwards().catch(() => {}));
  // Fraud cluster sweep (fake-inquiry protection) — CRON-FREE: refresh the
  // identity-cluster matview + raise concentration WATCH flags (shadow mode).
  // Fired from ADMIN traffic so the heavy matview REFRESH never rides an
  // end-user request; daily DB claim + device-fingerprint gate inside. Never throws.
  after(() => maybeRunFraudClusterSweep().catch(() => {}));
  // SEO health audit + Google Search Console pull — CRON-FREE: admin traffic +
  // a daily DB claim (replaces the retired /api/cron/seo-{health,gsc}). Both
  // feed /admin/seo; a skipped day only leaves the dashboard a day stale.
  after(() => runSeoPeriodicJobs().catch(() => {}));
  // Weekly destructive ops sweeps (data-retention chat purge + Papic full-res
  // drop) — CRON-FREE: admin traffic + a WEEKLY DB claim (replaces the last two
  // Vercel crons). Both keep their own safety (legal-hold exclusion / kill-switch
  // + per-run limit); the routes are retained as manual/curl triggers. Never throws.
  after(() => maybeRunRetentionSweep().catch(() => {}));
  after(() => maybeRunPapicFullResDrop().catch(() => {}));

  const displayName = profile?.display_name ?? profile?.email ?? 'Setnayan Team';

  // Role badge — the violet dot is the admin doorway's accent (couple = wine,
  // vendor = wine+blue, admin = wine+violet — "Energy, not skin" 2026-07-09).
  // Emoji retired: screen readers read it aloud and it renders inconsistently.
  const badge = profile?.is_internal
    ? {
        label: 'Internal',
        tone: 'bg-purple-100 text-purple-800',
        dot: 'bg-[var(--a-violet)]',
      }
    : profile?.is_team_member
      ? {
          label: 'Team Pool',
          tone: 'bg-success-100 text-success-800',
          dot: 'bg-success-600',
        }
      : { label: 'Setnayan Team', tone: 'bg-ink/10 text-ink/70', dot: null };

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
    <div className="flex w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl items-center justify-end gap-3 sm:gap-2 px-4 py-3 sm:px-6 lg:mx-auto lg:px-8">
      {/* SLA escalation pills — semantic red/warn classes (council fix #12:
          same color family per urgency state as the sidebar badges + overview
          tiles; the stock Untitled-UI hexes are retired). The ::before inset
          extends the small pill's hit area toward the 44px floor without
          changing its visual size (fix #15). A third branch surfaces DEGRADED
          counts (fix #3): a failed digest used to render pixel-identical to a
          clear day — no pill, no badges — so an outage read as "all clear". */}
      {urgency.overdue > 0 ? (
        <Link
          href="/admin/work"
          className="relative inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 transition-opacity before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] hover:opacity-90"
          aria-label={`${urgency.overdue} ${urgency.overdue === 1 ? 'queue is' : 'queues are'} past SLA — open the work list`}
        >
          <TriangleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
          {urgency.overdue} overdue
        </Link>
      ) : urgency.dueSoon > 0 ? (
        <Link
          href="/admin/work"
          className="relative inline-flex items-center gap-1.5 rounded-full bg-warn-100 px-2.5 py-1 text-xs font-semibold text-warn-800 transition-opacity before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] hover:opacity-90"
          aria-label={`${urgency.dueSoon} ${urgency.dueSoon === 1 ? 'queue is' : 'queues are'} approaching SLA — open the work list`}
        >
          <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
          {urgency.dueSoon} due soon
        </Link>
      ) : urgency.unknownCount > 0 ? (
        <Link
          href="/admin/work"
          className="relative inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-1 text-xs font-semibold text-ink/70 transition-opacity before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] hover:opacity-90"
          aria-label={`${urgency.unknownCount} queue ${urgency.unknownCount === 1 ? 'count is' : 'counts are'} unavailable — open the work list`}
        >
          <TriangleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
          Queue counts unavailable
        </Link>
      ) : null}
      <UnreadBellBadge
        userId={user.id}
        initialUnread={unreadCount}
        href="/admin/settings?tab=notifications"
        ariaBaseLabel="Notifications"
        ariaUnreadSuffix="unread"
      />
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${badge.tone}`}
      >
        {badge.dot ? (
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dot}`}
          />
        ) : null}
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
        accent="violet"
        sidebarHeader={
          <DoorwaySidebarHeader
            label="Setnayan HQ"
            accentColor="var(--m-sidebar-accent)"
            switcherData={switcherData}
          />
        }
        sidebar={
          <AdminSidebar
            navSlots={navSlots}
            queueCounts={queueCounts}
            queueStates={urgency.states}
          />
        }
        topBar={topBar}
      >
        {/* Pad the bottom on mobile so the FLOATING BottomNav pill (12px float
            + ~64px bar + 16px breathing + the device's home-indicator inset)
            doesn't cover the last row of content — a fixed pb-20 under-reserved
            on safe-area devices (council fix #4). SidebarShell already handles
            the desktop sidebar offset via its lg:pl-[var(--shell-main-offset)]
            math. */}
        <div className="pb-[calc(env(safe-area-inset-bottom)+92px)] lg:pb-0">{children}</div>
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
