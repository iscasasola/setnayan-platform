import { redirect } from 'next/navigation';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { NotSharedWithYou } from '../_components/not-shared-with-you';
import { eventNoun } from '@/lib/event-noun';
import { applyDelegateAccessWindow } from '@/lib/delegate-access-window.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { LastSeenCapture } from '@/app/_components/last-seen/last-seen-capture';
import { Plus, Trash2, Eye, EyeOff, MapPin, CalendarClock, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
// ⚠ NOT from './actions'. That module is `'use server'`, and the version there
// ended with `revalidatePath` — which Next.js forbids during a render, so this
// very call 500'd on the first open of every non-wedding schedule. See
// lib/schedule-seed.server.ts.
import { seedNonWeddingRunOfShow } from '@/lib/schedule-seed.server';
import {
  scheduleBlockLabelFor,
  SCHEDULE_BLOCK_TYPES,
  fetchScheduleBlocks,
  fetchScheduleVisibility,
  formatBlockTime,
  formatBlockTimeRange,
  type ScheduleBlockRow,
} from '@/lib/schedule';
import { fetchPreparationAgenda } from '@/lib/preparation';
import { buildJourneyTimeline } from '@/lib/journey';
import { resolveProfile } from '@/lib/event-type-profile';
import { term } from '@/lib/event-term-copy';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  createScheduleBlock,
  deleteScheduleBlock,
  toggleBlockVisibility,
  resolveScheduleSuggestion,
  setBlockPrepVisibility,
  updateScheduleBlock,
  bulkRetimeScheduleBlocks,
  setBlockResponsibleParty,
  loadScheduleTemplate,
} from './actions';
import { isCoordinatorPrepReleaseEnabled } from '@/lib/coordinator-prep-release';
// Inline edit affordance for time/range on existing blocks, per
// CLAUDE.md 2026-05-30 owner directive: "Customer Schedule can be
// edited on the time." Client component owns the view → edit form
// toggle + calls the existing updateScheduleBlock server action.
import { BlockTimeEditor } from './_components/schedule-lazy';
// Preparation ⇄ Event Day toggle (chrome redesign delta #3, 2026-06-03).
// The toggle is a URL-driven segmented control; the agenda is a read-only
// aggregation of EXISTING dated data (payments / paperwork / meetings /
// statutory milestones) — see lib/preparation.ts for the source map.
import { EmceeScriptButton, ScheduleModeToggle } from './_components/schedule-lazy';
import { EmceePicks } from './_components/emcee-picks';
import { HostQuestions } from './_components/host-questions';
// "Tell the host" — the coordinator → emcee channel, on the EVENT side. The
// channel and its send box already shipped, but only inside the supplier floor
// console; the couple's own floor-runner (an aunt, a planner they invited) has
// no supplier account and so could not reach the thing built for her. Same
// table, same INSERT policy, no permission widened.
import { TellTheHost } from './_components/tell-the-host';
import { parseNoteFlash } from './_components/note-flash';
import { PreparationAgendaView } from './_components/preparation-agenda';
// Journey mode — the full event-lifecycle arc (creation → the day →
// editorial), a phase-grouped read-only view over the same agenda data plus
// three lifecycle bookends. See lib/journey.ts.
import { JourneyView } from './_components/journey-view';
import { RunOfShowHeader } from './_components/schedule-lazy';
import type { RunOfShowBlock } from '@/lib/run-of-show';
import { resolveAreaLevel, type ModeratorPermissions } from '@/lib/event-moderators';
// Coordinator P2 — filtered run-of-show. Gated by the Data Privacy board
// control 'coordinator_run_of_show', NOT by an env var. This comment claimed
// NEXT_PUBLIC_SCHEDULE_ROS_P2_ENABLED was the gate; nothing reads it. The
// control is `active` in prod, so these surfaces render today.
import {
  EMPTY_ROS_META,
  fetchBlockRosMeta,
  type RosMetaMap,
} from '@/lib/schedule-ros';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { templatesForEventType } from '@/lib/schedule-templates';
import {
  BulkRetimePanel,
  ResponsiblePartyEditor,
  RosLensBar,
  RosLensPreview,
  TemplatePicker,
  parseRosLens,
  type EventVendorOption,
} from './_components/ros-p2';
// Travel multi-day itineraries (ai-travel-scheduling): hotel night-blocks +
// tour time-blocks + the GRD-06 clash guard. Everything travel-only — a
// non-travel event renders none of it and keeps today's page byte-identical.
import {
  TRAVEL_SCHEDULE_BLOCK_TYPES,
  buildTravelItinerary,
  detectTravelClashes,
  isTravelEventType,
} from '@/lib/schedule-travel';
import { TravelClashGuard, TravelItineraryView } from './_components/travel-itinerary';
import { chatNegotiationEnabled } from '@/lib/chat-negotiation-flag';
import { APPOINTMENT_KINDS } from '@/lib/appointments';
import {
  VendorMeetingsSection,
  type ScheduleMeeting,
} from './_components/vendor-meetings-section';
import { venueNowMs } from '@/lib/schedule';
import { PageMasthead } from '@/app/_components/page-masthead';
import { detailsIsTheDoor } from '@/lib/maker-details-door.server';
import { DETAILS_SCHEDULE_ANNOUNCE_SLOT, DETAILS_SCHEDULE_INSPECTOR_SLOT, detailsDoorHref } from '@/lib/maker-details-items';
import { InSlot } from '../launch/_components/details-piece';
import { formatCount } from '@/lib/format-number';
// ── Schedule rebuild, slice 1 (2026-09-27) ─────────────────────────────────
// The Event Day view becomes the approved prototype's time rail
// (`prototypes/schedule_redesign_2026-09-25.html`); the header gains Announce.
// Every write below still goes through `./actions` and `_actions/day-of-broadcast`.
/* ⚡ The day rail, Announce and the tips load when the Schedule is opened — never
   with the Maker that draws this page (`_components/schedule-lazy.tsx`). */
import { AnnounceButton, ScheduleDay, Tip } from './_components/schedule-lazy';
import type { DayMoment, DayRequest, DayRole } from './_components/day-types';
import { MiniTour } from '@/app/_components/mini-tour';
import {
  BROADCASTS_UNREADABLE,
  fetchLatestBroadcasts,
  isCoordinatorP3Enabled,
  resolveBroadcastAuthority,
} from '@/lib/coordinator-broadcasts-server';
import type { CoordinatorBroadcastItem } from '@/lib/coordinator-broadcasts';
import { getDayOfPhase } from '@/lib/day-of-mode';
import { daysBetween, wallDateKey } from '@/lib/schedule-rail';
import { findBookedHost } from '@/lib/booked-host';
import { fetchEmceeRecipients } from '@/lib/stage-notes-recipients';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Schedule' };

type ScheduleView = 'journey' | 'preparation' | 'event-day';

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    view?: string;
    ros?: string;
    note?: string;
    host_answers?: string;
    /** `1` = drawn as Details › Schedule inside the Event Hub Maker (Details part 2b). */
    maker?: string;
  }>;
};

export default async function CoupleSchedulePage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const {
    view: viewParam,
    ros: rosParam,
    note: noteParam,
    host_answers: hostAnswersFlash,
    maker: makerParam,
  } = await searchParams;
  const inMaker = makerParam === '1';
  // Result of a "Tell the host" send. Anything we did not write ourselves is
  // treated as no flash at all, so a hand-edited URL cannot forge "Sent."
  const noteFlash = parseNoteFlash(noteParam);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* 📦 THE SCHEDULE MOVED INTO THE MAKER'S DETAILS, WHOLE (Details part 2b —
     Story & plans › Schedule). This page is still the one component; for the
     couple of an event with an Event Hub its address now lands there, carrying
     its own query (a view, a lens, a save's flash). Everybody else — a
     coordinator, an event type with no Event Hub — keeps this page as it was. */
  if (!inMaker && (await detailsIsTheDoor(supabase, eventId, user.id))) {
    redirect(detailsDoorHref(eventId, 'schedule', { view: viewParam, ros: rosParam, note: noteParam, host_answers: hostAnswersFlash }));
  }

  // 👥 People with access (owner 2026-10-03): The Day is its own area. A
  // delegate the host set to Off reads no moments (20271262573732 closed the
  // door) — say so, never draw an empty day.
  if (isDelegateWithoutArea(await fetchEventViewer(supabase, eventId, user.id), 'schedule')) {
    return <NotSharedWithYou title="Schedule" thing="schedule" />;
  }

  // Pull the event row (for event_date + ceremony_type that drive the
  // Preparation agenda's statutory-milestone + paperwork-deadline math),
  // the day-of blocks, and the aggregated Preparation agenda in parallel.
  // Defensive maybeSingle — a missing event row falls through to nulls,
  // which the agenda treats as "no wedding date yet".
  const [eventRes, blocks, suggestionsRes, recapRes] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, event_date, event_end_date, ceremony_type, secondary_ceremony_type, event_type, created_at, display_name')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchScheduleBlocks(supabase, eventId),
    // Vendor suggestions queue (feature-access program Phase 3): open
    // proposals from booked vendors, resolved here by the couple or a
    // delegate with schedule edit (RLS-gated).
    supabase
      .from('event_schedule_suggestions')
      .select(
        'suggestion_id, block_id, kind, suggested_by_name, proposed_label, proposed_start_at, proposed_end_at, proposed_location, note, created_at',
      )
      .eq('event_id', eventId)
      .eq('status', 'open')
      // A change or removal whose moment is already gone (the FK is ON DELETE
      // SET NULL since 20271263061583) has nothing left to approve.
      .or('kind.eq.new,block_id.not.is.null')
      .order('created_at', { ascending: true }),
    // Recap publish row — the Journey mode's editorial bookend. RLS lets the
    // couple/coordinator read their own row; a missing table (pre-migration)
    // or absent row both fall through to null (no editorial anchor yet).
    supabase
      .from('event_recaps')
      .select('status, published_at')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);
  const openSuggestions = (suggestionsRes.data ?? []) as VendorSuggestion[];
  const eventRow = eventRes.data as
    | {
        event_id: string;
        event_date: string | null;
        event_end_date: string | null;
        ceremony_type: string | null;
        secondary_ceremony_type: string | null;
        event_type: string | null;
        created_at: string | null;
        display_name: string | null;
      }
    | null;
  const eventDate = eventRow?.event_date ?? null;
  const ceremonyType = eventRow?.ceremony_type ?? null;
  // Travel = the multi-day roaming trip (profile multi_day/roaming, asserted
  // by migration 20270825683668). Gates every itinerary branch below.
  const isTravel = isTravelEventType(eventRow?.event_type ?? null);

  // Run-of-Show first-open seed (owner 2026-07-12: Run-of-Show is FREE). A
  // NON-WEDDING event that opens its schedule with zero blocks gets a per-type
  // Filipino program authored from its captured onboarding signals; weddings keep
  // their own (separate) spine and are untouched. Only pays the seed cost on the
  // first open — once any block exists this branch is skipped, so steady-state
  // schedule loads are unchanged.
  //
  // 🚨 AND THE SEED HANDS THE BLOCKS BACK — DO NOT RE-READ THEM HERE.
  // This used to call `fetchScheduleBlocks` a second time after seeding, and
  // the first open still rendered an empty schedule: Next memoises identical
  // GET requests for one render, so the re-read was served the answer from
  // BEFORE the insert. The host saw "0 blocks" and a plain reload showed five.
  // See the docblock in `lib/schedule-seed.server.ts`.
  let scheduleBlocks = blocks;
  if (
    scheduleBlocks.length === 0 &&
    (eventRow?.event_type ?? 'wedding') !== 'wedding'
  ) {
    scheduleBlocks = await seedNonWeddingRunOfShow(eventId);
  }
  // Iteration 0053 P4 Unit 1: only marriage-profile events get PH statutory
  // milestones in the agenda. Wedding → 'ph_marriage' → statutory true (byte-
  // identical); non-wedding → null → no PSA/CENOMAR/marriage-license rows.
  const profile = await resolveProfile(eventRow?.event_type ?? 'wedding');
  const statutory = profile.statutoryPackKey === 'ph_marriage';

  const now = new Date();
  const agenda = await fetchPreparationAgenda({
    supabase,
    eventId,
    eventDate,
    ceremonyType,
    now,
    statutory,
  });

  // Journey mode — the full event-lifecycle arc. Reuses the agenda for the
  // middle and adds three lifecycle bookends: creation (events.created_at),
  // the day (events.event_date), and the editorial (event_recaps.published_at).
  // The editorial anchor only counts when the recap is actually PUBLISHED —
  // a draft/unpublished row leaves the arc's end as a forward placeholder.
  const recapRow = recapRes.data as { status: string; published_at: string | null } | null;
  const recapPublishedAt =
    recapRow?.status === 'published' ? (recapRow.published_at ?? null) : null;
  const journey = buildJourneyTimeline({
    eventId,
    agenda,
    createdAt: eventRow?.created_at ?? null,
    eventDate,
    recapPublishedAt,
    now,
    copy: {
      dayLabel: term(profile, { wedding: 'your wedding day', generic: 'your event day' }),
      eventNoun: term(profile, { wedding: 'wedding', generic: 'event' }),
    },
  });

  // Coordinator P2 (flag-gated) — the responsible-party meta + the event's
  // vendor registry that feed the filtered run-of-show chrome. Both fetches
  // are SKIPPED entirely while the flag is dark; fetchBlockRosMeta is
  // additionally best-effort (pre-migration → empty map, page unaffected).
  const rosEnabled = await isDataPrivacyControlActive('coordinator_run_of_show');
  let rosMeta: RosMetaMap = EMPTY_ROS_META;
  let rosVendors: EventVendorOption[] = [];
  if (rosEnabled) {
    const [metaRes, vendorsRes] = await Promise.all([
      fetchBlockRosMeta(supabase, eventId),
      supabase
        .from('event_vendors')
        .select('vendor_id, vendor_name')
        .eq('event_id', eventId)
        .order('vendor_name', { ascending: true }),
    ]);
    rosMeta = metaRes;
    rosVendors = (vendorsRes.data ?? []) as EventVendorOption[];
  }
  const rosLens = parseRosLens(rosParam, rosVendors);
  const rosTemplates = rosEnabled
    ? // Both rites: an INC / Muslim / LDS / SDA day (either column) is never
      // offered a cocktail hour or a dance set (`riteIsDanceFree`).
      templatesForEventType(eventRow?.event_type ?? 'wedding', eventRow)
    : [];

  // Coordinator P1 prep-then-release (flag-gated). Only the EXTERNAL coordinator
  // (event_moderators wedding_planner_external) stages/releases — the couple,
  // backfilled as partner1/partner2 moderators, is excluded. visibilityMap is
  // best-effort (pre-migration → empty → everything treated couple_visible), so
  // the page never breaks before the migration lands.
  const prepEnabled = await isCoordinatorPrepReleaseEnabled();
  let isCoordinator = false;
  let stagedBlocks: ScheduleBlockRow[] = [];
  if (prepEnabled) {
    const [modRes, visMap] = await Promise.all([
      supabase
        .from('event_moderators')
        .select('moderator_id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .eq('role_subtype', 'wedding_planner_external')
        .not('accepted_at', 'is', null)
        .is('removed_at', null)
        .maybeSingle(),
      fetchScheduleVisibility(supabase, eventId),
    ]);
    isCoordinator = !!modRes.data;
    if (isCoordinator) {
      stagedBlocks = scheduleBlocks.filter(
        (b) => visMap.get(b.block_id)?.visibility === 'coordinator_only',
      );
    }
  }
  const canPrep = prepEnabled && isCoordinator;

  // Resolve the active view. Explicit `?view=` wins (bookmarkable). With no
  // param, default to Preparation when there's something to prepare; else
  // open straight on the day-of timeline so empty-prep couples aren't met
  // with a blank agenda. (Journey is opt-in via its segment — it never
  // becomes the silent default, to keep the existing landing behavior.)
  const active: ScheduleView =
    viewParam === 'journey' || viewParam === 'preparation' || viewParam === 'event-day'
      ? viewParam
      : /* In the Event Hub Maker (Details › Schedule) the page opens on the day
           itself — the moments guests see, the ones a tap on a stage selects. */
        inMaker
        ? 'event-day'
        : agenda.items.length > 0
        ? 'preparation'
        : 'event-day';

  // Run-of-show advance permission, derived server-side (was hardcoded true —
  // a view-only delegate admitted by the layout saw the button and got a 42501
  // from the RPC on tap). Mirrors the widened advance_schedule_block gate
  // (migration 20270917100000): any event_members row (current_event_ids) OR a
  // delegate whose permission grid resolves schedule:'edit' (the coordinator
  // the owner directive admits). Both reads are the caller's own rows (RLS-
  // safe); errors degrade to "no button", never a crash.
  const [advMemberRes, advDelegateRes] = await Promise.all([
    supabase
      .from('event_members')
      // `user_id`, not `member_type`: the comment above states the rule is ANY
      // event_members row, and the type was requested and never compared — the
      // shape `host-means-host.test.ts` sweeps for. Behaviour is unchanged.
      .select('user_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);
  // The access window (owner 2026-09-14): a delegate seven days past the event
  // is not a coordinator any more. An event_members row is the couple/host and
  // never expires, which is why it stays the first arm of this `||`.
  const advDelegatePermissions = await applyDelegateAccessWindow(
    supabase,
    eventId,
    (advDelegateRes.data?.permissions_json ?? null) as ModeratorPermissions | null,
    Boolean(advMemberRes.data),
  );
  const canAdvanceRunOfShow =
    Boolean(advMemberRes.data) ||
    resolveAreaLevel(advDelegatePermissions, 'schedule') === 'edit';

  // Run-of-show header rows (now/next/±N) off the shared run-state. Top-level
  // blocks only — the header tracks the headline timeline, not sub-parts.
  const runOfShowBlocks: RunOfShowBlock[] = scheduleBlocks
    .filter((b) => b.parent_block_id === null)
    .map((b) => ({
      block_id: b.block_id,
      label: b.label,
      start_at: b.start_at,
      end_at: b.end_at,
      location: b.location,
      run_state: b.run_state,
      actual_start_at: b.actual_start_at,
    }));

  // Vendor meetings on the schedule (negotiation → schedule integration).
  // Read-only surface of proposed/confirmed event_appointments so an approve /
  // new-time / decline in chat reflects here automatically. Flag-gated (dark
  // until negotiations launch). RLS lets the couple read their event's rows.
  let vendorMeetings: ScheduleMeeting[] = [];
  if (chatNegotiationEnabled()) {
    const { data: apptRows, error: apptRowsError } = await supabase
      .from('event_appointments')
      .select(
        'appointment_id, kind, custom_label, scheduled_at, status, vendor_profile_id, thread_id',
      )
      .eq('event_id', eventId)
      .in('status', ['proposed', 'confirmed'])
      .order('scheduled_at', { ascending: true, nullsFirst: false });
    // ⚠ APPOINTMENTS the couple booked. Refused, the schedule reads as empty and a
    // ⚠ booked meeting vanishes from the day it belongs to.
    if (apptRowsError) {
      logQueryError('SchedulePage.apptRows', apptRowsError, { eventId }, 'graceful_degrade');
    }
    const rows = (apptRows ?? []) as Array<{
      appointment_id: string;
      kind: string;
      custom_label: string | null;
      scheduled_at: string | null;
      status: 'proposed' | 'confirmed';
      vendor_profile_id: string | null;
      thread_id: string | null;
    }>;
    const vpIds = Array.from(
      new Set(rows.map((r) => r.vendor_profile_id).filter((v): v is string => Boolean(v))),
    );
    const nameByVp = new Map<string, string>();
    if (vpIds.length > 0) {
      const { data: vps, error: vpsError } = await supabase
        .from('vendor_profiles')
        .select('vendor_profile_id, business_name')
        .in('vendor_profile_id', vpIds);
      // ⚠ the supplier names on those appointments. Refused, each reads as unnamed.
      if (vpsError) {
        logQueryError('SchedulePage.vps', vpsError, { eventId }, 'graceful_degrade');
      }
      for (const v of (vps ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>)
        nameByVp.set(v.vendor_profile_id, (v.business_name ?? '').trim() || 'a supplier');
    }
    vendorMeetings = rows.map((r) => ({
      appointment_id: r.appointment_id,
      kind: (APPOINTMENT_KINDS as readonly string[]).includes(r.kind)
        ? (r.kind as ScheduleMeeting['kind'])
        : 'video',
      label: r.custom_label?.trim() || 'Meeting',
      scheduled_at: r.scheduled_at,
      status: r.status,
      vendorName: r.vendor_profile_id ? nameByVp.get(r.vendor_profile_id) ?? 'a supplier' : 'a supplier',
      threadId: r.thread_id ?? null,
    }));
  }

  // ── Schedule rebuild slice 1 — who may change it, the day, Announce ──────
  //
  // WHO EDITS: the couple (host), or a delegate the couple approved with
  // `schedule: 'edit'` inside the access window. `resolveBroadcastAuthority` is
  // that exact rule — the same pair the `event_schedule_blocks` write policies
  // and the `coordinator_broadcasts` INSERT policies admit — so one answer
  // gates both the rail's edit controls and Announce, and neither can show a
  // control the database will refuse. Owner 2026-09-25: *"setting up the
  // schedule can be done by hosts of the event and coordinator(upon approval)"*.
  const [authority, announceEnabled] = await Promise.all([
    resolveBroadcastAuthority(supabase, eventId, user.id),
    isCoordinatorP3Enabled(),
  ]);
  const dayRole: DayRole = authority.canSend
    ? authority.role === 'couple'
      ? 'host'
      : 'coordinator'
    : 'view';
  const canAnnounce = authority.canSend && announceEnabled;
  // `null` = the read was refused — the sheet says so rather than "nothing yet".
  let recentAnnouncements: CoordinatorBroadcastItem[] | null = [];
  if (canAnnounce) {
    const read = await fetchLatestBroadcasts(supabase, eventId);
    recentAnnouncements = read === BROADCASTS_UNREADABLE ? null : read;
  }

  // The live run-of-show strip is drawn ON THE DAY only (prototype: "one live
  // strip on the day"); before it the page is for planning.
  const isEventDay = eventDate ? getDayOfPhase(eventDate) === 'live' : false;
  const eventDateKey = eventDate ? eventDate.slice(0, 10) : null;
  const venueTodayKey = wallDateKey(new Date(venueNowMs()).toISOString());
  const daysToGo = eventDateKey ? daysBetween(venueTodayKey, eventDateKey) : null;
  const dateLabel = eventDateKey
    ? new Date(`${eventDateKey}T00:00:00Z`).toLocaleDateString('en-GB', {
        timeZone: 'UTC',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  // The host / MC tool shows only when a host is booked. Two lookups, UNION:
  // `findBookedHost` is what the segments and questions use, and
  // `fetchEmceeRecipients` is what "Tell the host" uses (it can see a booked but
  // unpublished shop). Taking either keeps a tool that any of the three would
  // fill — hiding it on one lookup's "no" would delete the other two's content.
  let hasHost = false;
  if (!isTravel) {
    const lookup = await findBookedHost(supabase, eventId, 'SchedulePage.hostTool');
    hasHost = lookup.state !== 'none';
    if (!hasHost && canAdvanceRunOfShow) {
      hasHost = (await fetchEmceeRecipients(supabase, eventId, createAdminClient())).length > 0;
    }
  }

  // The rail's moments — the master rows, with the responsible-party meta and
  // the coordinator's staging flattened on (a Map cannot cross to the client).
  const stagedIds = new Set(stagedBlocks.map((b) => b.block_id));
  const dayMoments: DayMoment[] = scheduleBlocks.map((b) => ({
    block_id: b.block_id,
    label: b.label,
    block_type: b.block_type,
    start_at: b.start_at,
    end_at: b.end_at,
    location: b.location,
    notes: b.notes,
    is_public: b.is_public,
    parent_block_id: b.parent_block_id,
    run_state: b.run_state,
    staged: stagedIds.has(b.block_id),
    responsible_party: rosMeta.get(b.block_id)?.responsible_party ?? null,
    responsible_vendor_ids: rosMeta.get(b.block_id)?.responsible_vendor_ids ?? [],
    audience: b.audience ?? null,
  }));
  const dayRequests: DayRequest[] = openSuggestions.map((s) => ({
    suggestion_id: s.suggestion_id,
    block_id: s.block_id,
    kind: s.kind,
    by: s.suggested_by_name?.trim() || 'A booked supplier',
    proposed_label: s.proposed_label,
    proposed_start_at: s.proposed_start_at,
    proposed_end_at: s.proposed_end_at,
    proposed_location: s.proposed_location,
    note: s.note,
  }));

  const roleLabel =
    dayRole === 'host'
      ? 'You can edit'
      : dayRole === 'coordinator'
        ? 'You can edit · coordinator'
        : 'View only';
  const viewNote =
    active === 'journey'
      ? term(profile, {
          wedding:
            'The whole arc of your wedding — from the day you started planning, through every dated step, to the big day and the editorial you publish afterward.',
          generic:
            'The whole arc of your event — from the day you started planning, through every dated step, to the day itself and the editorial you publish afterward.',
        })
      : active === 'preparation'
        ? 'Every dated step still ahead — gathered from your payments, paperwork and supplier meetings, sorted by month. Tap an item to manage it where it lives.'
        : 'Moments shown to guests appear on the Event Hub, with a live “happening now” on the day. Hidden moments stay between you, your coordinator and the suppliers you tag.';

  return (
    /* 💾 The schedule is kept on the phone and shown at once on the next
       open, then refreshed (owner 2026-10-02, DECISION_LOG "LAST-SEEN DATA
       SHOWS INSTANTLY, THEN REFRESHES"). Payment due dates carry `data-money`
       and are never kept (lib/last-seen). Not inside the Maker (`?maker=1`). */
    <LastSeenCapture page="schedule">
    <section className="sn-col space-y-5">
      {/* Inside the Maker, Details' own header names it. */}
      {inMaker ? null : <PageMasthead title="Schedule" />}

      {/* ONE LINE AND AN ⓘ — the paragraph that opened this page is gone
          ("SCHEDULE (event-day view) JOINS THE PAGE REDESIGN": intro paragraph
          → one line + ⓘ). Who, when, how long to go, and whether you can edit. */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-sm text-ink/60">
            {eventRow?.display_name?.trim() ? (
              <b className="font-semibold text-ink/85">{eventRow.display_name.trim()}</b>
            ) : null}
            {eventRow?.display_name?.trim() && dateLabel ? ' · ' : null}
            {dateLabel}
            {daysToGo !== null && daysToGo > 0 && !isEventDay ? (
              <>
                {' · '}
                <b className="font-semibold text-ink/85">{daysToGo}</b> day{daysToGo === 1 ? '' : 's'} to go
              </>
            ) : null}
          </p>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink/[0.05] pl-2.5 pr-1 text-[11.5px] font-semibold text-ink/65">
            <i
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${dayRole === 'view' ? 'bg-ink/35' : 'bg-success-600'}`}
            />
            {roleLabel}
            <Tip>
              Hosts build the schedule. A coordinator edits only after a host approves them — the host
              invite plus your consent under the Data Privacy Act (RA 10173). Everyone else reads.
            </Tip>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScheduleModeToggle
            active={active}
            prepCount={agenda.items.length}
            journeyCount={journey.totalEntries}
          />
          <span className="ml-auto flex items-center gap-2">
            <Tip align="end">{viewNote}</Tip>
            {canAnnounce ? (
              /* In the Maker's Details, Announce is a piece of the Schedule: its
                 button (and its sheet) sit in the right column (`InSlot`). */
              <InSlot id={inMaker ? DETAILS_SCHEDULE_ANNOUNCE_SLOT : null}>
                <AnnounceButton
                  eventId={eventId}
                  isEventDay={isEventDay}
                  recent={recentAnnouncements}
                />
              </InSlot>
            ) : null}
          </span>
        </div>
      </header>

      {active !== 'event-day' ? (
        <VendorMeetingsSection eventId={eventId} meetings={vendorMeetings} />
      ) : null}

      {active === 'journey' ? (
        <JourneyView
          timeline={journey}
          hasEventDate={eventDate !== null}
          eventId={eventId}
        />
      ) : active === 'preparation' ? (
        <PreparationAgendaView
          eventId={eventId}
          agenda={agenda}
          hasEventDate={eventDate !== null}
          eventWord={eventNoun(eventRow?.event_type)}
        />
      ) : isTravel ? (
        // A TRIP KEEPS ITS OWN VIEW. Hotel nights run from one afternoon to the
        // next morning and tours carry a clash guard; drawn on a one-day rail
        // they would be twenty-hour bars. The travel list, the day-by-day lens
        // and the GRD-06 guard are unchanged — only non-travel events get the rail.
        <>
          {/* Run-of-show header — live now/next/±N driven by the shared
              run-state. The couple/host (and a delegate coordinator with
              schedule:edit — RPC gate widened by migration 20270917100000)
              advance it via the single-winner advance_schedule_block RPC. */}
          {runOfShowBlocks.length > 0 ? (
            <RunOfShowHeader
              eventId={eventId}
              initial={runOfShowBlocks}
              canAdvance={canAdvanceRunOfShow}
            />
          ) : null}
          {/* Travel-only itinerary chrome: the GRD-06 clash guard (overlapping
              tours + uncovered nights) and the day-by-day trip lens over the
              same master blocks. Non-travel events skip both entirely. */}
          {isTravel ? (
            <>
              <TravelClashGuard
                clashes={detectTravelClashes(scheduleBlocks, {
                  tripStart: eventDate,
                  tripEnd: eventRow?.event_end_date ?? null,
                })}
              />
              <TravelItineraryView
                itinerary={buildTravelItinerary(scheduleBlocks, {
                  tripStart: eventDate,
                  tripEnd: eventRow?.event_end_date ?? null,
                })}
              />
            </>
          ) : null}
          <VendorSuggestionsQueue
            eventId={eventId}
            suggestions={openSuggestions}
            blocks={scheduleBlocks}
          />
          {/* The host's own segments — their catalogue, ticked by the couple and
           *  dropped onto this timeline. Renders NOTHING when there is no booked
           *  host/MC or they have written no segments, so a couple without one
           *  never sees an empty menu. Sits directly above the emcee script,
           *  because picking and reading the resulting script are the same job.
           *  Placement logic is pure in lib/vendor-activities. */}
          <EmceePicks supabase={supabase} eventId={eventId} />
          {/* DAY-7 · what only the couple can tell the host — above all how to
           *  say the names he reads out. Renders nothing unless their booked
           *  host asks something. Spec: Emcee_Script_System_BUILD_SPEC § 8. */}
          <HostQuestions supabase={supabase} eventId={eventId} flash={hostAnswersFlash} />
          {/* A line to the host, mid-service. Sits with the host's own section
           *  because a note is nearly always "change what happens next".
           *  `canSend` is deliberately the SAME value as the run-of-show
           *  advance gate: `event_stage_notes_event_insert` admits exactly the
           *  people that gate admits — the couple, and a delegate holding
           *  schedule:'edit'. Reusing the value is what stops the screen and
           *  the policy drifting apart into a button that 42501s on tap. */}
          <TellTheHost
            supabase={supabase}
            eventId={eventId}
            canSend={canAdvanceRunOfShow}
            flash={noteFlash}
          />
          {/* Emcee script — compiles this timeline + the wedding-party names
           *  into a clean host script (copy / download). Read-only over the
           *  saved program; pure compiler in lib/emcee-script. */}
          {scheduleBlocks.length > 0 ? (
            <div className="sn-row flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <p className="text-sm text-ink/65">
                Turn this timeline into a ready-to-read emcee / host script.
              </p>
              <EmceeScriptButton eventId={eventId} />
            </div>
          ) : null}
          {/* Coordinator P1 prep-then-release — the coordinator's staged blocks
              (hidden from the couple until released). Flag + coordinator gated;
              renders nothing for the couple or when nothing is staged. */}
          {canPrep && stagedBlocks.length > 0 ? (
            <div className="sn-row space-y-3 p-4">
              <div className="flex items-center gap-2">
                <EyeOff aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
                <p className="text-sm font-semibold text-ink">
                  Staged — hidden from the couple ({stagedBlocks.length})
                </p>
              </div>
              <p className="text-xs text-ink/55">
                Only you can see these. Release a block to add it to the couple&rsquo;s schedule.
              </p>
              <ul className="divide-y divide-ink/10">
                {stagedBlocks.map((b) => (
                  <li
                    key={b.block_id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{b.label}</p>
                      <p className="truncate font-mono text-xs text-ink/55">
                        {b.end_at
                          ? formatBlockTimeRange(b.start_at, b.end_at)
                          : formatBlockTime(b.start_at)}
                      </p>
                    </div>
                    <form action={setBlockPrepVisibility}>
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="block_id" value={b.block_id} />
                      <input type="hidden" name="visibility" value="couple_visible" />
                      <SubmitButton
                        pendingLabel="Releasing…"
                        className="inline-flex items-center gap-1.5 rounded-md bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-800"
                      >
                        <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        Release to couple
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* Coordinator P2 chrome — filtered views, templates, bulk retime.
              All of it flag-gated; flag-off renders none of these branches. */}
          {rosEnabled && scheduleBlocks.length === 0 && rosTemplates.length > 0 ? (
            <TemplatePicker eventId={eventId} templates={rosTemplates} />
          ) : null}
          {rosEnabled && scheduleBlocks.length > 0 ? (
            <RosLensBar
              eventId={eventId}
              lens={rosLens}
              blocks={scheduleBlocks}
              vendors={rosVendors}
              meta={rosMeta}
            />
          ) : null}
          {rosEnabled && rosLens.kind !== 'all' ? (
            <RosLensPreview lens={rosLens} blocks={scheduleBlocks} meta={rosMeta} />
          ) : (
            <>
              {rosEnabled && scheduleBlocks.length > 0 ? (
                <BulkRetimePanel eventId={eventId} blocks={scheduleBlocks} />
              ) : null}
              <EventDayView
                eventId={eventId}
                blocks={scheduleBlocks}
                isTravel={isTravel}
                rosEnabled={rosEnabled}
                rosMeta={rosMeta}
                rosVendors={rosVendors}
                canPrep={canPrep}
                eventType={eventRow?.event_type ?? null}
              />
            </>
          )}
        </>
      ) : (
        <>
          {isEventDay && runOfShowBlocks.length > 0 ? (
            <RunOfShowHeader
              eventId={eventId}
              initial={runOfShowBlocks}
              canAdvance={canAdvanceRunOfShow}
              variant="strip"
            />
          ) : null}
          <ScheduleDay
            inspectorSlot={inMaker ? DETAILS_SCHEDULE_INSPECTOR_SLOT : null}
            actions={{
              updateScheduleBlock,
              bulkRetimeScheduleBlocks,
              createScheduleBlock,
              deleteScheduleBlock,
              toggleBlockVisibility,
              setBlockResponsibleParty,
              setBlockPrepVisibility,
              loadScheduleTemplate,
              resolveScheduleSuggestion,
            }}
            eventId={eventId}
            eventType={eventRow?.event_type ?? null}
            eventDateKey={eventDateKey}
            moments={dayMoments}
            requests={dayRequests}
            suppliers={rosVendors}
            role={dayRole}
            canStage={canPrep}
            rosEnabled={rosEnabled}
            templates={
              scheduleBlocks.length === 0
                ? rosTemplates.map((t) => ({
                    id: t.id,
                    label: t.label,
                    description: t.description,
                    count: t.rows.length,
                  }))
                : []
            }
            isEventDay={isEventDay}
            daysToGo={daysToGo}
            emcee={
              <EmceeScriptButton
                eventId={eventId}
                coupleName={eventRow?.display_name ?? null}
                variant="icon"
              />
            }
            hostPanel={
              hasHost ? (
                <>
                  <p className="text-[13px] text-ink/60">
                    Your booked host&rsquo;s segments, their questions for you, and a line to them
                    mid-service.
                  </p>
                  <EmceePicks supabase={supabase} eventId={eventId} />
                  <HostQuestions supabase={supabase} eventId={eventId} flash={hostAnswersFlash} />
                  <TellTheHost
                    supabase={supabase}
                    eventId={eventId}
                    canSend={canAdvanceRunOfShow}
                    flash={noteFlash}
                  />
                </>
              ) : null
            }
          />
        </>
      )}

      {/* Every feature gets a first-visit tour (owner 2026-09-25) — the shipped
          MiniTour, keyed once per person. */}
      <MiniTour tourKey="customer_schedule_v1" />
    </section>
    </LastSeenCapture>
  );
}

type VendorSuggestion = {
  suggestion_id: string;
  block_id: string | null;
  kind: 'adjust' | 'new' | 'remove';
  suggested_by_name: string | null;
  proposed_label: string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposed_location: string | null;
  note: string;
  created_at: string;
};

function fmtSuggestionTime(iso: string | null): string | null {
  if (!iso) return null;
  // ⏱ Venue wall clock in a UTC column — read its digits (`timeZone: 'UTC'`).
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Open vendor proposals on the day-of timeline (feature-access program
 * Phase 3 § 4). Vendors can't write the timeline — they propose; you (or a
 * delegate with schedule edit) accept or decline. Accepting an 'adjust'
 * applies the proposed fields to the block; accepting a 'new' creates the
 * block as a draft (is_public stays your call); accepting a 'remove' deletes
 * the block.
 */
function VendorSuggestionsQueue({
  eventId,
  suggestions,
  blocks,
}: {
  eventId: string;
  suggestions: VendorSuggestion[];
  blocks: { block_id: string; label: string }[];
}) {
  if (suggestions.length === 0) return null;
  const blockLabel = new Map(blocks.map((b) => [b.block_id, b.label]));
  return (
    <section className="space-y-3 rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          Supplier requests · {suggestions.length}
        </p>
        <p className="max-w-prose text-sm text-ink/65">
          Your booked suppliers asked for timeline changes. Accepting applies the
          change; suppliers never edit your timeline directly.
        </p>
      </header>
      <ul className="divide-y divide-ink/10">
        {suggestions.map((s) => {
          const proposedWindow = [
            fmtSuggestionTime(s.proposed_start_at),
            fmtSuggestionTime(s.proposed_end_at),
          ]
            .filter(Boolean)
            .join(' – ');
          return (
            <li key={s.suggestion_id} className="space-y-1.5 py-3">
              <p className="text-sm">
                <span className="font-medium">{s.suggested_by_name ?? 'A booked supplier'}</span>{' '}
                {s.kind === 'remove' ? (
                  <>
                    asks to remove{' '}
                    <span className="font-medium">
                      {blockLabel.get(s.block_id ?? '') ?? s.proposed_label ?? 'a timeline block'}
                    </span>
                  </>
                ) : s.kind === 'adjust' ? (
                  <>
                    asks to change{' '}
                    <span className="font-medium">
                      {blockLabel.get(s.block_id ?? '') ?? 'a timeline block'}
                    </span>
                  </>
                ) : (
                  <>
                    suggests adding{' '}
                    <span className="font-medium">{s.proposed_label ?? 'a new entry'}</span>
                  </>
                )}
              </p>
              <p className="text-sm text-ink/70">&ldquo;{s.note}&rdquo;</p>
              {proposedWindow ? (
                <p className="text-xs text-ink/55">Proposed time: {proposedWindow}</p>
              ) : null}
              {s.proposed_location ? (
                <p className="text-xs text-ink/55">Location: {s.proposed_location}</p>
              ) : null}
              <div className="flex items-center gap-2 pt-0.5">
                <form action={resolveScheduleSuggestion}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="suggestion_id" value={s.suggestion_id} />
                  <input type="hidden" name="decision" value="accept" />
                  <SubmitButton pendingLabel="Accepting…" className="rounded-md bg-ink px-3 py-1 text-xs font-semibold text-cream hover:bg-ink/85">Accept</SubmitButton>
                </form>
                <form action={resolveScheduleSuggestion}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="suggestion_id" value={s.suggestion_id} />
                  <input type="hidden" name="decision" value="decline" />
                  <SubmitButton pendingLabel="Declining…" className="rounded-md border border-ink/20 px-3 py-1 text-xs font-medium text-ink/70 hover:bg-ink/5">Decline</SubmitButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Event Day mode — the existing editable day-of timeline. Behavior is
 * unchanged from before the Preparation toggle landed: the add-block form,
 * the per-block cards with inline time editing + visibility toggle +
 * delete, and the empty state all render exactly as they did.
 */
function EventDayView({
  eventId,
  blocks,
  isTravel = false,
  rosEnabled = false,
  rosMeta = EMPTY_ROS_META,
  rosVendors = [],
  canPrep = false,
  eventType = null,
}: {
  eventId: string;
  blocks: ScheduleBlockRow[];
  isTravel?: boolean;
  rosEnabled?: boolean;
  rosMeta?: RosMetaMap;
  rosVendors?: EventVendorOption[];
  canPrep?: boolean;
  /** events.event_type — a birthday's arrival block is not "Pre-ceremony". */
  eventType?: string | null;
}) {
  const publicCount = blocks.filter((b) => b.is_public).length;
  // "Next up" (Glass PR-3 §3.1) — the imminent block: the first one that hasn't
  // started yet, else the first block. Real data; drives both the glass strip
  // and the gold accent on its row in the timeline below.
  const now = venueNowMs(); // the venue's clock — start_at is its wall clock
  const nextBlock =
    blocks.find((b) => new Date(b.start_at).getTime() >= now) ?? blocks[0] ?? null;
  return (
    <div className="space-y-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
        {blocks.length} block{blocks.length === 1 ? '' : 's'} · {formatCount(publicCount)} public
      </p>

      {/* Next-up glass strip — the imminent block, mono time. */}
      {nextBlock ? (
        <div className="sn-tile sn-reveal flex flex-wrap items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
            style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
          >
            <CalendarClock className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="sn-eye">Next up</p>
            <p className="mt-0.5 truncate text-base font-bold text-ink">
              {nextBlock.label}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-ink/60">
              {nextBlock.end_at
                ? formatBlockTimeRange(nextBlock.start_at, nextBlock.end_at)
                : formatBlockTime(nextBlock.start_at)}
              {nextBlock.location ? ` · ${nextBlock.location}` : ''}
            </p>
          </div>
        </div>
      ) : null}

      <AddBlockForm eventId={eventId} isTravel={isTravel} canPrep={canPrep} eventType={eventType} />

      {blocks.length === 0 ? (
        <div className="sn-row border-dashed p-8 text-center">
          <CalendarClock
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-ink">No blocks yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            {isTravel
              ? 'Add your first one above — a hotel stay covers its nights (check-in to check-out), and each tour or activity takes a time slot on the trip.'
              : 'Add your first one above — start with the ceremony, then layer cocktails, reception, dinner, dancing, and send-off.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {blocks.map((b) => (
            <li key={b.block_id}>
              <BlockCard
                eventId={eventId}
                block={b}
                imminent={nextBlock?.block_id === b.block_id}
                rosEnabled={rosEnabled}
                rosMeta={rosMeta}
                rosVendors={rosVendors}
                eventType={eventType}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddBlockForm({
  eventId,
  isTravel = false,
  canPrep = false,
  eventType = null,
}: {
  eventId: string;
  isTravel?: boolean;
  canPrep?: boolean;
  eventType?: string | null;
}) {
  // Travel gets the trip-shaped menu (hotel night-blocks + tour time-blocks
  // first); every other event type keeps today's list exactly.
  const typeOptions = isTravel ? TRAVEL_SCHEDULE_BLOCK_TYPES : SCHEDULE_BLOCK_TYPES;
  return (
    <details className="sn-row">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
        <Plus aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Add a block
      </summary>
      <form
        action={createScheduleBlock}
        className="grid gap-4 border-t border-ink/10 p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">Label</span>
          <input
            name="label"
            required
            maxLength={120}
            placeholder={
              isTravel ? 'e.g. Island-hopping tour, El Nido' : 'e.g. Ceremony at San Agustin'
            }
            className="input-field"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">Type</span>
          <select name="block_type" defaultValue="custom" className="input-field">
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {scheduleBlockLabelFor(t, eventType)}
              </option>
            ))}
          </select>
          {isTravel ? (
            <span className="block text-[11px] text-ink/50">
              A hotel stay spans check-in → check-out; tours can&rsquo;t overlap
              each other.
            </span>
          ) : null}
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">
            {isTravel ? 'Starts / check-in' : 'Starts'}
          </span>
          <input
            name="start_at"
            type="datetime-local"
            required
            className="input-field"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-ink">
            {isTravel ? 'Ends / check-out (optional)' : 'Ends (optional)'}
          </span>
          <input name="end_at" type="datetime-local" className="input-field" />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="block text-xs font-medium text-ink">Location</span>
          <input
            name="location"
            maxLength={200}
            placeholder="e.g. San Agustin Church, Intramuros"
            className="input-field"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="block text-xs font-medium text-ink">Notes</span>
          <textarea
            name="notes"
            rows={3}
            className="input-field min-h-[80px] py-2"
            placeholder="Dress code, parking notes, anything guests should know"
          />
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="is_public"
            defaultChecked
            className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
          />
          <span>
            <span className="block font-medium text-ink">Show to guests</span>
            <span className="block text-xs text-ink/55">
              When on, this block appears on every guest&rsquo;s invitation site.
            </span>
          </span>
        </label>
        {canPrep ? (
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="prep"
              className="mt-0.5 h-4 w-4 cursor-pointer accent-terracotta"
            />
            <span>
              <span className="block font-medium text-ink">
                Start hidden from the couple (prep)
              </span>
              <span className="block text-xs text-ink/55">
                Staged so only you can see it — release it to the couple when it&rsquo;s ready.
              </span>
            </span>
          </label>
        ) : null}
        <div className="sm:col-span-2">
          <SubmitButton className="button-primary" pendingLabel="Adding…">
            Add block
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}

function BlockCard({
  eventId,
  block,
  imminent = false,
  rosEnabled = false,
  rosMeta = EMPTY_ROS_META,
  rosVendors = [],
  eventType = null,
}: {
  eventId: string;
  block: ScheduleBlockRow;
  imminent?: boolean;
  rosEnabled?: boolean;
  rosMeta?: RosMetaMap;
  rosVendors?: EventVendorOption[];
  eventType?: string | null;
}) {
  // Pre-format the time/range string the same way the prior static
  // surface did, then hand off to the BlockTimeEditor client component
  // which owns the view→edit toggle. Keeps the SCHEDULE_BLOCK_LABEL +
  // formatting helpers on the server side; the client only handles
  // interaction.
  const viewLabel = block.end_at
    ? formatBlockTimeRange(block.start_at, block.end_at)
    : formatBlockTime(block.start_at);
  return (
    <article
      className="sn-row space-y-3 p-4"
      style={
        imminent
          ? { borderLeft: '3px solid var(--sn-gold-500)' }
          : undefined
      }
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-base font-semibold text-ink">{block.label}</h2>
          <BlockTimeEditor
            eventId={eventId}
            blockId={block.block_id}
            blockTypeLabel={scheduleBlockLabelFor(block.block_type, eventType)}
            startAt={block.start_at}
            endAt={block.end_at}
            viewLabel={viewLabel}
          />
        </div>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
            block.is_public
              ? 'bg-success-100 text-success-800'
              : 'bg-ink/5 text-ink/55'
          }`}
        >
          {block.is_public ? 'Public' : 'Hidden'}
        </span>
      </header>

      {block.location ? (
        <p className="inline-flex items-center gap-1 text-sm text-ink/65">
          <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {block.location}
        </p>
      ) : null}

      {block.notes ? (
        <p className="rounded-md bg-ink/[0.03] p-3 text-xs text-ink/75 whitespace-pre-wrap">
          {block.notes}
        </p>
      ) : null}

      {/* Coordinator P2 — per-row responsible party (vendor / crew / family)
          + vendor tagging that drives the per-vendor filtered slice. */}
      {rosEnabled ? (
        <ResponsiblePartyEditor
          eventId={eventId}
          block={block}
          meta={rosMeta}
          vendors={rosVendors}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
        <form action={toggleBlockVisibility}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="block_id" value={block.block_id} />
          <input
            type="hidden"
            name="desired"
            value={block.is_public ? 'false' : 'true'}
          />
          <SubmitButton
            className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
            pendingLabel="…"
          >
            {block.is_public ? (
              <>
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                Hide from guests
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                Show to guests
              </>
            )}
          </SubmitButton>
        </form>
        <form action={deleteScheduleBlock}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="block_id" value={block.block_id} />
          <SubmitButton
            aria-label="Delete block"
            pendingLabel=""
            className="rounded-md p-1.5 text-ink/40 hover:bg-ink/5 hover:text-danger-700 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}
