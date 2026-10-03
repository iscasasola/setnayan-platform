import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccessRequestsDoorway } from './_components/access-requests-doorway';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Sparkles, CalendarPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { sweepLapsedSubscriptions } from '@/lib/subscriptions';
import { sweepExpiredConcierge } from '@/lib/concierge';
import { fetchGuestsByEventMeasured, unmeasuredGuests } from '@/lib/guests';
import type { EventMoney } from '@/lib/budget-truth';
import { readBudgetLiveSummary } from '@/lib/budget-live-read';
import { homeFacts, type HomeMoneyRead } from '@/lib/home-facts';
import { LastSeenCapture } from '@/app/_components/last-seen/last-seen-capture';
import { resolveBudgetVisibility } from '@/lib/budget-visibility';
import {
  aiStatus,
  homeGuestsRead,
  homeServices,
  nikahStatus,
  papicStatus,
  pickHomeNext,
} from '@/lib/home-first-screen';
import { nikahTrackedDone } from '@/lib/nikah-essentials';
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
  BROADCASTS_UNREADABLE,
  fetchLatestBroadcasts,
  isCoordinatorP3Enabled,
  resolveBroadcastAuthority,
} from '@/lib/coordinator-broadcasts-server';
import { isEmailConfigured } from '@/lib/email';
import { fetchTables, type EventTableRow } from '@/lib/seating';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { findSameDayVendors, type SameDayVendor } from '@/lib/same-day-vendors';
import { EventDayPrepCta } from '@/app/_components/event-day-prep-cta';
import { AutoPreloadOnEventDay } from '@/app/_components/auto-preload-on-event-day';
import { DayOfModeGrid } from './_components/day-of-mode/grid';
import { SetDateNudge } from './_components/set-date-nudge';
import { readHomeGuide } from './_components/details-guide-home-card';
import { HomeFirstScreen } from './_components/home-first-screen';
import { DateChangeDoorway } from './_components/date-change-doorway';
import { WhatsNextSheet } from './_components/whats-next-sheet';
import { PapicReadyNudge } from './_components/papic-ready-nudge';
import { readNikahImam } from './_components/nikah-imam';
import { SetnayanAiComebackOffer } from './_components/setnayan-ai-comeback-offer';
import { EventDashboard } from './_components/event-dashboard';
import { MiniTour } from '@/app/_components/mini-tour';
import { SubmitButton } from '@/app/_components/submit-button';
import { canPlanNextYear } from '@/lib/event-recurrence';
import { papicNudgeShouldShow, resolvePapicHomeTile } from '@/lib/papic-home-tile';
import { isSetnayanAiActiveForEvent } from '@/lib/setnayan-ai';
import { planNextYearEvent } from '@/app/dashboard/(account)/create-event/actions';
import { resolveSetnayanAiPaywallEnabled } from '@/lib/integration-config';
import { resolveSetnayanAiOfferForEvent } from '@/lib/setnayan-ai-server';
import { fetchPlatformSettings } from '@/lib/platform-settings';

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
    // A refusal costs a browser-tab title and nothing else — the fallback
    // below is the site default, which is the right answer either way. Bound
    // and logged so it cannot hide a whole-table refusal that matters elsewhere.
    const { data, error: titleError } = await supabase
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle();
    if (titleError) {
      logQueryError('EventHomeMetadata.title', titleError, { event_id: eventId }, 'graceful_degrade');
    }
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
 * `<EventDashboard>` owns the AI gate (real entitlement OR `?sai=preview` for
 * internal accounts) + all its own data loading; this shell forwards the Home
 * URL's `?sai` param straight through, so the preview override now works on
 * the Home URL.
 */

export default async function EventHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ sai?: string; inspect?: string; sheet?: string }>;
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
      'event_id, event_date, event_end_date, event_type, ceremony_type, secondary_ceremony_type, cleared_at, timezone, venue_latitude, venue_longitude, region, mahr_description, gender_separation, slug, display_name, created_at, setnayan_ai_active, event_date_precision, planning_mode, setnayan_ai_active_until';
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

  // ─── EVERY READ BELOW STARTS AT ONCE ─────────────────────────────────────
  // 🔑 NONE OF THESE READS NEEDS ANOTHER ONE'S ANSWER, so none of them waits for
  // one. They used to run one after another — the Nikah guests, the finished-
  // event summary, the day-of grid, the Nikah officiant, the Papic viewer and
  // nudge, the Setnayan AI offer and the store-shell check, each waiting for the
  // last — and the event overview took ~1.4 s (measured on prod, 2026-09-29).
  // Each block below is STARTED here, as a promise, with its own graceful-
  // degrade exactly as it was, and they are all awaited together in the one
  // `Promise.all` under the one wait below. A read that needs an earlier answer
  // (the Papic nudge needs the viewer's membership; the AI offer needs the
  // paywall flag) chains INSIDE its own started promise, as it always did.
  // 🔒 THE EVENT ROW ABOVE STAYS FIRST. Every service-role read below is still
  // started only after `notFound()` has refused a caller who cannot read it.
  // ⚠ ADD A NEW READ AS ANOTHER STARTED PROMISE, NOT AS ANOTHER `await` IN THIS
  // RUN — one stray `await` puts a full database trip back in front of the page.

  // Guests — read by Home's first screen (📱 "coming" · "no reply", owner-
  // APPROVED 2026-10-01) and by the Muslim-track NikahEssentialsCard (wali /
  // witness / imam role tallies). MEASURED: a refused read reports
  // `measured: false`, and the numbers print "—" — never "0 coming" to a couple
  // with 180 names (`lib/guests-read-is-honest.test.ts`). A throw degrades the
  // same way. The same counts the dashboard's attending tile and its "haven't
  // replied yet" line already use (`computeGuestStats`).
  const guestsRead = fetchGuestsByEventMeasured(supabase, eventId).catch((err: unknown) => {
    logQueryError(
      'EventHome (fetchGuestsByEventMeasured threw)',
      err instanceof Error ? err : new Error(String(err)),
      { event_id: eventId, user_id: user.id },
      'graceful_degrade',
    );
    return unmeasuredGuests();
  });

  // 📱 Paid / Still owing — the SAME figures the Budget page's Paid/Owed tiles
  // print (`budgetLiveSummaryMoney` over `buildBudgetLiveSummary`, the one core
  // BA2 allows a couple-facing surface to use), asked only of a viewer the
  // budget is shared with (`resolveBudgetVisibility`, before any money read —
  // a refusal that still queries the money is a refusal on the screen only).
  // `fetchBudgetSnapshot` THROWS on any refused read, so `null` below is
  // "not measured" and prints "—", never ₱0. `hidden` = not shared: no line.
  const moneyRead = (async (): Promise<{ now: HomeMoneyRead; guard: EventMoney | null }> => {
    const access = await resolveBudgetVisibility(supabase, eventId, user.id).catch(() => null);
    if (!access?.mayRead) return { now: 'hidden', guard: null };
    // ONE read — `lib/budget-live-read.ts` — the same one the Merkado budget lens
    // uses; `guard` is the resolved money the Sai watch rail is handed, so the
    // dashboard below never resolves it a second time.
    const read = await readBudgetLiveSummary(supabase, eventId, {
      onSnapshotError: (err: unknown) =>
        logQueryError(
          'EventHome (fetchBudgetSnapshot threw)',
          err instanceof Error ? err : new Error(String(err)),
          { event_id: eventId, user_id: user.id },
          'graceful_degrade',
        ),
    });
    return {
      now: read.summary ? { paid: read.summary.paid, owing: read.summary.remaining } : null,
      guard: read.money,
    };
  })();

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
  const afterSummaryRead: Promise<AfterSummary | null> = afterActive
    ? eventEntitlementClient(eventId)
        .then((ent) => loadAfterSummary(ent, eventId))
        .catch(() => null)
    : Promise.resolve(null);
  const dayOfRead = (async () => {
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
      // The schedule is read ONCE and shared: the grid shows it, and the P3
      // call-time count below derives from it, so that count waits on this
      // promise rather than on the whole day-of batch.
      const blocksRead = fetchScheduleBlocks(supabase, eventId).catch(() => []);

      // LIVE_WALL — resolve ownership server-side so the client grid can hide the
      // card. Best-effort; a throw leaves it false. Started beside the three
      // reads below, never after them — it needs none of their answers.
      const liveWallRead = (async () => {
        try {
          return await eventSkuActive(await eventEntitlementClient(eventId), eventId, 'LIVE_WALL');
        } catch {
          return false;
        }
      })();

      // Coordinator P3 (flag-gated, default OFF): the broadcast card's data —
      // latest broadcasts (RLS-scoped; [] pre-migration), whether THIS viewer
      // may compose (couple / schedule-'edit' delegate), and — for composers
      // only — the derivable vendor call-time count + email availability that
      // drive the "Email call-times" button. Flag off → `dayOfBroadcast` stays
      // undefined and the card renders its pre-P3 stub exactly as today.
      const broadcastCardRead = (async (): Promise<BroadcastCardData | undefined> => {
        if (await isCoordinatorP3Enabled()) {
          try {
            const [broadcastRead, authority] = await Promise.all([
              fetchLatestBroadcasts(supabase, eventId, 3),
              resolveBroadcastAuthority(supabase, eventId, user.id),
            ]);
            const broadcastsMeasured = broadcastRead !== BROADCASTS_UNREADABLE;
            const broadcastItems = broadcastsMeasured ? broadcastRead : [];
            let callTimeCount = 0;
            let emailConfigured = false;
            if (authority.canSend) {
              const [rosMeta, vendorsRes, emailCfg, blocks] = await Promise.all([
                fetchBlockRosMeta(supabase, eventId),
                supabase
                  .from('event_vendors')
                  .select('vendor_id, vendor_name, contact_email')
                  .eq('event_id', eventId)
                  .is('archived_at', null),
                isEmailConfigured(),
                blocksRead,
              ]);
              const vendors = (vendorsRes.data ?? []) as CallTimeVendor[];
              callTimeCount = deriveVendorCallTimes(blocks, rosMeta, vendors).length;
              emailConfigured = emailCfg;
            }
            return {
              items: broadcastItems,
              senderRole: authority.role,
              callTimeCount,
              emailConfigured,
              broadcastsMeasured,
            };
          } catch {
            return undefined;
          }
        }
        return undefined;
      })();

      const [blocksRes, tablesRes, sameDayRes, liveWallRes, broadcastRes] = await Promise.all([
        blocksRead,
        fetchTables(supabase, eventId).catch(() => [] as EventTableRow[]),
        // Day-of "Get help" shortlist (Event Lifecycle Menu §4 / PR5) — verified
        // + paid vendors who opted into same-day work, nearest the venue first.
        // Best-effort: a query error just leaves the escalation-only floor.
        findSameDayVendors(supabase, {
          lat: (event as { venue_latitude?: number | null }).venue_latitude ?? null,
          lng: (event as { venue_longitude?: number | null }).venue_longitude ?? null,
          region: (event as { region?: string | null }).region ?? null,
        }).catch(() => [] as SameDayVendor[]),
        liveWallRead,
        broadcastCardRead,
      ]);
      dayOfBlocks = blocksRes;
      dayOfSameDayVendors = sameDayRes;
      const tables = tablesRes;
      // The canonical 2026-05-09 catalog replaces the variable-capacity 'head_table'
      // with three fixed family_head_12/14/16 variants. Day-of UI keeps surfacing
      // a single "head table" by picking the first family_head_* row found.
      dayOfHeadTable = tables.find((t) => t.table_type.startsWith('family_head_')) ?? null;
      dayOfNearbyTables = tables.filter((t) => t.table_id !== dayOfHeadTable?.table_id).slice(0, 6);
      dayOfLiveWallActive = liveWallRes;
      dayOfBroadcast = broadcastRes;
    }
    return {
      dayOfBlocks,
      dayOfHeadTable,
      dayOfNearbyTables,
      dayOfSameDayVendors,
      dayOfLiveWallActive,
      dayOfBroadcast,
    };
  })();

  // Nikah imam designation (Muslim track) — the Nikah essentials' own page
  // (`/nikah`) and the one-line status on the "Your services" row both read it
  // from the one reader. Only runs for muslim events.
  const nikahImamRead = isNikahEvent
    ? readNikahImam(supabase, eventId, user.id)
    : Promise.resolve({ nikahImamBooked: false, nikahImamNote: null as string | null });

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
  // ⚖ Fails closed: an unread membership hides the photo counts rather than
  // ⚖ showing a coordinator numbers they may not be entitled to. Logged, so a
  // ⚖ couple who cannot see their own photo tile leaves a trace.
  //
  // ⛓ ONE STARTED PROMISE, because the nudge below is authorised BY this
  // membership read — it is a service-role count, so it must never start before
  // the answer is in. The pair is returned together and unpacked after the wait.
  const papicViewerRead = (async () => {
    const { data: papicViewerMembership, error: papicViewerMembershipError } = await supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .in('member_type', ['couple', 'coordinator'])
      .maybeSingle();
    if (papicViewerMembershipError) {
      logQueryError(
        'EventHomePage.papicViewerMembership',
        papicViewerMembershipError,
        { event_id: eventId },
        'graceful_degrade',
      );
    }
    const canViewPapicCounts = Boolean(papicViewerMembership);

    // Papic nudge gate (PR-G option B). Asked ONLY when the nudge could actually
    // render — a date-less event is showing the set-date nudge instead, and a
    // non-couple viewer never sees it — so neither pays a query.
    const papicNudgeVisible =
      event.event_date && canViewPapicCounts
        ? await papicNudgeShouldShow(adminClient, eventId, canViewPapicCounts)
        : false;
    // The viewer's role also decides Home's guided card (Details part 5) — the same read, never a second.
    const viewerMemberType = (papicViewerMembership as { member_type?: string | null } | null)?.member_type ?? null;
    return { canViewPapicCounts, papicNudgeVisible, viewerMemberType };
  })();

  // Setnayan AI comeback offer (owner-locked 2026-08-30): one 24h window per
  // HOST, inside which every event they own that never bought AI is offered at
  // HALF ITS OWN SIGN-UP SAVING — the midpoint of that event's tier row, never
  // a hard-coded percentage. Dormant whenever the paywall is off
  // (`resolveSetnayanAiPaywallEnabled`) — the same gate `/studio/setnayan-ai`
  // uses — so this costs nothing while the paywall stays off.
  // `resolveSetnayanAiOfferForEvent` is the single resolver both this card
  // and the checkout charge path agree with; see lib/order-charge-authority.ts
  // for the server-side charge-time mirror.
  //
  // ⏭ ONCE THE WINDOW LAPSES THE CARD KEEPS SELLING, AT LIST PRICE (owner
  // 2026-08-31: *"sai expired. should show a cta button to purchase still"*).
  // The resolver returns a `kind` — 'comeback' inside the window, 'full' after
  // it — and `null` only when there is genuinely nothing to sell (the event
  // already owns AI, or no usable price). The DISCOUNT expires here, not the
  // product.
  //
  // ⛓ The flag, the offer and its settings chain INSIDE one started promise —
  // each still asked only when the one before it says so.
  const aiOfferRead = (async () => {
    // `null` = the paywall could not be resolved: no offer, and Home's
    // "Your services" row prints "—" for Setnayan AI rather than guess.
    const paywallOn = await resolveSetnayanAiPaywallEnabled().catch((): boolean | null => null);
    const aiOffer = paywallOn === true
      ? await resolveSetnayanAiOfferForEvent(
          supabase,
          eventId,
          (event.event_type as string | null) ?? null,
        ).catch(() => null)
      : null;
    // Only the BUY-card branch needs the BDO/GCash settings — fetch lazily,
    // same pattern as the studio buy page.
    const aiOfferSettings = aiOffer ? await fetchPlatformSettings(supabase) : null;
    return { aiOffer, aiOfferSettings, paywallOn };
  })();

  // 🔒 NO PRICE ON THE FIRST SCREEN IN THE STORE SHELL. This offer carries a
  // peso figure (and a struck-through "regular" one) for a digital SKU, on the
  // page a couple lands on right after signing in — the most visible possible
  // place for an App Review 3.1.1 finding. The route stays open because the
  // dashboard is the planning surface the store shell exists for; only the
  // purchase pitch is withheld. See lib/store-shell.ts.
  const storeShellRead = isStoreShellRequest();

  // 🪜 The guided "What's left" (Details part 5) — the FIRST candidate for the
  // one Next card. Authorised by the viewer's role, so it chains on that read.
  // 📷 Papic's status for Home's "Your services" row — the SAME reader the
  // dashboard's Papic tile and the free-camera nudge use (readiness, not a
  // pill of ownership), authorised by the same membership read. A throw is
  // 'failed' and prints "—".
  const papicTileRead = papicViewerRead.then(({ canViewPapicCounts: may }) =>
    may
      ? resolvePapicHomeTile(adminClient, eventId, true).catch((): 'failed' => 'failed')
      : Promise.resolve(null),
  );

  const homeGuideRead = papicViewerRead.then(({ viewerMemberType }) =>
    readHomeGuide({ eventId, memberType: viewerMemberType }).catch(() => null),
  );

  // ─── THE ONE WAIT ────────────────────────────────────────────────────────
  const [
    { rows: guests, measured: guestsMeasured, stats: guestStats },
    afterSummary,
    {
      dayOfBlocks,
      dayOfHeadTable,
      dayOfNearbyTables,
      dayOfSameDayVendors,
      dayOfLiveWallActive,
      dayOfBroadcast,
    },
    { nikahImamBooked },
    { canViewPapicCounts, papicNudgeVisible, viewerMemberType },
    { aiOffer, aiOfferSettings, paywallOn },
    storeShell,
    homeGuide,
    { now: moneyNow, guard: guardMoney },
    papicTile,
  ] = await Promise.all([
    guestsRead,
    afterSummaryRead,
    dayOfRead,
    nikahImamRead,
    papicViewerRead,
    aiOfferRead,
    storeShellRead,
    homeGuideRead,
    moneyRead,
    papicTileRead,
  ]);

  /*
    📱 HOME'S FIRST SCREEN (owner-APPROVED 2026-10-01, "THE SIMPLE PHONE APP —
    APPROVED"): the nudges below collapse into ONE Next card — the first that
    applies, in the order this page already stacked them (`HOME_NEXT_ORDER`).
    The one it picks is not drawn again below; every other one stays exactly
    where it was, one scroll down ("See all").
  */
  const aiOfferShown = Boolean(aiOffer && aiOfferSettings && !storeShell);
  const homeNext = pickHomeNext({
    guide: homeGuide,
    hasDate: Boolean(event.event_date),
    // 👥 "Add your guests" / "Send N invitations" (first-timer fix 9) — from the
    // SAME measured guest read the numbers below use; a refused read is null.
    guests: homeGuestsRead(guests, guestsMeasured),
    noun: eventNoun(event.event_type as string | null),
    // Papic's page is web-only in the store shell (STORE_SHELL_HIDDEN_ADDON_KEYS),
    // so the Next card does not send an App Store user there.
    papicReady: Boolean(event.event_date && papicNudgeVisible && !storeShell),
    aiOffer: aiOfferShown,
  });
  // 🔑 THE NUMBERS HOME STATES ARE WORKED OUT ONCE, HERE — days to go, coming,
  // no reply, Paid / Still owing (`lib/home-facts.ts`). The first screen DRAWS
  // them and the dashboard below is handed `daysOut` + the guest counts, so the
  // two can never count one fact two ways.
  const facts = homeFacts({
    eventDate: (event.event_date as string | null) ?? null,
    precision: (event as { event_date_precision?: string | null }).event_date_precision,
    timezone: (event as { timezone?: string | null }).timezone,
    guests: { stats: guestStats, measured: guestsMeasured },
    money: moneyNow,
  });
  const homeServiceRow = homeServices({
    next: homeNext.kind,
    storeShell,
    papic: papicStatus(
      canViewPapicCounts ? { permitted: true, tile: papicTile } : { permitted: false },
    ),
    ai: aiStatus(
      paywallOn === null
        ? null
        : isSetnayanAiActiveForEvent(
            event as {
              planning_mode?: string | null;
              setnayan_ai_active?: boolean | null;
              setnayan_ai_active_until?: string | null;
            },
            { paywallEnabled: paywallOn },
          ),
      // 🏷 The comeback offer's card left with Home's second section; its one
      // surviving line is the row's status, while the couple's window is open.
      aiOfferShown && aiOffer?.kind === 'comeback'
        ? Math.ceil((aiOffer.expiresAt.getTime() - Date.now()) / 3_600_000)
        : null,
    ),
    // 🕌 A Muslim wedding keeps one line of the Nikah essentials (the card moved
    // to /nikah): how many of the four trackable ones are in place. A refused
    // guest read is "—", never "0 of 4".
    nikah: isNikahEvent
      ? nikahStatus(
          guestsMeasured
            ? nikahTrackedDone({
                guests,
                mahrDescription: (event as { mahr_description?: string | null }).mahr_description ?? null,
                imamBooked: nikahImamBooked,
              })
            : null,
        )
      : null,
  });
  const homeTypeLabel = ((event.event_type as string | null) ?? 'wedding')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const homeDateLabel = event.event_date ? formatEventDate(event.event_date as string) || null : null;
  const homeFirstScreen = (
    <HomeFirstScreen
      eventId={eventId}
      cover={{
        eyebrow: homeDateLabel ? `${homeTypeLabel} · ${homeDateLabel}` : homeTypeLabel,
        name: ((event as { display_name?: string | null }).display_name ?? '').trim() || `Your ${homeTypeLabel}`,
      }}
      next={homeNext}
      days={facts.days}
      coming={facts.coming}
      noReply={facts.noReply}
      noReplyWaiting={facts.noReplyWaiting}
      money={facts.money}
      services={homeServiceRow}
    />
  );

  // Home-injected overlays — the cultural / set-date cards that the dashboard
  // doesn't cover. Passed to <EventDashboard> as `slotAfterBento` so they land
  // between the At-a-glance bento and the journey rail.
  /* 🪜 The guided flow's "Round N · x of y · Continue" is no longer a tile
     here: it is first in `HOME_NEXT_ORDER`, so whenever it exists it IS the
     Next card on the first screen (📱 2026-10-01). */
  const overlays = (
    <>
      {/* Set-your-date nudge — date-as-output keeps onboarding's event_date NULL,
       *  but the couple still needs a clear, low-friction way to lock the date
       *  later so the date-gated public website lifecycle (Save-the-Date / Event
       *  / Editorial) can launch. Renders ONLY when no date is set; dismissible
       *  per-event; links to the existing /date-selection governed surface. */}
      {!event.event_date && homeNext.kind !== 'date' ? (
        <SetDateNudge eventId={eventId} eventType={event.event_type as string | null} />
      ) : null}

      {/* "Your free camera is ready" — Papic promotion PR-G option B (owner picked
       *  A + B on 2026-07-30). Every event is armed at creation with a free shared
       *  pool of credits AND one free dedicated camera, and until now the couple was
       *  never told so anywhere on their home. Renders ONLY while nothing has been
       *  shot yet; dismissible per-event; the mini-tile in the bento is the
       *  permanent "where it stands" readout once shooting starts.
       *
       *  ⚠ IT WAITS ITS TURN BEHIND THE SET-DATE NUDGE (owner default, PR-G
       *  question 3). Two stacked bands in one slot read as clutter, and set-date
       *  goes first because the whole date-gated public-site lifecycle waits on
       *  it — so a date-less event is asked for the date, and meets Papic once
       *  that is settled. */}
      {event.event_date && papicNudgeVisible && homeNext.kind !== 'papic' ? (
        <PapicReadyNudge eventId={eventId} />
      ) : null}

      {/* Setnayan AI — the purchase pitch, in one of two states.
       *  • 'comeback': inside the host's one 24h window, at half this event's
       *    own sign-up saving (owner-locked 2026-08-30).
       *  • 'full': the window never opened or has lapsed — same card, list
       *    price, no countdown and no strike-through (owner 2026-08-31).
       *  Last in the sequence: the higher-priority nudges above it (set-date,
       *  Papic) ask for one thing at a time, and this is a purchase pitch, not
       *  a setup step. Absent entirely when the paywall is off or the event
       *  already owns AI. */}
      {aiOffer && aiOfferSettings && !storeShell ? (
        <SetnayanAiComebackOffer
          eventId={eventId}
          displayName={(event as { display_name?: string | null }).display_name ?? null}
          regularPhp={aiOffer.regularPhp}
          comebackPhp={aiOffer.kind === 'comeback' ? aiOffer.comebackPhp : undefined}
          expiresAtIso={
            aiOffer.kind === 'comeback' ? aiOffer.expiresAt.toISOString() : undefined
          }
          settings={aiOfferSettings}
        />
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
    !event.event_date || isChineseEvent || canRecur || Boolean(aiOffer) || papicNudgeVisible;

  return (
    /* 💾 What the host sees here is kept on the phone and shown at once on the
       next open, then refreshed (owner 2026-10-02, DECISION_LOG "LAST-SEEN DATA
       SHOWS INSTANTLY, THEN REFRESHES"). Money never is: the Paid / Still owing
       line, the Budget tile and payment rows carry `data-money` and every peso
       figure is masked (lib/last-seen). A refused guest read is not kept. */
    <LastSeenCapture page="home" fresh={guestsMeasured}>
      {/* 🧭 The event menu's first-visit tour (Stage D, owner 2026-09-29) —
          the five places, once, on Home; waits for the couple welcome. */}
      <MiniTour tourKey="customer_event_menu_v1" storeShell={storeShell} after="couple_welcome_v1" />
      {/* "EVENT DAY SOON" was rendering for a full day AFTER the celebration —
          its own window is T-3d..T+1d and it never asked whether the day had
          been and gone. It is TOLD, from the one resolver, rather than given a
          third opinion of its own. */}
      <EventDayPrepCta eventId={eventId} eventDate={event.event_date} finished={afterActive} />
      {/* Self-hiding: renders nothing unless a coordinator is waiting on an
          answer (owner ruling 2026-07-27 — the host decides what to share). */}
      <AccessRequestsDoorway eventId={eventId} />
      {/* 🗓 "Date change: n of N suppliers answered" — self-hiding: renders
          nothing unless the couple asked booked suppliers to move (owner
          2026-10-01, the clashing-date flow). Couple-only by RLS. */}
      <DateChangeDoorway eventId={eventId} />
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
                saiPreviewParam={search.sai}
                inspectId={search.inspect}
                slotAfterBento={hasOverlays ? overlays : undefined}
                dayOfActive={dayOfActive}
                lifecyclePhase={lifecyclePhase}
                canViewPapicCounts={canViewPapicCounts}
                daysOut={facts.daysOut}
                guestStats={facts.guestStats}
                guardMoney={guardMoney}
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
                saiPreviewParam={search.sai}
                inspectId={search.inspect}
                slotAfterBento={hasOverlays ? overlays : undefined}
                dayOfActive={dayOfActive}
                lifecyclePhase={lifecyclePhase}
                canViewPapicCounts={canViewPapicCounts}
                daysOut={facts.daysOut}
                guestStats={facts.guestStats}
                guardMoney={guardMoney}
              />
            </div>
          </details>
        </>
      ) : (
        /* 📱 THE FIRST SCREEN, AND NOTHING ELSE (owner 2026-10-02, DECISION_LOG
         *  "HOME IS THE FIRST SCREEN ONLY"): Next · Edit your Event Hub · the
         *  numbers · the money line · your services. The old dashboard under it
         *  (the wedding-day / Sai / decisions / schedule / Papic / messages
         *  tiles) is NOT mounted here — it repeated the first screen and drew a
         *  second, wider page. The whole `<EventDashboard>` is mounted only by the
         *  two receded views above (day-of · after the day); here it is drawn only
         *  as `only="whatsnext"`, inside the "What's next" sheet. */
        <>
          {homeFirstScreen}
          {/* 📋 "What's next" — the one row's sheet. Drawn ONLY while `?sheet=next` is in the URL,
              so a Home nobody opens that sheet on never reads the decisions. */}
          {search.sheet === 'next' ? (
            <WhatsNextSheet closeHref={`/dashboard/${eventId}`}>
              <EventDashboard
                eventId={eventId}
                saiPreviewParam={search.sai}
                lifecyclePhase={lifecyclePhase}
                canViewPapicCounts={canViewPapicCounts}
                daysOut={facts.daysOut}
                guestStats={facts.guestStats}
                guardMoney={guardMoney}
                only="whatsnext"
              />
            </WhatsNextSheet>
          ) : null}
        </>
      )}
    </LastSeenCapture>
  );
}
