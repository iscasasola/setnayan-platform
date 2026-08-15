import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { maybeRunLockRequestExpiry } from '@/lib/lock-request-expiry';
import { createClient } from '@/lib/supabase/server';
import { runSocialFlush } from '@/lib/social/flush';
import { runAdminDigestFlush } from '@/lib/admin/digest-flush';
import { maybeRecomputeSpotlightAwards } from '@/lib/spotlight-awards';
import { maybeRunFraudClusterSweep } from '@/lib/fraud-cluster-sweep';
import { runSeoPeriodicJobs } from '@/lib/seo/seo-cron-jobs';
import { maybeRunRetentionSweep } from '@/lib/retention-sweep';
import { maybeRunVendorDossierRetention } from '@/lib/vendor-dossier-retention';
import { maybeRunPapicFullResDrop } from '@/lib/papic-fullres-drop';
import { maybeRunPapicNsfwRescreen } from '@/lib/papic-nsfw-rescreen-sweep';
import { maybeRunDriveCopyRetry } from '@/lib/papic-drive-copy-retry';
import { maybeRunAnonDraftSweep } from '@/lib/anon-draft-sweep';
import { maybeRunPhotoDeliveryDrain } from '@/lib/photo-delivery-drain';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin/require-admin';
import { countUnread } from '@/lib/notifications';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { logQueryError } from '@/lib/supabase/error-detect';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { AppRailShell } from '@/app/_components/frontdoor/app-rail-shell';
import { AdminRailContext } from './_components/admin-rail-context';
import { AdminCommandPalette } from './_components/admin-command-palette';
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
 * Admin layout — the console, under the ONE shell (slice 3, 2026-08-14).
 *
 * Owner, 2026-08-13, over three YouTube screenshots in which the left rail
 * never leaves: *"the sidebar should stay. look at here as we navigate around.
 * what you did was jumping back to the old dashboards. so what we want to see
 * the dashboards converted for this desktop view."* `DECISION_LOG.md`
 * 2026-08-13 · `ONE_SHELL_PLAN_2026-08-13.md` § 2, slice 3.
 *
 * STRUCTURE: `<AppRailShell>` owns the desktop split — the SAME rail a signed-in
 * person saw on the front door and on their own account pages, carrying their
 * events, their Alaala, their story, their shop and HQ. The console's own six
 * menus PUSH IN BELOW those rows through the `railContext` slot
 * (`admin-rail-context.tsx`); nothing above them is swapped out. Below 1024 the
 * shell paints nothing at all and `<AdminBottomNav>` is the whole navigation,
 * exactly as before — the phone's bottom-bar grammar is locked.
 *
 * ── WHAT WENT, AND WHERE ITS JOB WENT ─────────────────────────────────────
 * `<SidebarShell>` + `<AdminSidebar>` + `<DoorwaySidebarHeader>` are no longer
 * mounted here. Three things they quietly owned had to be re-homed rather than
 * assumed, because each would have vanished without an error:
 *
 *  1. THE STICKY TOP BAR + the owner-locked hide-on-scroll rule (2026-06-15) —
 *     briefly `<AdminStickyTopBar>`; from 2026-08-14 THE SHARED BAR owns it,
 *     for all five signed-in trees at once. That component is RETIRED, and its
 *     three responsibilities went with the job rather than being assumed: the
 *     sticky position, the frost, and the `shell-topbar` hide hook two event
 *     pages inject a rule against. See `front-door-shell.tsx`.
 *  2. `.sn-vt-page` ON THE CONTENT — the mobile bottom-nav page slide names
 *     exactly one element (`view-transition-name: sn-page`) and freezes the
 *     rest. `NavSlideController` treats `/admin` as a base tab, so losing the
 *     name would have left the tap running a transition that animates NOTHING.
 *     It is on the content wrapper below.
 *  3. THE ACCOUNT MENU ON DESKTOP — it used to be the HQ plaque in the sidebar
 *     header, with the top bar's `<AccountSwitcher>` marked `lg:hidden` as the
 *     mobile twin. The header is gone, so the pill is now shown AT EVERY WIDTH.
 *     🔒 It is the only route to sign-out on this doorway (the loose top-bar
 *     sign-out was retired 2026-08-13, "sign out lives under the avatar and
 *     nowhere else"), so leaving it `lg:hidden` would have stranded it.
 *
 * ⚠ NOT re-homed, because it did not need to be: the `--m-sidebar-*` tokens
 * and the collapse key belonged to the old panel. The rail has its own width
 * behaviour (a 72px icon strip between 1024 and 1280) and its own row grammar.
 *
 * EventSwitcher was retired from this doorway on 2026-06-18 — the unified
 * account panel owns identity + cross-console hopping on all three doorways,
 * consistent with the customer doorway; going HOME is the rail's job.
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
    context: { hasVendor: false, vendorName: null, isAdmin: true, canOpenShop: false },
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
  // PR-H · nudge at day 5, close at day 7. Mounted in BOTH layouts on purpose:
  // the DB compare-and-swap picks exactly one winner per gap window, and an
  // admin-only mount would wait for an admin page view — production is
  // pre-launch-quiet, so a supplier's 7-day fuse would hang on somebody
  // opening /admin. NOT flag-gated: closing a stale request is safe either
  // way, and a gated sweep strands every in-flight request when the flag
  // goes back off.
  after(() => maybeRunLockRequestExpiry().catch(() => {}));
  // SEO health audit + Google Search Console pull — CRON-FREE: admin traffic +
  // a daily DB claim (replaces the retired /api/cron/seo-{health,gsc}). Both
  // feed /admin/seo; a skipped day only leaves the dashboard a day stale.
  after(() => runSeoPeriodicJobs().catch(() => {}));
  // Weekly destructive ops sweeps (data-retention chat purge + Papic full-res
  // drop) — CRON-FREE: admin traffic + a WEEKLY DB claim (replaces the last two
  // Vercel crons). Both keep their own safety (legal-hold exclusion / kill-switch
  // + per-run limit); the routes are retained as manual/curl triggers. Never throws.
  after(() => maybeRunRetentionSweep().catch(() => {}));
  // Deep Search dossier TTL (RA 10173 storage-limitation) — CRON-FREE: admin
  // traffic + a WEEKLY DB claim. Purges web-research dossiers past 180 days.
  after(() => maybeRunVendorDossierRetention().catch(() => {}));
  after(() => maybeRunPapicFullResDrop().catch(() => {}));
  // Papic NSFW re-screen heal — CRON-FREE: admin traffic + a ~20-min DB claim.
  // screenCapture() is fail-open + fire-and-forget, and its per-event healer only
  // runs from two COUPLE-SIDE after() sites — so a capture whose first screen
  // dropped, on an event no couple revisits, would stay 'unscreened' (dark on
  // every guest-facing surface) forever. This heals those globally without a
  // couple visit. Bounded (≤25 events/sweep) + 15-min grace so an in-flight
  // screen is never re-run; never throws.
  after(() => maybeRunPapicNsfwRescreen().catch(() => {}));
  // Autonomous Drive-copy retry (Papic storage PR-4) — CRON-FREE: admin traffic +
  // a DAILY DB claim. Re-drives failed Google-Drive copies with exponential
  // back-off up to a ceiling and surfaces what's stranded past it, so a transient
  // Drive failure is retried (not silently lost) and the full-res drop stops
  // deferring those raws forever. Non-destructive; never throws.
  after(() => maybeRunDriveCopyRetry().catch(() => {}));
  // Daily cleanup of abandoned anonymous-draft accounts + their events (RA 10173
  // data-minimization) — anon-onboarding hardening PR-3. No-op until the feature
  // flag is on and a draft ages past the TTL. Own legal-hold + is_anonymous
  // re-confirm inside; never throws.
  after(() => maybeRunAnonDraftSweep().catch(() => {}));
  // "Release to Drive" drainer (gap audit) — CRON-FREE: admin traffic + a ~10-min
  // DB claim. The click-time after() drain is bounded (240 uploads), so a bigger
  // release stalls with a still-'running' job and no advancer. This keeps stalled
  // deliveries moving without a user click; bounded per invocation. Never throws.
  after(() => maybeRunPhotoDeliveryDrain().catch(() => {}));

  const displayName = profile?.display_name ?? profile?.email ?? 'Setnayan Team';

  // Role badge — warm info-slate for the Internal marker (Glass PR-1,
  // 2026-07-15: violet retired; admin's identity is the ShieldCheck + "HQ"
  // label, not a colour fork — gold is the only decorative colour).
  // Emoji retired: screen readers read it aloud and it renders inconsistently.
  const badge = profile?.is_internal
    ? {
        label: 'Internal',
        tone: 'bg-[var(--sn-info-soft)] text-[var(--sn-info)]',
        dot: 'bg-[var(--sn-info)]',
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
  // mobile-only (lg:hidden); desktop users open the same panel from the
  // SwitcherPlaqueTrigger HQ plaque in the sidebar header (Plaque-as-Menu,
  // council 2026-07-16). The overdue/due-soon escalation pill leads the
  // cluster so a breach is visible on EVERY admin page, not just when the
  // eye is on the Work nav group.
  /*
    ─── HQ'S OWN TOP-BAR CLUSTER (One top bar, 2026-08-14) ──────────────────
    Handed to the SHARED bar through `topBarSlot`, which supplies the wordmark,
    the search and "+ Create" this doorway never had. Every control below is
    unchanged — the SLA escalation pill, the bell, the environment badge, the
    display name and the AccountSwitcher carrying the only Sign out here.

    ⚠ THE SLA PILL AND THE ENVIRONMENT BADGE EXIST ON THIS SURFACE AND NOWHERE
    ELSE. That is exactly why the shared bar takes a SLOT rather than building
    a "standard" cluster of its own: a shell that rebuilt the common parts
    would have dropped both without a diff line to show for it.
  */
  const topBar = (
    <div className="flex items-center gap-3 sm:gap-2">
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
      {/*
        SIGN OUT USED TO SIT HERE, LOOSE IN THE TOP BAR — retired 2026-08-13
        (Redesign Session 6, "the seam"). Owner: *"sign out lives under the
        avatar and nowhere else."* It is still one press away on every admin
        screen: the AccountSwitcher pill right below opens the account panel,
        which carries it. Putting it back here would make the admin the one
        doorway where signing out is a different gesture than everywhere else —
        and a control this irreversible should be in exactly one place, found
        the same way every time.
        `app/_components/auth/seam-invariants.test.ts` fails if it returns.
      */}
      {/*
        🔒 SHOWN AT EVERY WIDTH SINCE 2026-08-14 (One Shell slice 3). This was
        `lg:hidden`, because on desktop the same panel opened from the HQ plaque
        in the old sidebar header. That header is not mounted any more — the
        shared rail has no account menu in its app variant, by design (the
        surfaces it wraps keep their own). Left `lg:hidden`, the ONLY route to
        sign out on this doorway would have disappeared on desktop, with the
        console otherwise looking perfectly fine.
        `admin-rail-context.test.ts` fails if the class comes back.
      */}
      <AccountSwitcher data={switcherData} />
    </div>
  );

  return (
    // `app-surface` keeps the app typeface (Hanken) for the CONTENT — the rail
    // deliberately unsets it and keeps the front door's face, which is the
    // chrome-vs-content answer slice 0 settled (`ONE_SHELL_PLAN` § 5, #3).
    // `sn-ambient` is the warm Atelier wash the old shell painted on its own
    // root; the rail sits inside it and paints its own cream, exactly as on the
    // launcher. Dropping it would have left the console on plain white.
    <div className="app-surface sn-ambient min-h-dvh">
      {/* ⌘K / Ctrl-K anywhere in the admin. Mounted ONCE at the shell rather
          than per page, so the shortcut works on all 108 of them and there is
          only ever one overlay in the tree. It renders null until opened, so
          the cost while closed is a keydown listener.

          A SHORTCUT, NEVER THE ONLY DOOR: everything it reaches is also
          browsable at /admin/more ("All surfaces"). If a destination is ever
          reachable only by typing, that is a bug in the menu. */}
      <AdminCommandPalette />
      <AppRailShell
        railContext={
          <AdminRailContext
            navSlots={navSlots}
            queueCounts={queueCounts}
            queueStates={urgency.states}
          />
        }
        topBarSlot={topBar}
      >
        {/* `sn-vt-page` → `view-transition-name: sn-page`. During the mobile
            bottom-nav carousel slide (NavSlideController, which lists `/admin`
            among its base tabs) ONLY this element slides; the rail and the
            fixed pill live in the `root` snapshot, which the stylesheet
            freezes. It used to ride on SidebarShell's <main>; carrying it here
            is what keeps the slide from becoming a transition that animates
            nothing at all.

            Pad the bottom on mobile so the FLOATING BottomNav pill (12px float
            + ~64px bar + 16px breathing + the device's home-indicator inset)
            doesn't cover the last row of content — a fixed pb-20 under-reserved
            on safe-area devices (council fix #4). The desktop offset is the
            shell's grid now, so there is no padding math left here. */}
        <div className="sn-vt-page pb-[calc(env(safe-area-inset-bottom)+92px)] lg:pb-0">
          {children}
        </div>
      </AppRailShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside the shell so it doesn't
          inherit the desktop content column. */}
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
