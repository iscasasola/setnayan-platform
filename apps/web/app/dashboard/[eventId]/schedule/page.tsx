import { redirect } from 'next/navigation';
import { ReadRefusedNotice } from '@/app/dashboard/[eventId]/_components/read-refused-notice';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { ensureChecklistSeeded } from '../checklist-actions';
import { fetchEventViewer, isDelegateWithoutArea, viewerAreaLevel } from '@/lib/event-viewer.server';
import { NotSharedWithYou } from '../_components/not-shared-with-you';
import { eventNoun } from '@/lib/event-noun';
import { applyDelegateAccessWindow } from '@/lib/delegate-access-window.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { TimelineReadProblem } from '@/app/_components/timeline-read-problem';
import { LastSeenCapture } from '@/app/_components/last-seen/last-seen-capture';
import { Plus, Eye, EyeOff, MapPin, CalendarClock, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
// ⚠ NOT from './actions'. That module is `'use server'`, and the version there
// ended with `revalidatePath` — which Next.js forbids during a render, so this
// very call 500'd on the first open of every non-wedding schedule. See
// lib/schedule-seed.server.ts.
import { seedDefaultChapters, seedNonWeddingRunOfShow } from '@/lib/schedule-seed.server';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { isOnEveryChapter, pickedOf, whereChaptersFrom, whereNames } from '@/lib/supplier-where';
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
import { forwardScheduleView, type ScheduleView } from '@/lib/schedule-view';
import { resolveProfile } from '@/lib/event-type-profile';
import { SCHEDULE_TOOLS_SLOT } from './_components/schedule-tools-slot';
import { term } from '@/lib/event-term-copy';
import { SubmitButton } from '@/app/_components/submit-button';
import { RequestDecision } from './_components/request-decision';
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
import { OFFLINE_COPY_UNREAD, coordinatorSchedulePath, copyVersionOf } from '@/lib/offline-copies';
// Inline edit affordance for time/range on existing blocks, per
// CLAUDE.md 2026-05-30 owner directive: "Customer Schedule can be
// edited on the time." Client component owns the view → edit form
// toggle + calls the existing updateScheduleBlock server action.
import { BlockTimeEditor } from './_components/schedule-lazy';
// Preparation ⇄ Event Day toggle (chrome redesign delta #3, 2026-06-03).
// The toggle is a URL-driven segmented control; the agenda is a read-only
// aggregation of EXISTING dated data (payments / paperwork / meetings /
// statutory milestones) — see lib/preparation.ts for the source map.
import { EmceeScriptButton, ScheduleModeToggle, SharePdfButton } from './_components/schedule-lazy';
import { EmceePicks } from './_components/emcee-picks';
import { HostQuestions } from './_components/host-questions';
// "Tell the host" — the coordinator → emcee channel, on the EVENT side. The
// channel and its send box already shipped, but only inside the supplier floor
// console; the couple's own floor-runner (an aunt, a planner they invited) has
// no supplier account and so could not reach the thing built for her. Same
// table, same INSERT policy, no permission widened.
import { TellTheHost } from './_components/tell-the-host';
import { parseNoteFlash } from './_components/note-flash';
import { PreparationAgendaView, preparationLegendWords } from './_components/preparation-agenda';
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
  isNoteOnlySuggestion,
  type RosMetaMap,
} from '@/lib/schedule-ros';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { readScheduleSuppliers } from '@/lib/schedule-suppliers-read';
import { HOST_ASK_COLUMNS, type HostAsk } from '@/lib/schedule-ask';
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
import { isStoredAppointmentKind } from '@/lib/appointments';
import { NOT_TAKING_CHANGES } from '@/lib/supplier-schedule-marks';
import {
  VendorMeetingsSection,
  type ScheduleMeeting,
} from './_components/vendor-meetings-section';
import { venueNowMs } from '@/lib/schedule';
import { PageMasthead } from '@/app/_components/page-masthead';
import { DETAILS_SCHEDULE_ANNOUNCE_SLOT, DETAILS_SCHEDULE_INSPECTOR_SLOT } from '@/lib/maker-details-items';
import { InSlot } from '../launch/_components/details-piece';
import { formatCount } from '@/lib/format-number';
// ── Schedule rebuild, slice 1 (2026-09-27) ─────────────────────────────────
// The Event Day view becomes the approved prototype's time rail
// (`prototypes/schedule_redesign_2026-09-25.html`); the header gains Announce.
// Every write below still goes through `./actions` and `_actions/day-of-broadcast`.
/* ⚡ The day rail, Announce and the tips load when the Schedule is opened — never
   with the Maker that draws this page (`_components/schedule-lazy.tsx`). */
import { AnnounceButton, BlockSwipe, ScheduleOneLine, ChaptersHost, PlanningChapters, ScheduleDay, Tip } from './_components/schedule-lazy';
import type { ChapterMoment, ChaptersInput } from './_components/chapters-host';
import type { ReactNode } from 'react';
import { readChapterBook, readMarchList, readMomentTasks, readTaskContacts, readTaskPeople } from '@/lib/schedule-chapters.server';
import { readChapterCounts } from '@/lib/invitation-chapters.server';
import { readScheduleRelease, type ScheduleReleaseFacts } from '@/lib/schedule-release.server';
import { readViewAsExtras } from '@/lib/schedule-view-as.server';
import { readTradeChapters, suggestedChapters } from '@/lib/trade-chapters';
import { guestsArriveTime } from '@/lib/guests-arrive';
import type { ViewMoment } from '@/lib/schedule-view-as';
import type { DayMoment, DayRequest, DayRole } from './_components/day-types';
import { MiniTour } from '@/app/_components/mini-tour';
import {
  BROADCASTS_UNREADABLE,
  fetchLatestBroadcasts,
  isCoordinatorP3Enabled,
  resolveBroadcastAuthority,
} from '@/lib/coordinator-broadcasts-server';
import type { CoordinatorBroadcastItem } from '@/lib/coordinator-broadcasts';
import { getDayOfPhase, getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { daysBetween, wallDateKey } from '@/lib/schedule-rail';
import { findBookedHost } from '@/lib/booked-host';
import { fetchEmceeRecipients } from '@/lib/stage-notes-recipients';
import { createAdminClient } from '@/lib/supabase/admin';
import { wholeMarchLabel } from '@/lib/schedule-chapters';

export const metadata = { title: 'Schedule' };

/** What the Event Day view's ⓘ says — the moments' two audiences. */
const EVENT_DAY_NOTE =
  'Moments shown to guests appear on the Event Hub, with a live “happening now” on the day. Hidden moments stay between you, your coordinator and the suppliers you tag.';

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    view?: string;
    ros?: string;
    note?: string;
    host_answers?: string;
    /** `1` = drawn as Details › Schedule inside the Event Hub Maker (Details part 2b). */
    maker?: string;
    /**
     * `requests` = open the supplier requests sheet with the page (Approve one · Approve all) — Home's Schedule widget
     * door "N to approve" (owner 2026-11-01, plan §5). Anything else is ignored.
     */
    sheet?: string;
    /**
     * `todo` = Planning Stage opens on its To do filter — where the old Checklist's address forwards (owner
     * 2026-11-01, "CHECKLIST MERGES INTO PLANNING STAGE").
     */
    filter?: string;
  }>;
};

export default async function CoupleSchedulePage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const {
    view: askedView,
    ros: rosParam,
    note: noteParam,
    host_answers: hostAnswersFlash,
    maker: makerParam,
    sheet: sheetParam,
    filter: filterParam,
  } = await searchParams;
  const openRequests = sheetParam === 'requests';
  const planFilter: 'all' | 'todo' = filterParam === 'todo' ? 'todo' : 'all';
  /* 🧭 JOURNEY IS GONE (owner 2026-11-01: "i don't think we need journey anymore? since everything from event created
     can be a chapter"). Every door that still says `?view=journey` lands on Planning Stage — here, before the view is
     used anywhere (owner 2026-10-28: all mapping is kept). */
  const viewParam = forwardScheduleView(askedView);
  const inMaker = makerParam === '1';
  /* 📅 THE PAGE'S ONE LINE — everywhere but inside the Maker's Details (which keeps its own header). Owner 2026-11-02
     ("BOOKED IS JUST THE TEAM": *"no just schedule"*): this is Home's Schedule page, never drawn inside Suppliers. */
  const oneLine = !inMaker;
  // Result of a "Tell the host" send. Anything we did not write ourselves is
  // treated as no flash at all, so a hand-edited URL cannot forge "Sent."
  const noteFlash = parseNoteFlash(noteParam);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* 📅 THE SCHEDULE IS ITS OWN PAGE, OPENED FROM HOME — AND IT NEVER SENDS YOU AWAY (owner 2026-11-01 "SCHEDULE AND
     BUDGET GO TO HOME"; 2026-11-02 "BOOKED IS JUST THE TEAM", live: *"the schedule still jumped to the
     booked-schedule"* · *"no just schedule"*). From 2026-10-29 this address redirected into Suppliers › Booked
     (`?part=schedule`), and before that into the Maker's Details for a couple with an Event Hub. Both are gone: Home's
     Schedule card, its doors and every old link land HERE, with their query. The old Suppliers address forwards here
     (`vendors/page.tsx`); the Maker still draws this page inside Details at `?maker=1`. 🔒
     `the-schedule-is-its-own-page.test.ts`. */
  const viewer = await fetchEventViewer(supabase, eventId, user.id);

  // 👥 People with access (owner 2026-10-03): The Day is its own area. A
  // delegate the host set to Off reads no moments (20271262573732 closed the
  // door) — say so, never draw an empty day.
  if (isDelegateWithoutArea(viewer, 'schedule')) {
    return <NotSharedWithYou title="Schedule" thing="schedule" />;
  }

  // Pull the event row (for event_date + ceremony_type that drive the
  // Preparation agenda's statutory-milestone + paperwork-deadline math),
  // the day-of blocks, and the aggregated Preparation agenda in parallel.
  // Defensive maybeSingle — a missing event row falls through to nulls,
  // which the agenda treats as "no wedding date yet".
  const [eventRes, blocks, suggestionsRes, chapterReadFirst, taskRead, peopleRead, marchRead, asksRes, contactRead] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, event_date, event_end_date, ceremony_type, secondary_ceremony_type, event_type, created_at, display_name, date_candidates, date_window_start, cleared_at, timezone')
      .eq('event_id', eventId)
      .maybeSingle(),
    /* 🛑 A REFUSED READ OF THE DAY IS SAID, NEVER DRAWN AS AN EMPTY DAY. Inside the Maker (Studio › Schedule) the
       page says so where the moments would be, with Try again — and stops there, before anything could seed a
       run of show over moments it merely failed to read. Everywhere else the read throws, as it always has. */
    fetchScheduleBlocks(supabase, eventId).catch((error: unknown) => {
      // The page says so in place, as the Maker does — never an error screen over the rest of the schedule.
      logQueryError('SchedulePage.blocks', error, { eventId }, 'graceful_degrade');
      return null;
    }),
    // Vendor suggestions queue (feature-access program Phase 3): open
    // proposals from booked vendors, resolved here by the couple or a
    // delegate with schedule edit (RLS-gated).
    supabase
      .from('event_schedule_suggestions')
      .select(
        'suggestion_id, block_id, kind, suggested_by_name, proposed_label, proposed_start_at, proposed_end_at, proposed_location, proposed_crew, proposed_parent_block_id, note, created_at, proposed_ingress_minutes, proposed_egress_minutes, where_vendor_id, proposed_block_ids',
      )
      .eq('event_id', eventId)
      .eq('status', 'open')
      // 🔁 A supplier's requests only — the hosts' OWN asks of a supplier ride the same table the other way
      // (`direction = 'to_supplier'`, D2) and are the supplier's to answer, never this queue's.
      .eq('direction', 'to_host')
      // A change or removal whose moment is already gone (the FK is ON DELETE
      // SET NULL since 20271263061583) has nothing left to approve.
      // 📍 A Where pick names no block of its own (it spans chapters, migration 20271308641275) — kept.
      .or('kind.in.(new,where),block_id.not.is.null')
      .order('created_at', { ascending: true }),
    /* 📖 The event's chapters (owner 2026-11-01, "CHAPTERS LIVE ON THE SCHEDULE PAGE") — in the same round, with their
       own fields (spot, ingress, call time…). Not in the Maker: Details › Schedule keeps its moments as they are. A
       refused read is kept as a failure and said on the page, never drawn as "no chapters". */
    inMaker ? Promise.resolve(null) : readChapterBook(supabase, eventId).catch(() => ({ ok: false as const })),
    /* 📖 Step 3b — each moment's parallel tasks, and who a task can name (people, groups, roles), in the same round.
       A refused read is kept as a failure: the moment sheet says so, never "no tasks". */
    inMaker ? Promise.resolve(null) : readMomentTasks(supabase, eventId).catch(() => ({ ok: false as const })),
    inMaker ? Promise.resolve(null) : readTaskPeople(supabase, eventId).catch(() => ({ ok: false as const })),
    /* 🚶 The couple's own marches, for a moment's "This is a march" (migration 20271301571290) — in the same round. A
       refused read is kept as a failure and said on the row, never "no marches". */
    inMaker ? Promise.resolve(null) : readMarchList(supabase, eventId).catch(() => ({ ok: false as const })),
    /* 🗓 The hosts' and the coordinator's own asks of a supplier (D2, owner 2026-11-02) — the moment sheet shows each
       one's state. A refused read is said on the sheet (`asks: null`), never drawn as "nothing asked". */
    inMaker
      ? Promise.resolve(null)
      : supabase
          .from('event_schedule_suggestions')
          .select(HOST_ASK_COLUMNS)
          .eq('event_id', eventId)
          .eq('direction', 'to_supplier')
          .order('created_at', { ascending: false })
          .limit(200),
    /* 📇 Each task's contact — a name and a phone (4 additions (3), migration 20271303218631) — in the same round. A
       refused read is kept as a failure: the task says so, never "no contact". */
    inMaker ? Promise.resolve(null) : readTaskContacts(supabase, eventId).catch(() => ({ ok: false as const })),
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
        date_candidates?: string[] | null;
        date_window_start?: string | null;
        cleared_at?: string | null;
        timezone?: string | null;
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
  if (blocks === null) {
    return (
      <TimelineReadProblem title="We could not load your schedule">
        Your moments are safe. This is a problem on our side or your connection.
        {/* 📅 Never kept as the no-signal copy over the last good one (`lib/offline-copies.ts` OFFLINE_COPY_UNREAD). */}
        <span hidden data-sn-copy-version={OFFLINE_COPY_UNREAD} />
      </TimelineReadProblem>
    );
  }
  let scheduleBlocks = blocks;
  if (
    scheduleBlocks.length === 0 &&
    (eventRow?.event_type ?? 'wedding') !== 'wedding'
  ) {
    scheduleBlocks = await seedNonWeddingRunOfShow(eventId);
  }
  /* 📖 EVERY NEW EVENT STARTS WITH FOUR CHAPTERS (owner 2026-11-03): a NEW wedding opened by someone who may write its
     schedule gets Prep · Ceremony · Cocktail + Reception · After Party, public, with the shipped template moments inside
     — once, when it has an exact day (`seedDefaultChapters`; migration 20271306532960 remembers which events are new). */
  if (
    scheduleBlocks.length === 0 &&
    (eventRow?.event_type ?? 'wedding') === 'wedding' &&
    viewerAreaLevel(viewer, 'schedule') === 'edit'
  ) {
    scheduleBlocks = await seedDefaultChapters(eventId);
  }
  // A first open that just seeded its day reads its chapters again (that read is not the blocks read, so it is not the
  // memoised GET the seed note above warns about).
  const chapterRead =
    chapterReadFirst && scheduleBlocks !== blocks
      ? await readChapterBook(supabase, eventId).catch(() => ({ ok: false as const }))
      : chapterReadFirst;
  // Iteration 0053 P4 Unit 1: only marriage-profile events get PH statutory
  // milestones in the agenda. Wedding → 'ph_marriage' → statutory true (byte-
  // identical); non-wedding → null → no PSA/CENOMAR/marriage-license rows.
  const profile = await resolveProfile(eventRow?.event_type ?? 'wedding');
  const statutory = profile.statutoryPackKey === 'ph_marriage';

  const now = new Date();
  /* ✅ THE OLD CHECKLIST'S TASKS LIVE HERE NOW (owner 2026-11-01). Top them up and auto-tick them BEFORE the one read,
     as the Checklist page did (`ensureChecklistSeeded` — a couple's open only; never un-ticks). A failure here never
     blocks the page: the read below still says what it found. */
  try {
    await ensureChecklistSeeded(eventId);
  } catch (caught) {
    if (isRedirectError(caught)) throw caught;
    logQueryError('SchedulePage.ensureChecklistSeeded', caught instanceof Error ? caught : new Error(String(caught)), { eventId }, 'graceful_degrade');
  }
  const agenda = await fetchPreparationAgenda({
    supabase,
    eventId,
    eventDate,
    ceremonyType,
    now,
    statutory,
    event: {
      event_type: eventRow?.event_type ?? null,
      event_date: eventDate,
      date_candidates: eventRow?.date_candidates ?? null,
      date_window_start: eventRow?.date_window_start ?? null,
      created_at: eventRow?.created_at ?? null,
    },
    profile,
  });

  // Coordinator P2 (flag-gated) — the responsible-party meta + the event's
  // vendor registry that feed the filtered run-of-show chrome. Both fetches
  // are SKIPPED entirely while the flag is dark; fetchBlockRosMeta is
  // additionally best-effort (pre-migration → empty map, page unaffected).
  const rosEnabled = await isDataPrivacyControlActive('coordinator_run_of_show');
  let rosMeta: RosMetaMap = EMPTY_ROS_META;
  let rosVendors: EventVendorOption[] = [];
  /** 🔌 The suppliers could not be read (audit #16) — the page says so; tasks never read as "A supplier" unnoticed. */
  let suppliersUnread = false;
  if (rosEnabled) {
    // 🗓 The suppliers an item can be given to — by their SHOP name, each
    // "Booked" or "Shortlisted" (owner 2026-10-20; lib/schedule-suppliers.ts,
    // through the one booked-if-paid resolver).
    const [metaRes, suppliersRes] = await Promise.all([
      fetchBlockRosMeta(supabase, eventId),
      readScheduleSuppliers(supabase, eventId),
    ]);
    rosMeta = metaRes;
    rosVendors = suppliersRes ?? [];
    if (suppliersRes === null) suppliersUnread = true;
  }
  const rosLens = parseRosLens(rosParam, rosVendors);
  /* 👁 VIEW AS (Step 3c): the tasks, rooms, groups and Pro the rail's View as ▾ reads — started now, awaited where the
     chapters are handed down, so it rides beside the reads below instead of after them. Never in the Maker or a trip. */
  const viewAsAhead =
    !inMaker && !isTravel && chapterRead?.ok ? readViewAsExtras(supabase, eventId, { readSuppliers: !rosEnabled, tasks: Promise.resolve(taskRead?.ok ? taskRead.value : null) }) : null;
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
  // with a blank agenda.
  const active: ScheduleView =
    viewParam === 'preparation' || viewParam === 'event-day'
      ? viewParam
      : /* In the Event Hub Maker (Details › Schedule) the page opens on the day
           itself — the moments guests see, the ones a tap on a stage selects. */
        inMaker || oneLine
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
      kind: isStoredAppointmentKind(r.kind) ? r.kind : 'video',
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
  /* 📣 RELEASE lives in the same 🔊 sheet (plan §4 "Release + announce · Schedule's 🔊 round"; Home's Release door
     opens it with `?announce=1`). The same two people may press it; never offered inside the Maker. */
  let scheduleRelease: ScheduleReleaseFacts | null = null;
  if (canAnnounce) {
    const [read, release] = await Promise.all([
      fetchLatestBroadcasts(supabase, eventId),
      inMaker ? Promise.resolve(null) : readScheduleRelease(supabase, eventId),
    ]);
    recentAnnouncements = read === BROADCASTS_UNREADABLE ? null : read;
    scheduleRelease = release;
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
  /* 📖 What the chapters' pages read: the chapters, and each one's moments (its child blocks) with who is on them in
     words — the suppliers tagged (by shop name), else the responsible party. Not for a trip: it keeps its own view. */
  const supplierName = new Map(rosVendors.map((v) => [v.vendor_id, v.vendor_name]));
  // A task names a BOOKED supplier (plan §2 "Booked suppliers only"): the page's supplier read when it made one, else its own.
  const taskSuppliers =
    chapterRead?.ok && !isTravel
      ? (rosEnabled
          ? rosVendors
          : await readScheduleSuppliers(supabase, eventId).then((r) => {
              if (r === null) suppliersUnread = true;
              return r ?? [];
            })
        )
          .filter((v) => v.standing === 'Booked')
          // 🔒 CHANGE LOCK (audit D7): the moment sheet says "<shop> isn’t taking changes" before the host tries.
          .map((v) => ({ id: v.vendor_id, name: v.vendor_name, ...(v.times === NOT_TAKING_CHANGES ? { locked: true } : {}) }))
      : [];
  /* 👷 Each booked supplier's trade, for a chapter's "Suppliers in this chapter" (owner 2026-11-04, prototype frame 2) —
     and whether they are on every chapter (a coordinator). A refused read only drops the trade words. */
  /* 📋 Slice 8: a booked supplier on NO chapter yet is a dashed face on the chapters its trade usually serves
     (slice 2's "needs a chapter", `suggestedChapters`). A refused read draws no dashed face — never a wrong one. */
  const picking: Record<string, string[]> = {};
  if (taskSuppliers.length > 0) {
    const { data: cats, error: catsErr } = await supabase
      .from('event_vendors')
      .select('vendor_id, category')
      .eq('event_id', eventId)
      .in('vendor_id', taskSuppliers.map((v) => v.id));
    // Refused: the rows say "Booked" instead of a trade, and no coordinator is listed on every chapter — said in the log.
    if (catsErr) logQueryError('SchedulePage.supplierTrades', catsErr, { eventId }, 'graceful_degrade');
    const catOf = new Map(((cats ?? []) as { vendor_id: string; category: string | null }[]).map((c) => [c.vendor_id, c.category]));
    for (const v of taskSuppliers as { id: string; name: string; trade?: string | null; everyChapter?: boolean }[]) {
      const cat = catOf.get(v.id) ?? null;
      v.trade = cat ? (VENDOR_CATEGORY_LABEL[cat as VendorCategory] ?? null) : null;
      v.everyChapter = isOnEveryChapter(null, cat);
    }
    if (!catsErr && chapterRead?.ok) {
      const trades = await readTradeChapters(supabase);
      if (trades.ok) {
        const book = chapterRead.value;
        const onAny = new Set<string>([
          ...book.chapters.flatMap((c) => c.vendor_ids ?? []),
          ...book.moments.flatMap((m) => m.vendor_ids ?? []),
          ...(taskRead?.ok ? taskRead.value.map((t) => t.vendor_id).filter((x): x is string => Boolean(x)) : []),
        ]);
        const where = book.chapters.map((c) => ({ blockId: c.block_id, name: c.label, location: c.location ?? null, startAt: c.start_at, tags: c.vendor_ids ?? [], kind: c.block_type ?? null }));
        for (const v of taskSuppliers as { id: string; everyChapter?: boolean }[]) {
          if (v.everyChapter || onAny.has(v.id)) continue;
          const cat = catOf.get(v.id) ?? null;
          for (const id of suggestedChapters(where, cat ? trades.byCategory.get(cat) : undefined)) (picking[id] ??= []).push(v.id);
        }
      }
    }
  }
  for (const v of taskSuppliers) if (!supplierName.has(v.id)) supplierName.set(v.id, v.name);
  const momentFacts = new Map(chapterRead?.ok ? chapterRead.value.moments.map((m) => [m.block_id, m]) : []);
  /* ✉ Who replied to each chapter on the invitation (Step 5) — two exact counts and the first names who said yes, per
     chapter; read only for chapters on the invitation. A chapter whose count failed is `null`, said on the switch. */
  const replyCounts =
    chapterRead?.ok && !isTravel
      ? Object.fromEntries(
          await readChapterCounts(
            supabase,
            eventId,
            chapterRead.value.chapters.filter((c) => c.on_invitation).map((c) => c.block_id),
          ),
        )
      : undefined;
  const viewAsExtras = viewAsAhead ? await viewAsAhead : null;
  const chaptersInput: ChaptersInput | null =
    chapterRead === null || isTravel
      ? null
      : chapterRead.ok
        ? {
            measured: true,
            chapters: chapterRead.value.chapters,
            moments: dayMoments
              .filter((m): m is DayMoment & { parent_block_id: string } => typeof m.parent_block_id === 'string')
              .map(
                (m): ChapterMoment => ({
                  block_id: m.block_id,
                  parent_block_id: m.parent_block_id,
                  label: m.label,
                  start_at: m.start_at,
                  end_at: m.end_at,
                  location: m.location,
                  spot: momentFacts.get(m.block_id)?.spot ?? null,
                  notes: m.notes,
                  is_optional: momentFacts.get(m.block_id)?.is_optional ?? false,
                  travel_from: momentFacts.get(m.block_id)?.travel_from ?? null,
                  travel_to: momentFacts.get(m.block_id)?.travel_to ?? null,
                  march_key: momentFacts.get(m.block_id)?.march_key ?? null,
                  is_public: m.is_public,
                  vendor_ids: momentFacts.get(m.block_id)?.vendor_ids ?? m.responsible_vendor_ids,
                  // ⏭ "Right after the one above" (migration 20271302727358): no clock of its own.
                  time_tba: momentFacts.get(m.block_id)?.time_tba ?? false,
                  follows_block_id: momentFacts.get(m.block_id)?.follows_block_id ?? null,
                  // 🕑 "About 3:15" · "2:15/2:30" (migration 20271303051692).
                  time_shape: momentFacts.get(m.block_id)?.time_shape ?? 'at',
                  time_or_minutes: momentFacts.get(m.block_id)?.time_or_minutes ?? null,
                  who:
                    m.responsible_vendor_ids
                      .map((id) => supplierName.get(id))
                      .filter(Boolean)
                      .join(', ') || (m.responsible_party ?? ''),
                }),
              ),
            venues: [],
            tasks: taskRead?.ok ? taskRead.value : null,
            contacts: contactRead?.ok ? contactRead.value : null,
            who: { suppliers: taskSuppliers, people: peopleRead?.ok ? peopleRead.value : null },
            marches: marchRead ?? { ok: false },
            asks: asksRes && !asksRes.error ? ((asksRes.data ?? []) as unknown as HostAsk[]) : null,
            wholeMarch: wholeMarchLabel(eventRow?.event_type),
            picking,
            eventDay: eventDateKey,
            lastDay:
              eventDateKey && eventRow?.event_end_date && eventRow.event_end_date.slice(0, 10) > eventDateKey
                ? eventRow.event_end_date.slice(0, 10)
                : eventDateKey,
            canEdit: dayRole !== 'view',
            // Putting a chapter on the invitation is the hosts' and the coordinator's — the people who edit the day
            // here; the door checks again (`mayShowToGuests`).
            mayInvite: dayRole !== 'view',
            replyCounts,
            viewAs: viewAsExtras
              ? {
                  pro: viewAsExtras.pro,
                  proHref: viewAsExtras.proHref,
                  data: {
                    moments: dayMoments.flatMap((m): ViewMoment[] => {
                      if (!m.parent_block_id) return [];
                      const at = momentFacts.get(m.block_id);
                      return [{ block_id: m.block_id, parent_block_id: m.parent_block_id, label: m.label, start_at: m.start_at, end_at: m.end_at, is_public: m.is_public, staged: m.staged, audience: m.audience ?? null, responsible_vendor_ids: m.responsible_vendor_ids, location: m.location, spot: at?.spot ?? null, travel_from: at?.travel_from ?? null, travel_to: at?.travel_to ?? null, time_tba: at?.time_tba === true }];
                    }),
                    tasks: taskRead?.ok ? taskRead.value : null,
                    suppliers:
                      viewAsExtras.suppliers ??
                      rosVendors.map((v) => ({ vendor_id: v.vendor_id, name: v.vendor_name, booked: v.standing === 'Booked', everyChapter: viewAsExtras.coordinatorIds.includes(v.vendor_id) })),
                    groups: viewAsExtras.groups,
                    roleNames: viewAsExtras.roleNames,
                    // 👤 View as › a named guest (slice 6): what their own card reads — the guests, Release, Arrive by.
                    people: viewAsExtras.people,
                    released: viewAsExtras.released,
                    guestsArriveBy: guestsArriveTime(scheduleBlocks),
                  },
                }
              : null,
          }
        : { measured: false };
  /* 📍 A Where pick reads "Now → Asked" in chapter names (lib/supplier-where.ts `whereNames`, time order). */
  // ⏰ Time TBA is the CHAPTER's flag (its own read, `readChapterBook`) — a TBA chapter goes after that day's timed ones.
  const tbaChapters = new Set(chapterRead?.ok ? chapterRead.value.chapters.filter((c) => c.time_tba === true).map((c) => c.block_id) : []);
  const whereChapters = whereChaptersFrom(
    dayMoments.map((m) => ({
      block_id: m.block_id,
      parent_block_id: m.parent_block_id,
      label: m.label,
      start_at: m.start_at,
      time_tba: tbaChapters.has(m.block_id),
      responsible_vendor_ids: m.responsible_vendor_ids ?? [],
    })),
  );
  const whereWordsOf = (s: VendorSuggestion): DayRequest['where'] => {
    if (s.kind !== 'where' || !s.where_vendor_id) return null;
    const now = whereNames(whereChapters, pickedOf(whereChapters, s.where_vendor_id));
    return { now: now || 'no chapter yet', asked: whereNames(whereChapters, s.proposed_block_ids ?? []) || 'a chapter that is gone' };
  };
  const dayRequests: DayRequest[] = openSuggestions.map((s) => ({
    suggestion_id: s.suggestion_id,
    block_id: s.block_id,
    kind: s.kind,
    by: s.suggested_by_name?.trim() || 'A booked supplier',
    proposed_label: s.proposed_label,
    proposed_start_at: s.proposed_start_at,
    proposed_end_at: s.proposed_end_at,
    proposed_location: s.proposed_location,
    proposed_crew: s.proposed_crew,
    proposed_ingress_minutes: s.proposed_ingress_minutes ?? null,
    proposed_egress_minutes: s.proposed_egress_minutes ?? null,
    where: whereWordsOf(s),
    note: s.note,
  }));

  /* 📤 PRINT IS THE BUDGET PDF (owner 2026-11-01: "just like our budget design pdf. do the same for  schedule") — the
     shared Share button on the Schedule's own file route (`api/schedule/[eventId]/export`, `lib/schedule-pdf.ts`), for
     the hosts and an approved coordinator. Never inside the Maker (that is the guests' Event Hub). */
  const scheduleFileSlug =
    (eventRow?.display_name?.trim() || 'event')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event';
  const shareSchedule =
    !inMaker && dayRole !== 'view' ? (
      <SharePdfButton
        href={`/api/schedule/${eventId}/export`}
        fileName={`setnayan-${scheduleFileSlug}-schedule.pdf`}
        name="Share your schedule (PDF)"
        papers="document"
      />
    ) : null;

  const roleLabel =
    dayRole === 'host'
      ? 'You can edit'
      : dayRole === 'coordinator'
        ? 'You can edit · coordinator'
        : 'View only';
  const viewNote =
    active === 'preparation'
      ? 'Every dated step still ahead — gathered from your payments, paperwork and supplier meetings, sorted by month. Tap an item to manage it where it lives.'
      : EVENT_DAY_NOTE;

  /* 📅 THE DAY ITSELF — the rail (or a trip's own view), drawn once and placed by either frame below: the page's one
     line (`schedule-one-line.tsx`), where its tools ride that line and its add is the pill in the thumb zone, or the
     Maker's Details header. */
  const prepView = (
    <>
    {/* 📖 Chapters dated before the day live here (plan §3) — chapter rows only, above the agenda, which is untouched. */}
    {chaptersInput ? <PlanningChapters /> : null}
    <PreparationAgendaView
      eventId={eventId}
      agenda={agenda}
      hasEventDate={eventDate !== null}
      eventWord={eventNoun(eventRow?.event_type)}
      line={oneLine}
      eventDateIso={eventDate}
      initialFilter={planFilter}
      /* AFTER THE DAY A DEADLINE IS JUST A DATE — the ONE lifecycle resolver (the Checklist page's rule, kept when it
         merged here): no "overdue", no alarm red, on a celebration that already happened. */
      eventIsOver={
        getMenuLifecyclePhase(eventDate, eventRow?.cleared_at ?? null, eventRow?.timezone ?? undefined, undefined, eventRow?.event_end_date ?? null) === 'after'
      }
    />
    </>
  );
  const eventDayView = (
      isTravel ? (
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
            frame={oneLine ? 'line' : 'page'}
            toolsSlot={oneLine ? SCHEDULE_TOOLS_SLOT : null}
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
            // 📅 `?sheet=requests` — Home's "N to approve" opens the supplier requests sheet with the page (placement, no write).
            openRequests={openRequests}
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
      )
  );

  const scheduleCopyPath = coordinatorSchedulePath(eventId);
  /** The day's moments (parts sit inside them) — the view dropdown's count, "7". */
  const topLevelCount = scheduleBlocks.filter((b) => !b.parent_block_id).length;
  /** "Friday 18 December 2026 · 50 days to go" — the page's date line (frame 19); the rest is in its ⓘ. */
  const dateLine = [
    eventDateKey
      ? new Date(`${eventDateKey}T00:00:00Z`).toLocaleDateString('en-GB', {
          timeZone: 'UTC',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).replace(',', '')
      : 'No date yet',
    isEventDay ? 'today' : daysToGo !== null && daysToGo > 0 ? `${formatCount(daysToGo)} day${daysToGo === 1 ? '' : 's'} to go` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    /* 💾 The schedule is kept on the phone and shown at once on the next
       open, then refreshed (owner 2026-10-02, DECISION_LOG "LAST-SEEN DATA
       SHOWS INSTANTLY, THEN REFRESHES"). Payment due dates carry `data-money`
       and are never kept (lib/last-seen). Not inside the Maker (`?maker=1`). */
    <LastSeenCapture page="schedule">
    <section className={`sn-col space-y-5${oneLine ? ' xl:max-w-[100rem]' : ''}`} data-schedule-page={oneLine ? '' : undefined}>
      {/* Inside the Maker, Details' own header names it; on its own page, the shared masthead. */}
      {inMaker ? null : <PageMasthead title="Schedule" />}
      {/* 📅 YOUR SCHEDULE, SAVED FOR NO SIGNAL — the hosts' / coordinator's own day, kept on this phone for the venue. A
          plain slot, no client code: the route's `layout.tsx` draws the saved mark into it (`ScheduleSavedSlot` says why
          — the Maker draws this page and must not carry the mark). */}
      {inMaker || !scheduleCopyPath ? null : (
        <div
          data-schedule-copy=""
          data-sn-copy-version={copyVersionOf([scheduleBlocks, chaptersInput])}
          data-sn-copy-viewer={user.id}
          data-sn-copy-event={eventId}
          data-sn-copy-path={scheduleCopyPath}
          data-sn-copy-day={eventDate ?? ''}
          data-sn-copy-day-end={eventRow?.event_end_date ?? ''}
        />
      )}

      {suppliersUnread ? <ReadRefusedNotice what="your suppliers" partial className="mb-3" /> : null}
      {/* 📖 The chapters (owner 2026-11-01): a tapped chapter opens its page over the views — one place, this page. */}
      <ChaptersFrame eventId={eventId} input={chaptersInput} dateLine={dateLine}>
      {oneLine ? (
        /* 📅 THE SCHEDULE PAGE (owner 2026-10-31, live iPhone: *"so many upper space not used"*; frames 19 · 19b · 20 —
           drawn under Suppliers › Booked until 2026-11-02): ONE line — the view ▾ · the day's tools · 🔊 — then the date
           line with everything else in its ⓘ, then the moments. Each view drawn once and kept; a pick swaps in place
           (`schedule-one-line.tsx`). */
        <ScheduleOneLine
          initial={active}
          views={[
            { key: 'event-day', label: 'Event Day', count: topLevelCount },
            { key: 'preparation', label: 'Planning Stage', count: agenda.items.length },
          ]}
          dateLine={dateLine}
          info={
            <>
              {eventRow?.display_name?.trim() ? <b className="block font-semibold">{eventRow.display_name.trim()}</b> : null}
              <span className="block">
                <b className="font-semibold">{roleLabel}.</b> Hosts build the schedule. A coordinator edits only after a
                host approves them — the host invite plus your consent under the Data Privacy Act (RA 10173). Everyone
                else reads.
              </span>
            </>
          }
          notes={{
            'event-day': EVENT_DAY_NOTE,
            preparation: preparationLegendWords(agenda.sourceCounts),
          }}
          announce={
            canAnnounce ? (
              <AnnounceButton eventId={eventId} isEventDay={isEventDay} recent={recentAnnouncements} round release={scheduleRelease} />
            ) : null
          }
          share={shareSchedule}
          meetings={<VendorMeetingsSection eventId={eventId} meetings={vendorMeetings} />}
          panels={{
            'event-day': eventDayView,
            preparation: prepView,
          }}
        />
      ) : (
        <>
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
            />
            <span className="ml-auto flex items-center gap-2">
              <Tip align="end">{viewNote}</Tip>
              {shareSchedule}
              {canAnnounce ? (
                /* In the Maker's Details, Announce is a piece of the Schedule: its
                   button (and its sheet) sit in the right column (`InSlot`). */
                <InSlot id={inMaker ? DETAILS_SCHEDULE_ANNOUNCE_SLOT : null}>
                  <AnnounceButton
                    eventId={eventId}
                    isEventDay={isEventDay}
                    recent={recentAnnouncements}
                    release={scheduleRelease}
                  />
                </InSlot>
              ) : null}
            </span>
          </div>
        </header>

        {active !== 'event-day' ? (
          <VendorMeetingsSection eventId={eventId} meetings={vendorMeetings} />
        ) : null}

        {active === 'preparation' ? prepView : eventDayView}
        </>
      )}
      </ChaptersFrame>

      {/* Every feature gets a first-visit tour (owner 2026-09-25) — the shipped
          MiniTour, keyed once per person. */}
      <MiniTour tourKey="customer_schedule_v1" />
    </section>
    </LastSeenCapture>
  );
}

/** The chapters' host around the page's views — or the views alone where none are drawn (the Maker, a trip). */
function ChaptersFrame({ eventId, input, dateLine, children }: { eventId: string; input: ChaptersInput | null; dateLine: string; children: ReactNode }) {
  if (!input) return <>{children}</>;
  return (
    <ChaptersHost eventId={eventId} input={input} dateLine={dateLine}>
      {children}
    </ChaptersHost>
  );
}

type VendorSuggestion = {
  suggestion_id: string;
  block_id: string | null;
  kind: 'adjust' | 'new' | 'remove' | 'hours' | 'where';
  proposed_ingress_minutes?: number | null;
  proposed_egress_minutes?: number | null;
  /** 📍 A Where pick: the booking and the chapters asked (migration 20271308641275). */
  where_vendor_id?: string | null;
  proposed_block_ids?: string[] | null;
  suggested_by_name: string | null;
  proposed_label: string | null;
  proposed_start_at: string | null;
  proposed_end_at: string | null;
  proposed_location: string | null;
  proposed_crew: string[] | null;
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
                ) : s.kind === 'where' ? (
                  // 📍 A Where pick (migration 20271308641275): its note already names the chapters asked.
                  <>picked the chapters they serve</>
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
              <div className="pt-0.5">
                <RequestDecision eventId={eventId} suggestionId={s.suggestion_id} noteOnly={isNoteOnlySuggestion(s)} decide={resolveScheduleSuggestion} />
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
            <li key={b.block_id} className="has-[[data-swipe-gone]]:hidden">
              <BlockSwipe eventId={eventId} blockId={b.block_id} label={b.label}>
              <BlockCard
                eventId={eventId}
                block={b}
                imminent={nextBlock?.block_id === b.block_id}
                rosEnabled={rosEnabled}
                rosMeta={rosMeta}
                rosVendors={rosVendors}
                eventType={eventType}
              />
              </BlockSwipe>
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
        {/* 👈 The block's Delete is the card's swipe (owner 2026-11-03) — `BlockSwipe`, around the card below. */}
      </div>
    </article>
  );
}
