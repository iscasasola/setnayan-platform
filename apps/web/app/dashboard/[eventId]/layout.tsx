import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sweepGuardNotifications } from '@/lib/setnayan-ai-notify';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { isReferralProgramEnabled } from '@/lib/platform-settings';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { getDashboardShell } from '@/lib/dashboard-shell';
import { countUnreadMessages } from '@/lib/chat';
import { countGuestsByEvent } from '@/lib/guests';
import { getLocale, makeT } from '@/lib/i18n';
import { logQueryError } from '@/lib/supabase/error-detect';
import { UnreadBellBadge } from '@/app/_components/unread-bell-badge';
import { UnreadMessagesBadge } from '@/app/_components/unread-messages-badge';
import { AppRailShell } from '@/app/_components/frontdoor/app-rail-shell';
import { EventRailContext } from './_components/event-rail-context';
import { CustomerBottomNav } from './_components/customer-bottom-nav';
import { CustomerNavFab } from './_components/customer-nav-fab';
import { CustomerSectionSubnav } from './_components/customer-section-subnav';
import { getNavSlotMap } from '@/lib/nav-registry';
import { AccountSwitcher } from '@/app/_components/account-switcher/account-switcher';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { PromoFreeWindowBanner } from '@/app/_components/promo-free-window-banner';

type Props = {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
};

/**
 * Event-scoped customer layout — under the ONE shell.
 *
 * STRUCTURE: `<AppRailShell>` owns the desktop split — the SAME rail a
 * signed-in person saw on their events board, with the event's own menu
 * PUSHED IN below their rows through `railContext`. It also owns the sticky
 * top bar, into which this layout hands its own utility cluster through
 * `topBarSlot`. Below 1024 the shell paints nothing at all and
 * `<CustomerBottomNav>` is the whole navigation, exactly as before — the
 * phone's bottom-bar grammar is locked.
 *
 * ── WHAT WENT, AND WHERE ITS JOB WENT ─────────────────────────────────────
 * `<SidebarShell>` + `<CustomerSidebar>` + `<DoorwaySidebarHeader>` are no
 * longer mounted here, and from 2026-08-15 the shell does not exist at all.
 * It shed its jobs over four slices and each was re-homed, never assumed:
 *
 *   · THE DESKTOP `<aside>` → the shared rail (slice 1, 2026-08-13).
 *   · THE STICKY HIDE-ON-SCROLL BAR → the shared bar (slice 4, 2026-08-14),
 *     which carries the same owner-locked rule (2026-06-15) for all five
 *     signed-in trees at once.
 *   · THE ACCOUNT MENU ON DESKTOP → the top bar's `<AccountSwitcher>`, now at
 *     EVERY width. 🔒 It is this surface's only route to sign-out / profile /
 *     Setnayan AI, so the `lg:hidden` it used to carry would have stranded all
 *     three the moment the sidebar plaque stopped rendering.
 *     `one-shell-event-rail.test.ts` fails if that class returns.
 *   · `.sn-ambient`, `.sn-vt-page` AND THE `<main>` LANDMARK → the content
 *     wrapper below. See the long note at the JSX; all three are silent
 *     failures, and one of them only shows on a phone.
 *
 * ⚠ NOT re-homed, because it did not need to be: the collapse key
 * (`setnayan.nav.sidebar.collapsed`), `--sidebar-width` and the `.sn-sidebar`
 * glass fork all belonged to the panel that is gone. The rail has its own
 * width behaviour (a 72px icon strip between 1024 and 1280) and its own rows.
 *
 * AUTHORIZATION + DATA FETCHING are untouched by any of that — see the
 * in-flow comments at the membership check + the 5th-hotfix Promise. Every
 * shell slice has been chrome only; no server-side semantics changed.
 */
export default async function EventLayout({ children, params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/dashboard/${eventId}`));
  const supabase = await createClient();

  // Authorization (per acceptance criterion: 404 for non-couples).
  const { data: membership, error: membershipError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  // Log silent RLS / network errors so the next "user can't reach their
  // own dashboard" mystery shows up in Sentry with the exact reason
  // instead of just landing on notFound(). The notFound() fallback
  // stays — better to 404 than crash — but logQueryError leaves a trail.
  if (membershipError) {
    logQueryError(
      'EventLayout (event_members)',
      membershipError,
      { event_id: eventId, user_id: user.id },
      'graceful_degrade',
    );
  }

  if (!membership || membership.member_type !== 'couple') {
    // Delegate path (feature-access program Phase 2, 2026-06-12): an
    // accepted, non-removed event_moderators row admits the user — this is
    // the 0048 invite system finally going live. Data access is enforced
    // per-area by the moderator RLS policies (migration 20261129000000);
    // the layout only answers "may they see this event's shell at all".
    const { data: moderator, error: moderatorError } = await supabase
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle();
    if (moderatorError) {
      logQueryError(
        'EventLayout (event_moderators)',
        moderatorError,
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
    }
    if (!moderator) {
      notFound();
    }
  }

  // 5th hotfix pass extension (2026-05-23 PM) — same defensive pattern
  // shipped at /dashboard/layout.tsx via PR #452, applied one level
  // deeper for event-scoped routes. Owner reported global-error STILL
  // firing after PR #452 deployed because the /dashboard root index
  // redirects to /dashboard/{primary.event_id} which goes through THIS
  // layout — not the parent /dashboard/layout.tsx that #452 hardened.
  // Each fetcher wrapped in .catch() with safe defaults so one throw
  // can't crash the whole layout tree.
  // getDashboardShell fetches events + roles + unreadCount via React cache() —
  // the cache key is userId only, so if (account)/layout or any other layout
  // in this render tree already resolved it, this call is free (zero DB hits).
  const minimalSwitcherFallback: SwitcherData = {
    userId: user.id,
    displayName: null,
    email: user.email ?? '',
    isAnonymous: !!user.is_anonymous,
    photoUrl: null,
    events: [],
    // This literal exists BECAUSE a read failed — it measured nothing, and
    // saying so is what stops the library reporting that you host no events.
    eventsMeasured: false,
    context: { hasVendor: false, vendorName: null, isAdmin: false, canOpenShop: false },
  };
  const [
    { unreadCount },
    eventRes,
    unreadMessages,
    locale,
    switcherData,
    guestCount,
  ] = await Promise.all([
    getDashboardShell(user.id),
    (async () => {
      try {
        const fullSelect =
          'event_id, public_id, display_name, event_date, archived, event_type, slug, monogram_text, monogram_color, monogram_frame_key, monogram_font_key, monogram_style, monogram_custom_svg, monogram_uploaded_svg, cleared_at, timezone, event_end_date';
        const fullRes = await supabase
          .from('events')
          .select(fullSelect)
          .eq('event_id', eventId)
          .maybeSingle();
        if (
          fullRes.error &&
          /column .* does not exist|undefined_column|42703/i.test(
            (fullRes.error as { message?: string; code?: string }).message ??
              (fullRes.error as { code?: string }).code ??
              '',
          )
        ) {
          // Column missing on prod → migration drift. Fall back to *.
          return await supabase
            .from('events')
            .select('*')
            .eq('event_id', eventId)
            .maybeSingle();
        }
        return fullRes;
      } catch (caught) {
        logQueryError(
          'EventLayout (events SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: null, error: null };
      }
    })(),
    // Unread-message count for the Messages-icon badge. countUnreadMessages
    // already graceful-degrades to 0 internally (incl. when the read-marker
    // migration isn't pushed yet); the .catch here is the same belt-and-braces
    // wrapper every other chrome fetcher in this Promise.all carries.
    countUnreadMessages(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'EventLayout (countUnreadMessages threw)',
        err instanceof Error ? err : new Error(String(err)),
        { event_id: eventId, user_id: user.id },
        'graceful_degrade',
      );
      return 0;
    }),
    Promise.resolve(getLocale()).catch(() => 'en' as const),
    // AccountSwitcher panel data. getSwitcherData never returns null after the
    // 2026-06-17 always-on fix; the .catch here guards against any outer throw.
    getSwitcherData(user.id).catch((err: unknown) => {
      console.error('[AccountSwitcher] data fetch failed:', err);
      return minimalSwitcherFallback;
    }),
    // Guest head-count → the sidebar Guests badge. Lean HEAD count, fully
    // fail-soft (returns null on any error → the badge is simply omitted, never
    // fabricated). Same belt-and-braces .catch as every other chrome fetcher.
    countGuestsByEvent(supabase, eventId).catch(() => null),
  ]);
  // Log silent SELECT errors before falling through to notFound().
  // Swapped from .single() (which sets PGRST116 "0 rows" as an error)
  // to .maybeSingle() (which returns null cleanly for the no-row case)
  // so a true row-missing surfaces as 404 and a real DB / column error
  // surfaces as a logged graceful-degrade → 404. The third hotfix pass
  // added this logging because the layout's .single() was previously
  // a silent crash surface when a future events ADD COLUMN migration
  // would land on code before SQL.
  if (eventRes.error) {
    logQueryError(
      'EventLayout (events)',
      eventRes.error,
      { event_id: eventId, user_id: user.id },
      'graceful_degrade',
    );
  }
  const event = eventRes.data;
  if (!event) notFound();

  // Setnayan AI guard sweep (guards-notify, 2026-07-09) — the cron-free lazy
  // invocation (house pattern: sweepExpiredConcierge / runLoginGhostingCheck).
  // Runs post-response via after() so it never delays a render; internally
  // throttled to once per event per 6h via the setnayan_ai_guard_log
  // '__sweep__' row (the common case exits after one cheap query), gated on
  // isSetnayanAiActiveForUser, and fully fail-soft. Mounted in the LAYOUT so
  // any event-scoped page visit keeps the guards live — not just the Overview.
  after(() => sweepGuardNotifications(eventId));

  // Event Lifecycle Menu (2026-06-16): the bottom-nav roster swaps by lifecycle
  // phase (Plan → Day-of → After). Computed SERVER-SIDE so there's no client
  // Date.now() / hydration flash. `getMenuLifecyclePhase` uses isEventDayActive
  // (live ‖ post) so an EVENING reception — which lands in `post` — still gets
  // the Day-of bar, and the `cleared_at` close-out (PR3) flips it to `after`.
  // (The `after` roster lands in PR4; until then `after` shows the Plan bar.)
  /*
    ⚠ THE VENUE'S CLOCK, NOT THE SERVER'S — added 2026-08-21.

    This call had no `tz`, so the phase was anchored to the runtime's own
    midnight, which on Vercel is UTC. For a Manila event that is 8 hours out,
    and the Overview's own body (page.tsx) HAS passed the timezone since
    2026-08-14. Two halves of one screen answering "has this happened yet?"
    from two different clocks is the wall-clock-vs-instant family all over
    again — the menu could swap a day early or a day late while the page it
    points at disagreed.

    🔑 THE BOUNDS ARE NOT RESTATED HERE. One resolver, one set of constants.
  */
  const phase = getMenuLifecyclePhase(
    event.event_date as string | null,
    (event as { cleared_at?: string | null }).cleared_at ?? null,
    (event as { timezone?: string | null }).timezone ?? undefined,
    undefined,
    // The LAST day, for a celebration that spans several. Threaded here as well
    // as in the Overview so the RAIL and the PAGE cannot answer "is it over?"
    // from different inputs — which is the whole failure this call already
    // carries one correction for.
    (event as { event_end_date?: string | null }).event_end_date ?? null,
  );

  // Per-event-type nav gating (iteration 0053 — Simple Event, owner 2026-06-27).
  // A vendor-free type drops the Explore (vendor marketplace) tab when its
  // profile sets marketplace_enabled=FALSE, and the Budget tab when 'budget' is
  // not an enabled surface. For wedding + every existing type the profile keeps
  // both (marketplace_enabled DEFAULTs TRUE; their surfaces include budget), so
  // navHideKeys is [] → byte-identical. resolveProfile is React-cached + degrades
  // to a hard-coded profile on any DB hiccup.
  const profile = await resolveProfile((event.event_type as string | null) ?? 'wedding');
  /*
    Couple referral program — hidden from every nav surface (sidebar, bottom
    nav, sub-nav) unless an admin has turned the program on (master toggle).

    ⚠ THIS GATE HID NOTHING FOR A MONTH AND STILL COST A QUERY EVERY RENDER.
    It filters by item KEY, and the 'refer' row had been deleted from both nav
    SSOTs on 2026-07-10 — so from then until 2026-08-18 this read ran on every
    event page load to hide a row that did not exist, while the page it governs
    was reachable only by typing the address.

    🔑 A GATE WHOSE TARGET IS GONE LOOKS EXACTLY LIKE A GATE THAT IS WORKING.
    Nothing errors; the list simply never contains the thing it excludes. It is
    the mirror of the gate-with-no-handle: a handle with no gate.

    It is live again because the row is back and keyed 'refer'. Keeping the
    existing key-based gate is deliberate — a second, parallel gate is how the
    two halves drift apart.
  */
  const referralEnabled = await isReferralProgramEnabled();
  const navHideKeys = [
    ...(profile.marketplaceEnabled ? [] : ['explore']),
    ...(surfaceEnabled(profile, 'budget') ? [] : ['budget']),
    ...(referralEnabled ? [] : ['refer']),
  ];
  // Gates the Studio "Launch" child (preview + go-live) to event types whose
  // profile enables the public website (weddings today). Threaded to the
  // desktop sidebar + the mobile section sub-nav.
  const websiteEnabled = surfaceEnabled(profile, 'website');
  // Gates the Studio "Monogram" child to event types whose profile enables the
  // 'monogram' surface (weddings today). Non-wedding events without it never see
  // the monogram maker in the nav. Threaded to the desktop sidebar.
  const monogramEnabled = surfaceEnabled(profile, 'monogram');

  const tr = makeT(locale);

  /*
    THE NAME THE RAIL'S CONTEXT GROUP ANNOUNCES THE EVENT BY.

    ⚠ THE PLAQUE'S META LINE, ITS MONOGRAM CHIP AND THE `<SwitcherPlaqueTrigger>`
    THEY FED ARE GONE (SidebarShell retirement, 2026-08-15), with the sidebar
    header that hosted them — that header had already stopped rendering on
    2026-08-13, when the shared rail took the desktop column. What the council
    actually locked on 2026-07-16 was not the plaque: it was that this surface
    must always keep a path to sign-out / profile / Setnayan AI. That path is
    the top bar's `<AccountSwitcher>`, which has been at EVERY width since the
    plaque stopped rendering, and `one-shell-event-rail.test.ts` fails if it
    goes back behind `lg:hidden`.

    It MUST always resolve — a rail heading reading `s89e-…`, or nothing at
    all, is worse than a plain word — so an unnamed draft falls back to its
    event type.
  */
  const plaqueTypeLabel = ((event.event_type as string | null) ?? 'wedding')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const plaqueName =
    ((event.display_name as string | null) ?? '').trim() || `Your ${plaqueTypeLabel}`;
  const homeLabel = 'Home · all your events';

  /*
    ─── THE EVENT'S OWN TOP-BAR CLUSTER (One top bar, 2026-08-14) ───────────
    Owner, over three screenshots: *"the issue is the top nav is not there?"* —
    inside a wedding there was no wordmark and no search, just chat, a bell and
    an avatar. This cluster is now handed to the SHARED bar through
    `topBarSlot`, which supplies the wordmark, the search and "+ Create" that
    were missing, and every control below is unchanged.

    🔑 IT MOVED OUT OF `SidebarShell`'s `topBar` SLOT — and that slot no longer
    exists. `SidebarShell` had two jobs left: the sticky hide-on-scroll bar AND
    the `<main>` carrying `.sn-vt-page`, the only element with that
    view-transition name, which the phone's nav slide freezes the document
    around. THE SHARED BAR TOOK THE FIRST (same hide-on-scroll rule, owner
    2026-06-15); the content wrapper further down took the second, and the
    shell was deleted on 2026-08-15.
  */
  const topBar = (
    <div className="flex items-center gap-3">
      {/* Planning escape (Event Lifecycle Menu) — day-of only, mobile only.
          Desktop uses the sidebar; bottom nav is the day-of command center. */}
      {phase === 'dayof' ? (
        <Link
          href={`/dashboard/${eventId}/more`}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/60 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-white/80 hover:text-ink lg:hidden"
        >
          <ClipboardList aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Planning
        </Link>
      ) : null}
      <UnreadMessagesBadge
        userId={user.id}
        initialUnread={unreadMessages}
        href={`/dashboard/${eventId}/messages`}
      />
      <UnreadBellBadge
        userId={user.id}
        initialUnread={unreadCount}
        href="/dashboard/notifications"
        ariaBaseLabel={tr('nav.notifications')}
        ariaUnreadSuffix="unread"
      />
      {/*
        AccountSwitcher — now at EVERY width (One Shell slice 1, 2026-08-13).
        It was `lg:hidden`, because on desktop the same panel opened from the
        <SwitcherPlaqueTrigger> plaque in the sidebar header (Plaque-as-Menu,
        council 2026-07-16).

        🔑 THAT HEADER NO LONGER RENDERS ON DESKTOP — the shared rail owns the
        left column now — and the council's acceptance criterion was never
        about the PLAQUE, it was that this surface must always keep a path to
        sign-out, profile and Setnayan AI. This top bar has no sign-out of its
        own, so hiding the switcher here while removing the plaque would have
        stranded all three behind no door at all on the couple's desktop. This
        is the same shape as the launcher and the account spokes, which keep
        their own slim bar BESIDE the rail for exactly this reason.

        The event's IDENTITY is not lost with the plaque: the rail's context
        group is headed by the event's name.
      */}
      <div>
        <AccountSwitcher data={switcherData} homeLabel={homeLabel} />
      </div>
    </div>
  );

  // 2026-06-14 chrome retirement: the `lg:-ml-60` outer-cancel hack is GONE.
  // The parent `dashboard/layout.tsx` no longer renders the cream
  // OuterDashboardHeader or its `lg:pl-60` gutter (that chrome moved to the
  // `(account)` route group), so there is no parent padding left to cancel —
  // SidebarShell owns the desktop offset entirely via --shell-main-offset.
  // This is the structural half of removing the old-cream-flash on
  // event-route navigations.

  // Nav registry: resolve the admin-managed name+icon overrides server-side and
  // hand the slot map to the (client) bottom nav. Cached via NAV_REGISTRY_TAG.
  const navSlots = await getNavSlotMap();

  return (
    <>
      {/*
        ─── ONE SHELL, SLICE 1 (owner 2026-08-13) ────────────────────────────
        *"the sidebar should stay. look at here as we navigate around. what you
        did was jumping back to the old dashboards. so what we want to see the
        dashboards converted for this desktop view."*
        `ONE_SHELL_PLAN_2026-08-13.md` · `DECISION_LOG.md` 2026-08-13.

        Opening a wedding no longer swaps the page furniture. The SAME rail the
        person had on their events board stays exactly where it was, and the
        event's own menu PUSHES in underneath their own rows.

        ⚠ THE MOBILE CHROME IS DELIBERATELY OUTSIDE THIS WRAPPER. Below 1024
        the app variant paints nothing, but keeping the bottom nav, the FAB and
        the docked sub-nav as siblings of the rail rather than children of its
        content column means the phone's DOM is untouched by this change — not
        merely "styled back to the same place".
      */}
      <AppRailShell
        railContext={
          <EventRailContext
            eventId={eventId}
            /* Never blank — `plaqueName` falls back to the event type for an
               unnamed draft (council acceptance criterion 2026-07-16). */
            eventName={plaqueName}
            navSlots={navSlots}
            hideKeys={navHideKeys}
            websiteEnabled={websiteEnabled}
            monogramEnabled={monogramEnabled}
            slug={(event.slug as string | null) ?? null}
            guestCount={guestCount}
            phase={phase}
          />
        }
        topBarSlot={topBar}
      >
      {/*
        ─── `<SidebarShell>` IS RETIRED (2026-08-15) — THIS IS WHERE ITS LAST
            THREE JOBS WENT ────────────────────────────────────────────────
        Slice 1 handed the desktop column to the rail above and slice 4 handed
        the sticky bar to the shared one, which left the shell rendering no
        `<aside>` at any width and existing only for what this wrapper now
        carries. Each of the three would have vanished WITHOUT AN ERROR, so
        each is re-homed deliberately rather than assumed:

         1. `.sn-ambient` — the warm Atelier ground (Glass PR-1). It sat on the
            shell's own root INSIDE the content column, so it paints over the
            rail's cream. Dropped, this tree would quietly change colour.
            🔑 The admin tree puts its copy on the OUTERMOST div, where the
            rail's own `background` covers it; that position is NOT
            interchangeable with this one, so it is not copied.
         2. `.sn-vt-page` — the ONE element in the app with
            `view-transition-name: sn-page`. The phone's bottom-nav carousel
            freezes the document around exactly this element, so losing it
            leaves the tap running a transition that animates NOTHING. It
            wraps at ALL widths, not just desktop, which is why "the rail
            replaced the shell on desktop" was never the whole story.
         3. THE `<main>` LANDMARK. The shared shell renders a `<div>` in its
            app variant precisely because the host owns the landmark
            (`one-main-per-page.test.ts`), so this must be a `<main>` — a
            `<div>` here would leave the tree with NONE.

        ⚠ THEY STAY TWO ELEMENTS, NOT ONE TIDY WRAPPER. Merging the ground
        into the named element would put the whole painted slab inside the
        view-transition snapshot, so the background would SLIDE with the page
        instead of standing still behind it — a visible change to the one
        animation this block exists to protect.
      */}
      <div className="sn-ambient min-h-screen">
        <main className="sn-vt-page">
          {/* Pad the bottom on mobile so BottomNav doesn't cover the last
              row of content. The desktop offset is the rail's grid now, so
              there is no padding math left here.
              `data-shell-main` is the hook globals.css uses to add EXTRA bottom
              room on routes where <CustomerSectionSubnav> docks a second floating
              pill above the bottom nav (see globals.css `html.subnav-docked`). */}
          <div data-shell-main className="pb-20 lg:pb-0">
            <div className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
              {/* Live "free this weekend" promo announcement (self-gates to null
                  when PROMO_FREE_WINDOWS_ENABLED is off or nothing is live). */}
              <PromoFreeWindowBanner />
              {children}
            </div>
          </div>
        </main>
      </div>
      </AppRailShell>
      {/* Mobile BottomNav — auto-hides at lg via lg:hidden inside the
          BottomNav primitive. Sits outside the rail's content column so it
          doesn't inherit it. */}
      <CustomerBottomNav eventId={eventId} phase={phase} navSlots={navSlots} hideKeys={navHideKeys} guestCount={guestCount} />
      {/* NAV-2 broken-out primary action (the Shazam satellite) — a SIBLING of
          the locked BottomNav pill, never a 7th tab. Floats above the pill's
          right end, hides when the docked SubNav is up + in the After phase. */}
      <CustomerNavFab eventId={eventId} phase={phase} />
      {/* ONE docked section sub-nav for all 6 menus (owner 2026-06-17 "sub nav
          are child menus of the 6 menus"). Reads the canonical tree in
          lib/customer-menu.ts and renders whichever menu's CHILDREN belong to the
          current route — the Guests journey (Build·Invite·Confirm·Seat·Day-of,
          routed) and the Explore takeover (Summary·Shortlist·Build·Compare·Lock,
          in-page tabs) today; Studio/Design/Budget/Home children land in later
          PRs. Mounted here (a layout sibling of <CustomerBottomNav>, NOT inside
          any page) so it paints + responds the instant a section opens, ahead of
          the server-built panel, and the bottom nav collapses to icons-only while
          it's docked. Self-gates to null outside any menu's section. eventDate
          drives the Guests Day-of time-gate. */}
      <CustomerSectionSubnav eventId={eventId} eventDate={(event.event_date as string | null) ?? null} navSlots={navSlots} phase={phase} hideKeys={navHideKeys} websiteEnabled={websiteEnabled} slug={(event.slug as string | null) ?? null} />
    </>
  );
}
