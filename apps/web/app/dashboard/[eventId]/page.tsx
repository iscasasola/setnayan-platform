import type { Metadata } from 'next';
import Link from 'next/link';
import { AccessRequestsDoorway } from './_components/access-requests-doorway';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Sparkles, CalendarPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { sweepLapsedSubscriptions } from '@/lib/subscriptions';
import { sweepExpiredConcierge } from '@/lib/concierge';
import { fetchGuestsByEvent } from '@/lib/guests';
import { isChineseWedding, isMuslimWedding } from '@/lib/chinese-wedding';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { loadAfterSummary, type AfterSummary } from '@/lib/after-summary';
import { formatEventDate } from '@/lib/events';
import { eventNoun } from '@/lib/event-noun';
import { FinishedEventSummary } from './_components/after/finished-event-summary';
import { eventSkuActive } from '@/lib/entitlements';
import { fetchScheduleBlocks } from '@/lib/schedule';
import { fetchBlockRosMeta } from '@/lib/schedule-ros';
import {
  deriveVendorCallTimes,
  type BroadcastCardData,
  type CallTimeVendor,
} from '@/lib/coordinator-broadcasts';
import {
  fetchLatestBroadcasts,
  isCoordinatorP3Enabled,
  resolveBroadcastAuthority,
} from '@/lib/coordinator-broadcasts-server';
import { isEmailConfigured } from '@/lib/email';
import { fetchTables, type EventTableRow } from '@/lib/seating';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { findSameDayVendors, type SameDayVendor } from '@/lib/same-day-vendors';
import {
  computeOfficiantAutoResolution,
  getOfficiantAutoResolvedHint,
} from '@/lib/officiant-auto-resolve';
import { EventDayPrepCta } from '@/app/_components/event-day-prep-cta';
import { AutoPreloadOnEventDay } from '@/app/_components/auto-preload-on-event-day';
import { DayOfModeGrid } from './_components/day-of-mode/grid';
import { SetDateNudge } from './_components/set-date-nudge';
import { PapicReadyNudge } from './_components/papic-ready-nudge';
import { NikahEssentialsCard } from './_components/nikah-essentials-card';
import { EventDashboard } from './_components/event-dashboard';
import { SubmitButton } from '@/app/_components/submit-button';
import { canPlanNextYear } from '@/lib/event-recurrence';
import { papicNudgeShouldShow } from '@/lib/papic-home-tile';
import { planNextYearEvent } from '@/app/dashboard/(account)/create-event/actions';

export const dynamic = 'force-dynamic';

/*
  ─── THE BROWSER TAB SAID "FILIPINO WEDDING PLANNING + VERIFIED VENDORS" ───

  Every sibling surface names itself — "Guests · Setnayan", "Suite · Setnayan",
  "Editorial · Setnayan" — because each one exports a `metadata.title` and the
  root layout's template wraps it. This page, the one a person actually lands
  on, exported none, so it fell through to the marketing default. With several
  events open in tabs there was no way to tell which was which.

  🔒 READ THROUGH THE CALLER'S OWN SESSION, NOT THE ADMIN CLIENT.
  `generateMetadata` runs BEFORE the page body's membership check, so an admin
  read here would put an event's name in the tab title of anyone who guessed an
  id. Under RLS a stranger gets no row and the default title, which is exactly
  right.

  Fail-soft in both directions: no name, no row, or a refused read all fall
  back to the site default rather than rendering an id or an empty title.
*/
export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  try {
    const { eventId } = await params;
    const supabase = await createClient();
    const { data } = await supabase
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle();
    const name = ((data as { display_name?: string | null } | null)?.display_name ?? '').trim();
    return name ? { title: name } : {};
  } catch {
    return {};
  }
}

/**
 * /dashboard/[eventId] — the event Home.
 *
 * Owner directive 2026-07-10: the Home IS the dashboard. The couple's
 * journey-rail / decisions / around-your-event experience (formerly the
 * standalone `/progress` route) now renders here in place via
 * `<EventDashboard>`. The Home keeps ONLY the surfaces the dashboard doesn't
 * cover — the wedding-day takeover (iteration 0031 · DayOfModeGrid + prep CTA)
 * above it, and the cultural / set-date overlays injected between the bento and
 * the journey rail through EventDashboard's `slotAfterBento` slot:
 *   • SetDateNudge          — when no firm date is set
 *   • NikahEssentialsCard   — Muslim wedding track
 *   • Tea-ceremony tile     — Chinese (Tsinoy) wedding track
 *   • PapicReadyNudge       — once, until the first photo is shot (PR-G option B)
 *
 * `<EventDashboard>` owns the AI gate (real entitlement OR `?suri=preview` for
 * internal accounts) + all its own data loading; this shell forwards the Home
 * URL's `?suri` param straight through, so the preview override now works on
 * the Home URL.
 */

const OFFICIANT_LOCKED_STATUSES = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

export default async function EventHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ suri?: string; inspect?: string }>;
}) {
  const { eventId } = await params;
  const search = searchParams ? await searchParams : {};
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Lazy expiry sweeps at the top of the dashboard (no-cron architecture per
  // CLAUDE.md 2026-05-14 / PR #47). Fire-and-forget; failures never block the
  // render. Concierge expiry + non-Concierge subscription-SKU lapse, the
  // latter scoped to this event so the hot path stays fast.
  const adminClient = createAdminClient();
  void sweepExpiredConcierge(adminClient);
  void sweepLapsedSubscriptions(adminClient, { eventId });

  // Event row — lean select of exactly what the Home shell (day-of takeover +
  // cultural / set-date overlays) reads, with the defensive fallback-to-'*'
  // pattern for migration drift between local + prod.
  const eventRes = await (async () => {
    const leanSelect =
      'event_id, event_date, event_end_date, event_type, ceremony_type, secondary_ceremony_type, cleared_at, timezone, venue_latitude, venue_longitude, region, mahr_description, gender_separation, slug';
    const leanRes = await supabase
      .from('events')
      .select(leanSelect)
      .eq('event_id', eventId)
      .maybeSingle();
    if (
      leanRes.error &&
      /column .* does not exist|undefined_column|42703/i.test(
        (leanRes.error as { message?: string; code?: string }).message ??
          (leanRes.error as { code?: string }).code ??
          '',
      )
    ) {
      return supabase.from('events').select('*').eq('event_id', eventId).maybeSingle();
    }
    return leanRes;
  })();

  const event = eventRes.data;
  if (!event) notFound();

  const isNikahEvent = isMuslimWedding({
    ceremony_type: (event as { ceremony_type?: string | null }).ceremony_type ?? null,
    secondary_ceremony_type:
      (event as { secondary_ceremony_type?: string | null }).secondary_ceremony_type ?? null,
  });
  const isChineseEvent = isChineseWedding({
    ceremony_type: (event as { ceremony_type?: string | null }).ceremony_type ?? null,
    secondary_ceremony_type:
      (event as { secondary_ceremony_type?: string | null }).secondary_ceremony_type ?? null,
  });

  // Guests — read ONLY by the Muslim-track NikahEssentialsCard (wali / witness /
  // imam role tallies), which itself renders only when isNikahEvent. So the
  // fetch is gated on isNikahEvent — every non-Muslim event skips the query
  // entirely. Fail-soft to [] so a guest-query hiccup never blocks Home.
  // (EventDashboard re-fetches its own guests for the at-a-glance stats.)
  const guests = isNikahEvent
    ? await fetchGuestsByEvent(supabase, eventId).catch((err: unknown) => {
        logQueryError(
          'EventHome (fetchGuestsByEvent threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return [] as Awaited<ReturnType<typeof fetchGuestsByEvent>>;
      })
    : ([] as Awaited<ReturnType<typeof fetchGuestsByEvent>>);

  // Day-of mode (iteration 0031): inside the day-of window, load the schedule
  // + seating + same-day data for the live grid that takes over above
  // the dashboard. Outside the window we render nothing extra and skip every
  // query.
  //
  // ⚠ This comment used to state the window as "T-1h..T+8h". That has been
  // wrong since 2026-08-05 — it is T-12h..T+36h (noon the day before → noon the
  // day after), and `dayof` additionally counts the `post` phase out to T+60h.
  // The bounds live in ONE place, lib/day-of-mode.ts; do not restate them here,
  // because a comment that drifts is how a second, disagreeing copy gets
  // written in the first place.
  /*
    ONE phase read, THREE consumers — the day-of takeover below, the
    finished-event summary added 2026-08-21, and (through the layout) the rail
    and the bottom bar. It used to be computed here as a bare `=== 'dayof'`
    boolean, which is fine right up until a second question needs asking of
    the same clock and gets its own copy of the arithmetic.
  */
  const lifecyclePhase = event.event_date
    ? getMenuLifecyclePhase(
        event.event_date,
        (event as { cleared_at?: string | null }).cleared_at ?? null,
        // The VENUE's clock, not the server's. Without it the anchor is the
        // runtime's own midnight — UTC on Vercel — which for a Manila event is
        // 8 hours out, enough to flip this on the wrong side of the boundary on
        // the one day the couple opens the page all morning.
        (event as { timezone?: string | null }).timezone ?? undefined,
        undefined,
        // The LAST day of a celebration that spans several, so a five-day
        // festival is not declared over on its third morning. Null for every
        // event in production today.
        (event as { event_end_date?: string | null }).event_end_date ?? null,
      )
    : 'plan';
  const dayOfActive = lifecyclePhase === 'dayof';

  /*
    ─── THE EVENT IS OVER: LEAD WITH WHAT HAPPENED, NOT WITH WHAT TO PLAN ───

    Owner, 2026-08-21: *"why can i still plan and build and create guest list
    as if it hasn't ended… show the summary of the overview, guest,
    marketplace, suite, and the editorial maker."*

    The After phase arrives EITHER when the host closes the day out from the
    wrap-up screen, OR automatically once the day-of window has fully passed —
    both already resolved by `getMenuLifecyclePhase`; no new boundary is
    invented here.

    ⚠ THE LOADER IS FAIL-SOFT AND IS NOT AWAITED ANYWHERE ELSE. Every count is
    `number | null`, null meaning NOT MEASURED, so a refused read costs the
    card its figure and nothing else.
  */
  const afterActive = lifecyclePhase === 'after';
  let afterSummary: AfterSummary | null = null;
  if (afterActive) {
    afterSummary = await loadAfterSummary(adminClient, eventId).catch(() => null);
  }
  let dayOfBlocks: Awaited<ReturnType<typeof fetchScheduleBlocks>> = [];
  let dayOfHeadTable: EventTableRow | null = null;
  let dayOfNearbyTables: EventTableRow[] = [];
  let dayOfSameDayVendors: SameDayVendor[] = [];
  // LIVE_WALL ownership for the day-of grid's photo-wall card. Same predicate
  // /wall/[eventId] gates on, so the card and the destination can never disagree.
  // Fails closed: any read error leaves this false and the card simply hides.
  let dayOfLiveWallActive = false;
  let dayOfBroadcast: BroadcastCardData | undefined;
  if (dayOfActive) {
    const [blocksRes, tablesRes, sameDayRes] = await Promise.all([
      fetchScheduleBlocks(supabase, eventId).catch(() => []),
      fetchTables(supabase, eventId).catch(() => [] as EventTableRow[]),
      // Day-of "Get help" shortlist (Event Lifecycle Menu §4 / PR5) — verified
      // + paid vendors who opted into same-day work, nearest the venue first.
      // Best-effort: a query error just leaves the escalation-only floor.
      findSameDayVendors(supabase, {
        lat: (event as { venue_latitude?: number | null }).venue_latitude ?? null,
        lng: (event as { venue_longitude?: number | null }).venue_longitude ?? null,
        region: (event as { region?: string | null }).region ?? null,
      }).catch(() => [] as SameDayVendor[]),
    ]);
    dayOfBlocks = blocksRes;
    dayOfSameDayVendors = sameDayRes;
    const tables = tablesRes;
    // The canonical 2026-05-09 catalog replaces the variable-capacity 'head_table'
    // with three fixed family_head_12/14/16 variants. Day-of UI keeps surfacing
    // a single "head table" by picking the first family_head_* row found.
    dayOfHeadTable = tables.find((t) => t.table_type.startsWith('family_head_')) ?? null;
    dayOfNearbyTables = tables.filter((t) => t.table_id !== dayOfHeadTable?.table_id).slice(0, 6);

    // LIVE_WALL — resolve ownership server-side so the client grid can hide the
    // card. Best-effort; a throw leaves it false.
    try {
      dayOfLiveWallActive = await eventSkuActive(adminClient, eventId, 'LIVE_WALL');
    } catch {
      dayOfLiveWallActive = false;
    }

    // Coordinator P3 (flag-gated, default OFF): the broadcast card's data —
    // latest broadcasts (RLS-scoped; [] pre-migration), whether THIS viewer
    // may compose (couple / schedule-'edit' delegate), and — for composers
    // only — the derivable vendor call-time count + email availability that
    // drive the "Email call-times" button. Flag off → `dayOfBroadcast` stays
    // undefined and the card renders its pre-P3 stub exactly as today.
    if (await isCoordinatorP3Enabled()) {
      try {
        const [broadcastItems, authority] = await Promise.all([
          fetchLatestBroadcasts(supabase, eventId, 3),
          resolveBroadcastAuthority(supabase, eventId, user.id),
        ]);
        let callTimeCount = 0;
        let emailConfigured = false;
        if (authority.canSend) {
          const [rosMeta, vendorsRes, emailCfg] = await Promise.all([
            fetchBlockRosMeta(supabase, eventId),
            supabase
              .from('event_vendors')
              .select('vendor_id, vendor_name, contact_email')
              .eq('event_id', eventId)
              .is('archived_at', null),
            isEmailConfigured(),
          ]);
          const vendors = (vendorsRes.data ?? []) as CallTimeVendor[];
          callTimeCount = deriveVendorCallTimes(dayOfBlocks, rosMeta, vendors).length;
          emailConfigured = emailCfg;
        }
        dayOfBroadcast = {
          items: broadcastItems,
          senderRole: authority.role,
          callTimeCount,
          emailConfigured,
        };
      } catch {
        dayOfBroadcast = undefined;
      }
    }
  }

  // Nikah imam designation (Muslim track). The Five-essentials card ticks the
  // "Imam / qadi" essential when a guest has role 'imam' (computed in the card
  // from `guests`), OR — computed here, since the card only sees guests — when
  // the couple has booked an officiant vendor (locked), OR when a locked mosque
  // venue auto-resolves the imam (computeOfficiantAutoResolution → muslim_mosque,
  // which also surfaces the PD 1083 hint). Only runs for muslim events, and the
  // auto-resolve query only fires when no officiant vendor is already booked.
  let nikahImamBooked = false;
  let nikahImamNote: string | null = null;
  if (isNikahEvent) {
    const officiantRowsRes = await (async () => {
      try {
        return await supabase
          .from('event_vendors')
          .select('marketplace_vendor_id, source_venue_directory_id, category, status')
          .eq('event_id', eventId)
          .is('archived_at', null);
      } catch (caught) {
        logQueryError(
          'EventHome (nikah officiant event_vendors SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        );
        return { data: [], error: null } as never;
      }
    })();
    const officiantRows = (officiantRowsRes.data ?? []) as Array<{
      marketplace_vendor_id: string | null;
      source_venue_directory_id: string | null;
      category: string | null;
      status: string | null;
    }>;
    nikahImamBooked = officiantRows.some(
      (v) => v.category === 'officiant' && OFFICIANT_LOCKED_STATUSES.has(v.status ?? ''),
    );
    if (!nikahImamBooked) {
      const resolved = await computeOfficiantAutoResolution(supabase, {
        eventId,
        ceremonyType: 'muslim',
        vendorRows: officiantRows,
      }).catch(() => null);
      if (resolved?.framing === 'muslim_mosque') {
        nikahImamBooked = true;
        nikahImamNote = getOfficiantAutoResolvedHint('muslim_mosque');
      }
    }
  }

  // Recurrence (owner 2026-07-12): recurring types (birthday · anniversary ·
  // reunion · corporate) get a "plan next year" card that clones this event's
  // details forward into a fresh instance.
  const canRecur = canPlanNextYear((event.event_type as string | null) ?? null);

  // ── May this viewer see Papic's numbers? ───────────────────────────────────
  // Still a CORRECTNESS gate, not a nicety: all three capture tables are
  // couple-only in RLS (`papic_photos_couple_full` etc.) and an RLS denial returns
  // `count: 0` with NO error — so the resolver reads via service-role and takes
  // this flag explicitly. Without it a viewer the policy excludes is told
  // "0 cameras out" on a wedding already mid-shoot.
  //
  // 🔓 WIDENED TO COORDINATORS 2026-07-30 (owner: "yes" — should coordinators see
  // Papic counts on home). It was couple-only, which was the conservative default
  // I shipped rather than make a privacy call unilaterally. The owner has now made
  // it: a delegated coordinator runs the event and sees the guest list, schedule
  // and vendors, so an aggregate photo/shot COUNT is squarely inside that remit.
  // Note what is and is not widened — they see the NUMBERS on home; the RLS on the
  // capture tables is deliberately UNTOUCHED, so no coordinator gains access to a
  // photo. `['couple','coordinator']` mirrors the membership test the day-of
  // launcher and galleries hub already use.
  //
  // Resolved ONCE here and threaded into <EventDashboard> for the tile, so the
  // whole feature costs one indexed query rather than two.
  const { data: papicViewerMembership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  const canViewPapicCounts = Boolean(papicViewerMembership);

  // Papic nudge gate (PR-G option B). Asked ONLY when the nudge could actually
  // render — a date-less event is showing the set-date nudge instead, and a
  // non-couple viewer never sees it — so neither pays a query.
  const papicNudgeVisible =
    event.event_date && canViewPapicCounts
      ? await papicNudgeShouldShow(adminClient, eventId, canViewPapicCounts)
      : false;

  // Home-injected overlays — the cultural / set-date cards that the dashboard
  // doesn't cover. Passed to <EventDashboard> as `slotAfterBento` so they land
  // between the At-a-glance bento and the journey rail.
  const overlays = (
    <>
      {/* The five essentials of your Nikah — the signature card for the Muslim
       *  wedding track. Shows ONLY for muslim weddings (primary ceremony OR a
       *  mixed ceremony with a muslim leg). Turns the five validity pillars of
       *  the Islamic marriage contract into a tangible checklist + hosts the
       *  mahr / gender-separation editor. */}
      {isNikahEvent ? (
        <NikahEssentialsCard
          eventId={eventId}
          eventDateSet={!!event.event_date}
          mahrDescription={
            (event as { mahr_description?: string | null }).mahr_description ?? null
          }
          genderSeparation={
            (event as { gender_separation?: string | null }).gender_separation ?? null
          }
          guests={guests}
          imamBooked={nikahImamBooked}
          imamNote={nikahImamNote}
        />
      ) : null}

      {/* Set-your-date nudge — date-as-output keeps onboarding's event_date NULL,
       *  but the couple still needs a clear, low-friction way to lock the date
       *  later so the date-gated public website lifecycle (Save-the-Date / Event
       *  / Editorial) can launch. Renders ONLY when no date is set; dismissible
       *  per-event; links to the existing /date-selection governed surface. */}
      {!event.event_date ? <SetDateNudge eventId={eventId} /> : null}

      {/* "Your free camera is ready" — Papic promotion PR-G option B (owner picked
       *  A + B on 2026-07-30). Every event is armed at creation with a free shared
       *  pool of shots AND one free dedicated camera, and until now the couple was
       *  never told so anywhere on their home. Renders ONLY while nothing has been
       *  shot yet; dismissible per-event; the mini-tile in the bento is the
       *  permanent "where it stands" readout once shooting starts.
       *
       *  ⚠ IT WAITS ITS TURN BEHIND THE SET-DATE NUDGE (owner default, PR-G
       *  question 3). Two stacked bands in one slot read as clutter, and set-date
       *  goes first because the whole date-gated public-site lifecycle waits on
       *  it — so a date-less event is asked for the date, and meets Papic once
       *  that is settled. */}
      {event.event_date && papicNudgeVisible ? (
        <PapicReadyNudge eventId={eventId} />
      ) : null}

      {/* Chinese (Tsinoy) tea-ceremony helper — a FREE, ceremony-gated tile.
       *  Renders only for Chinese weddings (primary OR secondary 'chinese' rite,
       *  per the locked overlay model · isChineseWedding). The tea ceremony
       *  (敬茶) is the signature moment; the tile links to the serving-order
       *  helper so couples prepare the groom's-side-then-bride's-side order with
       *  both families. Never routed through the paid add-ons catalog. */}
      {isChineseEvent ? (
        <Link
          href={`/dashboard/${eventId}/guests/tea-ceremony`}
          className="flex items-center gap-3 rounded-xl border border-terracotta/25 bg-terracotta/[0.04] px-4 py-3 transition-colors hover:border-terracotta/45 hover:bg-terracotta/[0.07]"
        >
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta-700"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              Tea ceremony serving order
            </span>
            <span className="block text-xs text-ink/60">
              Plan who you serve first — groom&rsquo;s side, then bride&rsquo;s,
              in order of seniority.
            </span>
          </span>
          <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
        </Link>
      ) : null}

      {/* Plan next year — recurrence (owner-locked 2026-07-12). Recurring types
       *  clone this event's details forward into next year's fresh planning
       *  instance; the guest list starts fresh ("Details, not the guest list"). */}
      {canRecur ? (
        <form
          action={planNextYearEvent}
          className="flex items-center gap-3 rounded-xl border border-mulberry/25 bg-mulberry/[0.04] px-4 py-3"
        >
          <input type="hidden" name="event_id" value={eventId} />
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-mulberry"
          >
            <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              Make it an annual tradition
            </span>
            <span className="block text-xs text-ink/60">
              Plan next year&rsquo;s celebration — we&rsquo;ll carry over the
              details and start you a fresh guest list.
            </span>
          </span>
          <SubmitButton
            className="shrink-0 rounded-full border border-mulberry/30 px-4 py-2 text-sm font-semibold text-mulberry transition hover:bg-mulberry/10"
            pendingLabel="Creating…"
          >
            Plan next year
          </SubmitButton>
        </form>
      ) : null}
    </>
  );

  const hasOverlays =
    isNikahEvent || !event.event_date || isChineseEvent || canRecur;

  return (
    <>
      {/* "EVENT DAY SOON" was rendering for a full day AFTER the celebration —
          its own window is T-3d..T+1d and it never asked whether the day had
          been and gone. It is TOLD, from the one resolver, rather than given a
          third opinion of its own. */}
      <EventDayPrepCta eventId={eventId} eventDate={event.event_date} finished={afterActive} />
      {/* Self-hiding: renders nothing unless a coordinator is waiting on an
          answer (owner ruling 2026-07-27 — the host decides what to share). */}
      <AccessRequestsDoorway eventId={eventId} />
      <AutoPreloadOnEventDay eventId={eventId} eventDate={event.event_date} finished={afterActive} />
      {dayOfActive ? (
        <DayOfModeGrid
          eventId={eventId}
          blocks={dayOfBlocks.map((b) => ({
            block_id: b.block_id,
            label: b.label,
            start_at: b.start_at,
            end_at: b.end_at,
            location: b.location,
          }))}
          headTable={dayOfHeadTable}
          nearbyTables={dayOfNearbyTables}
          sameDayVendors={dayOfSameDayVendors}
          liveWallActive={dayOfLiveWallActive}
          broadcast={dayOfBroadcast}
        />
      ) : null}

      {/* Day-of takeover (council verdict Phase 6, owner sign-off #4). On the
       *  day itself the planning stack RECEDES: it is still one tap away, but
       *  it stops being the thing the page leads with. A couple opening this at
       *  the reception needs what is happening now — not "74% planned" and a
       *  reminder to book a caterer they are currently eating the food of.
       *
       *  Receded, NOT removed. A host who genuinely needs the vendor list on
       *  the day would otherwise be stranded, and the last hours before a
       *  ceremony are the worst possible moment to hide a phone number. */}
      {dayOfActive ? (
        <>
          <Link
            href={`/dashboard/${eventId}/live`}
            className="sn-tile sn-press flex items-center justify-between gap-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink">
                Open the live desk
              </span>
              <span className="mt-0.5 block text-[12.5px] text-ink/55">
                Announcements, the photo wall and what is happening now.
              </span>
            </span>
            <ArrowRight aria-hidden className="h-4 w-4 flex-none text-ink/40" />
          </Link>

          <details className="sn-tile">
            <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-ink/70">
              Planning tools — still here if you need them
            </summary>
            <div className="mt-4 space-y-6">
              <EventDashboard
                eventId={eventId}
                suriPreviewParam={search.suri}
                inspectId={search.inspect}
                slotAfterBento={hasOverlays ? overlays : undefined}
                dayOfActive={dayOfActive}
                lifecyclePhase={lifecyclePhase}
                canViewPapicCounts={canViewPapicCounts}
              />
            </div>
          </details>
        </>
      ) : afterActive && afterSummary ? (
        /*
          ─── AFTER THE DAY: THE SUMMARY LEADS, THE PLANNING STACK RECEDES ───

          Deliberately the SAME two-part shape as the day-of branch above —
          the thing that matters now on top, the planning tools one click
          below — because it is the same product move for a different reason,
          and a second, differently-shaped "receded" state is how two screens
          drift into disagreeing about what receding means.

          🔒 NOTHING IS TAKEN AWAY. A host still adding the cousin who turned
          up, or still settling a balance, opens the disclosure and has every
          tool exactly where it was. The rail keeps all its rows too.
        */
        <>
          <FinishedEventSummary
            eventId={eventId}
            noun={eventNoun(event.event_type as string | null)}
            dateLabel={
              event.event_date ? formatEventDate(event.event_date as string) || null : null
            }
            slug={(event as { slug?: string | null }).slug ?? null}
            summary={afterSummary}
          />

          <details className="sn-tile">
            <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-ink/70">
              Planning tools — still here if you need them
            </summary>
            <div className="mt-4 space-y-6">
              <EventDashboard
                eventId={eventId}
                suriPreviewParam={search.suri}
                inspectId={search.inspect}
                slotAfterBento={hasOverlays ? overlays : undefined}
                dayOfActive={dayOfActive}
                lifecyclePhase={lifecyclePhase}
                canViewPapicCounts={canViewPapicCounts}
              />
            </div>
          </details>
        </>
      ) : (
        /* The dashboard — hero → at-a-glance bento → [overlays] → journey rail →
         *  decisions → around-your-event, plus the AI extras (Suri briefing,
         *  What's-next, Suri on watch) when Setnayan AI is active for the viewer
         *  (or `?suri=preview` for internal accounts). */
        <EventDashboard
          eventId={eventId}
          suriPreviewParam={search.suri}
          inspectId={search.inspect}
          slotAfterBento={hasOverlays ? overlays : undefined}
          dayOfActive={dayOfActive}
          lifecyclePhase={lifecyclePhase}
          canViewPapicCounts={canViewPapicCounts}
        />
      )}
    </>
  );
}
