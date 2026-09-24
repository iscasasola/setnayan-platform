import {
  Suspense,
  type ReactNode,
  type ComponentType,
} from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Store,
  ShieldCheck,
  ArrowUpRight,
  Wand2,
  Users,
  Clapperboard,
  Heart,
  HeartHandshake,
  Baby,
  Mail,
  CalendarClock,
  Plus,
} from 'lucide-react';
import { YearMomentsStrip } from './_components/year-moments-strip';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchUserEvents, type EventWithRole } from '@/lib/events';
import {
  canWriteStoryFor,
  daysUntilEventDay,
  eventBoardHref,
  eventStance,
  isFinishedEvent,
  landingJumpTarget,
  manilaTodayISO,
  mergeBoardMemberships,
  splitEventBoard,
  splitPlanningShelves,
  boardFinished,
  findDateClashes,
  type DateClash,
  splitFinishedByStory,
  stanceLabel,
  type EventStance,
} from '@/lib/event-board';
import {
  fetchUserCommunities,
  type CommunityWithRole,
} from '@/lib/communities';
import {
  fetchChecklistItems,
  checklistAnchorDateFor,
  checklistRunwayFor,
  daysUntilEvent,
  dueDateForItem,
} from '@/lib/checklist';
import { fetchUserRoleSummary } from '@/lib/roles';
import {
  fetchEventDecisionCounts,
  fetchEventUnreadCounts,
  fetchVendorUnreadCounts,
  summarizeEventDecisions,
  type EventDecisionSummary,
} from '@/lib/event-decisions';
import { getAdminQueueDigest, ADMIN_QUEUE_META } from '@/lib/admin/queue-counts';
import { logQueryError } from '@/lib/supabase/error-detect';
import { EventMonogram } from '@/app/_components/event-monogram';
import {
  CollectionCard,
  CollectionEmptyState,
  CollectionGrid,
  CollectionPager,
  NewThingTile,
  collectionMarkClass,
  type CollectionAttention,
} from '@/app/_components/collection-card';
import { paginateCollection, parseCollectionPage } from '@/lib/collection-pagination';
import { accountAutosurfaceEnabled } from '@/lib/account-autosurface-flag';
import { AutoSurfacedEvents } from '../(account)/_components/autosurfaced-events';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { EventCardMenu } from './_components/event-card-menu';
/*
  ⚠ THE BADGE AND THE TWO LABEL HELPERS NOW COME FROM THE SHARED INDEX, and
  that direction is deliberate. The palette and this board must badge one event
  with one word and print one date the same way; keeping a private copy here is
  exactly how the two would start disagreeing about the same wedding. The date
  helper in particular is tz-safe by construction (`DECISION_LOG.md`
  2026-08-04 — "a date is not an instant"), and that is not worth having twice.
*/
import {
  eventTypeBadge,
  placeLabel,
  shortDate,
} from '@/app/_components/frontdoor/command-data';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { EventScene } from './_components/event-scene';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { eventTypePhotoSrc } from '../(account)/create-event/_components/event-types';
import { renderableImageSrc } from '@/lib/event-card-art';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { peopleConnectionsEnabled } from '@/lib/people-connections';

export const metadata = {
  title: 'Your events',
};

/**
 * "Where to?" — the full-screen account LAUNCHER, remodeled to the FOUR-SURFACE
 * home (owner-approved final design 2026-07-15, "build it"; council verdict
 * `User_Home_Redesign_Council_Verdict_2026-07-14.md` in the spec corpus). Every
 * block has exactly ONE home — no duplicated surfaces:
 *   • EVENTS — TWO ALWAYS-PRESENT SHELVES (owner 2026-08-13): "Coming up" as
 *     glass cards (badge · stance · monogram · place/date · gold progress ring
 *     · countdown), SOONEST FIRST since 2026-09-24 (the collection template —
 *     it reversed the 2026-07-13 newest-on-top rule for Planning only) with
 *     UNDATED at the tail reading "Date to be set", ten per page, ending
 *     in a "New event" card — then "Finished", which reads "Celebrated" and is
 *     rendered WHETHER OR NOT it has anything in it. It used to hide behind a
 *     "Show all" (`?show=all`) toggle: **a thing you have to switch on reads as
 *     a thing that might not be there**, and prod's one finished wedding was
 *     exactly that. Every card also NAMES ITS STANCE — you organise it, or you
 *     were invited — because that is what decides where it can send you: an
 *     organiser's card opens the event dashboard, an invited card opens the
 *     event's own public address, where their photos / table / RSVP live and
 *     the money + plan surfaces are ABSENT rather than present-and-refused.
 *     Shelves, stance and hrefs are all derived in lib/event-board.ts.
 *   • ALAALA — the single memory dimension (owner-confirmed name 2026-07-14),
 *     composed as the prototype's BENTO: the obsidian Alaala·Life-Flash tile
 *     (headline · face row · Play when the flag is on) beside the Setnayan-AI
 *     "Watch" aggregate; beneath them the MEMORY WALL — the five LENSES
 *     (Recent/Owned/Attended/People/With me) over PHOTOGRAPHS, all inline
 *     swaps from one read — then "This year" (YearMomentsStrip), inline per
 *     the owner 2026-07-13 rule. The lenses used to sit inside the tile and
 *     answer with sentences about EVENTS, which made Alaala a second list of
 *     events; the board above is the list of events. The flag-gated
 *     person-spine "Your story" renders in the tile's column when its flag
 *     turns on.
 *   • SPACES → "YOURS TO RUN" (owner 2026-07-30 "split it in two"). The tile
 *     was mixing three unlike things; it now holds only the stances this
 *     account OPERATES, as labelled groups: the vendor shop(s) + Admin HQ
 *     rows (capability-gated — absent for a plain couple), the Creator's Lab
 *     (Your Story / Become a Storyteller — renders for everyone, so the tile is
 *     never an empty heading), and "Vendors you saved" (the shortlist link into
 *     /dashboard/library?tab=vendors). Saved vendors stays INSIDE this tile
 *     rather than becoming the second tile because the owner's later line
 *     (2026-07-31) puts it "with the group of your shop, hq, and creators lab".
 *     The other half of the split is the PEOPLE tile below: Samahan left this
 *     tile entirely, because a samahan is not something you run.
 *   • PEOPLE — a real block on the home for the first time (it existed only as
 *     a ⌘K entry + a phone pill target; a palette entry is not a doorway).
 *     Built ONLY from sources that are real for this account:
 *       – Samahan · Communities — LIVE for everyone, moved here from Spaces
 *         because a samahan is a first-degree PEOPLE relation, not a stance
 *         you run (the same model /dashboard/people itself states: "your
 *         connections, your alaga, and your samahan groups"). Rows capped at 3
 *         with an overflow row, then the "+ Create a Samahan" door.
 *       – Alaga — rendered ONLY when NEXT_PUBLIC_DEPENDENT_PEOPLE is on AND
 *         the `dependent_minor_profiles` privacy control is Active AND the
 *         account actually has rows. Flag-off = zero queries, zero row.
 *       – Connections — rendered ONLY when NEXT_PUBLIC_PEOPLE_CONNECTIONS is
 *         on AND there is ≥1 confirmed edge. Both are OFF in production today,
 *         so in prod the People tile is exactly its Samahan group — the small
 *         honest version, not three empty facets.
 *     The "Everyone you gather" footer link to /dashboard/people appears only
 *     when one of those flags is on, because with both OFF that page renders a
 *     non-interactive "coming soon" preview (its `PeoplePreview` early return).
 *   • YOU — behind the top-bar avatar only (AccountSwitcher: Profile & settings ·
 *     Setnayan AI · sign-out). The on-page "Your account" section is gone — its
 *     rows moved into Alaala (People · Memories Hub) and the avatar menu
 *     (Profile · Setnayan AI), killing the old zone overlap.
 * Plus the deterministic SEARCH bar (HomeCommandBar, ⌘K): client-side jump-to
 * over the user's own events/spaces/destinations — no LLM (Setnayan AI Rule 1).
 *
 * Marketplace is intentionally NOT a launcher tile — vendor discovery is an
 * in-event surface (`/explore` from an event), not an account-level destination.
 *
 * Landing rule (owner 2026-07-04, preserved): a single-event, non-console user
 * still jumps straight into their one event; a 0-event console user is sent to
 * create-event; everyone else lands on this launcher.
 *
 * Flag-gated behavior preserved (all default-OFF in prod): `lifeStoryEnabled`
 * gates the Alaala tile's moment-graph fetch + "Play Life-Flash" link,
 * AutoSurfacedEvents (`accountAutosurfaceEnabled`), and the person-spine
 * "Your story" block (`personLifeStoriesEnabled`).
 */

export default async function LauncherPage({
  searchParams,
}: {
  // `show` is GONE (2026-08-13): the board no longer has a hidden half, so
  // there is nothing for a query param to reveal. A bookmarked or printed
  // `/dashboard?show=all` still renders the board — an unread param is ignored.
  //
  // `putaway` is NOT that param coming back. The retired one hid a shelf of
  // celebrations the person never asked to hide; this one reveals the ones they
  // put away BY HAND, and the switch prints how many there are, so it can never
  // read as "something might be missing" — which is the sentence that retired
  // the old one.
  //
  // `page` is the Planning shelf's page (the collection template, owner-approved
  // 2026-09-24: ten per page). A URL, not state — see `planningPageHref`.
  searchParams?: Promise<{ hub?: string; putaway?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  // Layout already redirects to /login if no user; this is for type narrowing.
  if (!user) redirect('/login');
  const supabase = await createClient();
  const sp = (await searchParams) ?? {};
  // Server-rendered switch: a link, not client state. Nothing is stored, so the
  // reveal lasts exactly as long as the person is looking at it — putting an
  // event away is the durable choice, seeing it again is not.
  const putAwayRequested = sp.putaway === '1';

  // OAuth-race graceful-degrade shielding (preserved from the prior hub): the
  // users / events rows this page reads are the SAME rows supabase-auth just
  // inserted via the auth → public.users sync trigger, so reads can race the
  // JWT/trigger commit for ~1-2s right after a Google / Facebook OAuth callback.
  // Every query graceful-degrades with a safe default so the page renders the
  // launcher instead of flashing the global error boundary.
  const [organiserEvents, invitedEvents, roles, communities] =
    await Promise.all([
      fetchUserEvents(supabase, user.id, 'couple').catch((err: unknown) => {
        logQueryError(
          'Launcher (fetchUserEvents threw)',
          err instanceof Error ? err : new Error(String(err)),
          { user_id: user.id },
          'graceful_degrade',
        );
        return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
      }),
      // INVITED memberships — the other half of "the board is your collection of
      // events". Until now the board asked for `'couple'` rows only, so an event
      // somebody had joined by scanning an invitation QR was INVISIBLE to them
      // here; the only surface that read guest rows sits behind an off-by-default
      // flag. Separate call (not a widened one) so the `'couple'` cache key the
      // dashboard shell shares stays intact.
      //
      // ⚠ NEVER PRINT A COUNT OFF THIS. fetchUserEvents graceful-degrades to []
      // on every error including RLS denial, so `[]` cannot be told apart from
      // "none" — the board therefore states what the shelves are FOR and never
      // that you have no invitations.
      fetchUserEvents(supabase, user.id, 'guest').catch((err: unknown) => {
        logQueryError(
          'Launcher (fetchUserEvents guest threw)',
          err instanceof Error ? err : new Error(String(err)),
          { user_id: user.id },
          'graceful_degrade',
        );
        return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
      }),
      fetchUserRoleSummary(supabase, user.id).catch((err: unknown) => {
        logQueryError(
          'Launcher (fetchUserRoleSummary threw)',
          err instanceof Error ? err : new Error(String(err)),
          { user_id: user.id },
          'graceful_degrade',
        );
        // Safe-default role summary matches the shape fetchUserRoleSummary
        // returns when the user has no admin / vendor associations.
        return {
          hasCustomerAccess: true,
          hasVendorAccess: false,
          hasAdminAccess: false,
          vendorProfiles: [],
          // Nothing was measured here — this literal exists BECAUSE the read
          // failed. False keeps `canOpenShop` closed, so a supplier who has a
          // shop is not invited to create a second, permanent one.
          shopsMeasured: false,
          ownedShopCount: 0,
          canOpenShop: false,
        } as Awaited<ReturnType<typeof fetchUserRoleSummary>>;
      }),
      // Samahan (communities) the user belongs to — graceful-degrade to [] so a
      // pre-migration environment (or an OAuth-race read) renders the launcher
      // with the create-only Samahan section rather than the error boundary.
      fetchUserCommunities(supabase, user.id).catch((err: unknown) => {
        logQueryError(
          'Launcher (fetchUserCommunities threw)',
          err instanceof Error ? err : new Error(String(err)),
          { user_id: user.id },
          'graceful_degrade',
        );
        return [] as CommunityWithRole[];
      }),
    ]);

  // ⚠ `events` STAYS THE ORGANISER-ONLY SET, deliberately. Everything below it
  // — the landing auto-jump, the checklists, the "% planned" rings, the decision
  // counts, The Watch — is about running an event, and a person who was merely
  // invited to one has none of that. Only the BOARD — and, since 2026-09-19,
  // the landing auto-jump, which must agree with the board it skips — reads the
  // merged set (`boardEvents` below).
  const events = organiserEvents;
  const active = events.filter((e) => !e.archived);
  const hasConsole = roles.hasVendorAccess || roles.hasAdminAccess;

  // Finished = archived OR the event date has passed (PH-local date compare).
  // ⚠ MOVED ABOVE THE LANDING RULE 2026-08-11 — the rule now depends on it. The
  // definition itself now lives in lib/event-board.ts (`isFinishedEvent`), so
  // the shelf a card lands on and the landing rule can never drift apart.
  const todayISO = manilaTodayISO();
  // (Both remaining callers pass rows out of `active`, which is already
  // non-archived, so `isFinishedEvent`'s archived branch can never fire for
  // them — this is the same answer the old inline date test gave.)
  const isPast = (e: EventWithRole) => isFinishedEvent(e, todayISO);

  // ─── THE BOARD'S TWO SHELVES ────────────────────────────────────────────
  // Timeline order (owner 2026-07-13): a Facebook-style feed — newest at the
  // top, OLDER as you scroll down. Coming up runs date DESCENDING with UNDATED
  // at the tail ("Date to be set" is a real state, not a missing value), then
  // Finished continues oldest-toward-the-bottom. ⚠ PLANNING IS RE-ORDERED
  // SOONEST FIRST by `splitPlanningShelves` (collection template, owner-approved
  // 2026-09-24) — this timeline order survives for the finished shelves and for
  // `comingUp` as an input. Both shelves ALWAYS RENDER
  // (owner 2026-08-13) — the `?show=all` toggle that used to hide the second one
  // is gone.
  //
  // This is the ONE place the invited memberships join the organiser ones: the
  // board is the person's collection of events, whichever side of it they stand
  // on. Ordering + the finished test + the stance/href derivation all live in
  // lib/event-board.ts.
  const dateKey = (e: EventWithRole) => e.event_date?.slice(0, 10) ?? '';
  const boardEvents = mergeBoardMemberships(events, invitedEvents);
  const { comingUp: comingUpAll, finished: finishedAll } = splitEventBoard(
    boardEvents,
    todayISO,
  );
  // THE BOARD IS FIVE SHELVES (owner 2026-08-21). Put-away rows are lifted out
  // of all of them here and handed back only behind the switch on Planning —
  // see `splitPlanningShelves` for why `isFinishedEvent` was not redefined.
  const {
    happeningNow,
    planning: upcoming,
    putAway,
  } = splitPlanningShelves(comingUpAll, finishedAll, todayISO);
  const finished = boardFinished(finishedAll);
  const showPutAway = putAwayRequested;
  // THE PLANNING SHELF PAGES AT TEN (the collection template, owner-approved
  // 2026-09-24). `upcoming` is already soonest-first (`splitPlanningShelves`),
  // so a page is a slice of it. Other shelves are not paged.
  const planningPage = paginateCollection(upcoming.length, parseCollectionPage(sp.page));
  const upcomingOnPage = upcoming.slice(planningPage.from, planningPage.to);
  // "You are expected in two places." Read off the shelves already in memory —
  // today's and the ones ahead — never the finished ones: a clash you can no
  // longer do anything about is a reproach, not a warning.
  const clashes = findDateClashes([...happeningNow, ...upcoming]);

  // ─── LANDING ────────────────────────────────────────────────────────────
  // Owner 2026-07-04: "keep the auto-jump, HUB REACHABLE." Only the first half
  // ever shipped. The jump fired for every single-event non-console user, and
  // the account switcher's Home button landed back here — which re-fired it. So
  // the hub was not reachable at all for the core persona: Alaala, People,
  // Samahan and the Creator's Lab did not exist for them, permanently, and that
  // is why "how do I find my samahan" had no good answer.
  //
  // 🔑 OWNER 2026-08-11, the ruling this implements: **"home board is for the
  // user's collection of events. On going and completed."** A COLLECTION is a
  // place you visit, not a place you are bounced out of — and it must hold the
  // wedding that already happened. Two consequences, both here:
  //
  //   1. The jump only fires while the one event is still UPCOMING. Once the day
  //      has passed the person is keeping, not planning, so they land on the
  //      collection. Without this a couple is sealed inside a finished wedding
  //      for the rest of their life on the platform.
  //   2. `?hub=1` always wins. The switcher's Home carries it, so Home means the
  //      board from anywhere — the "reachable" half of the 2026-07-04 ruling,
  //      finally.
  //
  // Deliberately NOT changed: the auto-jump itself. A couple mid-planning with
  // one wedding still wants to land in it, and reversing that would undo a
  // ruling the owner has never withdrawn.
  //
  // 🔑 OWNER 2026-09-19 — "shouldn't it let me pick which event first?" The
  // jump used to be decided from `active` (ORGANISER-only) while the board and
  // the rail's Events count read every membership, so a person who organises
  // one wedding and is the groom on another saw "Events 2" and was dropped into
  // one of them. The decision now reads the SAME set the board renders
  // (`boardEvents`): it jumps only when the whole board is exactly one card,
  // that card is their own, and it is still upcoming. See `landingJumpTarget`.
  const wantsHub = sp.hub === '1';
  const jumpTo = landingJumpTarget(boardEvents, todayISO);
  if (jumpTo && !hasConsole && !wantsHub) {
    redirect(`/dashboard/${jumpTo}`);
  }
  // 🚨 AND THIS ONE HAD NO HUB ESCAPE, so the board was unreachable for a whole
  // persona. `active` is the ORGANISER-only set, so a supplier or admin who
  // organises nothing was bounced to create-event — including one who had just
  // been INVITED to a client's wedding and now has a card waiting on this very
  // board. `?hub=1` (which the account switcher's Home carries) must win here for
  // the same reason it wins over the auto-jump above: Home means the board from
  // anywhere. The redirect itself is untouched for the person it was written for
  // — a console user with nothing at all still lands on create-event.
  if (active.length === 0 && hasConsole && !wantsHub && boardEvents.length === 0) {
    redirect('/dashboard/create-event');
  }
  // "% planned" per event — real done/total from the event checklist, fetched in
  // parallel (event count is small). Null when an event has no checklist rows yet
  // → the card shows the countdown without a fabricated percentage. Only the
  // non-archived set is scored; archived cards read null (caption only).
  // Per-event checklist pass — one fetch each (event count is small), reused for
  // BOTH the "% planned" ring AND the overdue-task decision signal below.
  const checklistEntries = await Promise.all(
    active.map(
      async (
        e,
      ): Promise<[string, { pct: number | null; overdue: number }]> => {
        try {
          const items = await fetchChecklistItems(supabase, e.event_id);
          if (items.length === 0) return [e.event_id, { pct: null, overdue: 0 }];
          const done = items.filter((i) => i.status === 'done').length;
          // Same deadline ANCHOR the checklist page dates by — locked date, else
          // earliest candidate, else window start; weddings on the locked date
          // alone. This card used to pass `e.event_date` straight through, so a
          // non-wedding event whose date isn't locked yet resolved no due dates
          // at all and the card claimed 0 overdue while the page it links to
          // listed real deadlines. One helper, both surfaces, no drift.
          const anchorDate = checklistAnchorDateFor(e);
          // Same runway rule the checklist page renders with — an event whose
          // template is longer than its runway must not report every task as
          // overdue on the card either. Null runway ⇒ authored offsets stand.
          // Measured from the SAME anchor: the runway is (creation → anchor), so
          // it has to move with the anchor or the compression would disagree too.
          const runway = checklistRunwayFor(items, anchorDate, e.created_at ?? null);
          const overdue = items.filter((i) => {
            if (i.status !== 'pending') return false;
            const due = dueDateForItem(anchorDate, i.due_offset_days, runway);
            return !!due && due < todayISO;
          }).length;
          return [
            e.event_id,
            { pct: Math.round((done / items.length) * 100), overdue },
          ];
        } catch {
          return [e.event_id, { pct: null, overdue: 0 }];
        }
      },
    ),
  );
  const checklistByEvent = new Map(checklistEntries);
  const progressByEvent = new Map<string, number | null>(
    checklistEntries.map(([id, v]) => [id, v.pct]),
  );

  // "Needs a decision now" per event — the pay + approve signals (batched into
  // two queries) merged with the overdue-task count from the checklist pass. A
  // named action line, not a bare badge (owner 2026-07-10). Graceful-degrades to
  // an empty summary; a card with nothing pending shows no attention line.
  const [decisionCounts, unreadByEvent] = await Promise.all([
    fetchEventDecisionCounts(
      supabase,
      active.map((e) => e.event_id),
    ).catch(() => new Map<string, { pay: number; approve: number }>()),
    fetchEventUnreadCounts(supabase).catch(() => new Map<string, number>()),
  ]);
  const decisionByEvent = new Map<string, EventDecisionSummary>();
  for (const e of active) {
    const c = decisionCounts.get(e.event_id) ?? { pay: 0, approve: 0 };
    // Overdue tasks are meaningless once the date has passed, so a finished
    // event still surfaces pay / approve / message decisions but not a
    // "50 tasks overdue" line for a wedding that already happened.
    const overdue = isPast(e)
      ? 0
      : (checklistByEvent.get(e.event_id)?.overdue ?? 0);
    const message = unreadByEvent.get(e.event_id) ?? 0;
    decisionByEvent.set(
      e.event_id,
      summarizeEventDecisions({
        pay: c.pay,
        approve: c.approve,
        message,
        overdue,
      }),
    );
  }


  // SPACES — doorways into surfaces with their own dashboards. Marketplace
  // is intentionally excluded (it's an in-event vendor-discovery surface).
  // (The Life Story doorway is NOT a space — the obsidian AlaalaTile carries
  // it: flag-off = invite copy, flag-on = moment-graph summary + Play link;
  // exactly one doorway either way.)
  // Vendor shop "needs a reply" signal — pending client inquiries per shop
  // (chat_threads.inquiry_status = 'pending' = a couple messaged and the vendor
  // hasn't accepted yet). One batched query across all the user's shops.
  const shopIds = roles.vendorProfiles.map((v) => v.vendor_profile_id);
  const inquiryByShop = new Map<string, number>();
  // Unread REPLIES per shop (accepted conversations with a waiting reply) — the
  // vendor-side twin of the couple event-card message signal.
  const unreadByShop = shopIds.length > 0
    ? await fetchVendorUnreadCounts(supabase).catch(() => new Map<string, number>())
    : new Map<string, number>();
  if (shopIds.length > 0) {
    try {
      const { data, error: dataError } = await supabase
        .from('chat_threads')
        .select('vendor_profile_id')
        .in('vendor_profile_id', shopIds)
        .eq('inquiry_status', 'pending')
        // Exclude couple-removed (archived) inquiries — a withdrawn thread must
        // not show as a phantom "pending inquiry" attention item. The outer
        // try/catch graceful-degrades if archived_at isn't in the DB yet.
        .is('archived_at', null);
      // ⚠ unread chat threads. Refused, the badge reads zero and a waiting message is
      // ⚠ invisible.
      if (dataError) {
        logQueryError('LauncherPage.data', dataError, {}, 'graceful_degrade');
      }
      for (const row of (data ?? []) as Array<{
        vendor_profile_id: string | null;
      }>) {
        if (row.vendor_profile_id) {
          inquiryByShop.set(
            row.vendor_profile_id,
            (inquiryByShop.get(row.vendor_profile_id) ?? 0) + 1,
          );
        }
      }
    } catch {
      // graceful-degrade: no attention line rather than a broken launcher.
    }
  }

  // Admin HQ "awaiting review" signal — open items across the ACTIONABLE work
  // queues. Deliberately excludes the `support` lane (help desk, review appeals)
  // so ongoing support volume doesn't inflate the count next to real gating
  // decisions (payments, verification, disputes, approvals). Gated to admins, so
  // the per-queue count fan-out never runs for a plain couple.
  /*
    🔴 `null` MEANS "WE COULD NOT READ IT", AND IT IS NOT THE SAME AS 0.
    This was `let adminOpenTotal = 0` with `= 0` again in the catch, so a failed
    digest read reached the board as a confident zero and the tile said the
    queues were clear. `count === null` means NOT MEASURED — filing an
    unmeasured queue under "nothing needs you" puts it in the one place a
    person has been told they need not look.
  */
  let adminOpenTotal: number | null = 0;
  if (roles.hasAdminAccess) {
    try {
      const digest = await getAdminQueueDigest();
      for (const [key, meta] of Object.entries(ADMIN_QUEUE_META)) {
        if (meta.lane === 'support') continue;
        /*
          🪤 AND THE SAME TRAP LIVES ONE LEVEL DOWN, PER QUEUE. A queue whose
          own read failed arrives here as `count: null`, and `?? 0` would fold
          it into the sum as a confident zero — the total would then look
          measured while one lane inside it was never read. One unreadable
          queue makes the WHOLE number unreadable, because a sum missing an
          unknown addend is not a smaller sum, it is not a number.
        */
        const count = digest[key]?.count;
        if (count === null || count === undefined) {
          adminOpenTotal = null;
          break;
        }
        if (adminOpenTotal !== null) adminOpenTotal += Math.max(0, count);
      }
    } catch {
      // The read failed. Say so — do not report a clear desk.
      adminOpenTotal = null;
    }
  }

  /* The cross-event rollup (`needsTotal`) and the busiest-first `watchRows`
     list are GONE, not moved. Both existed to feed The Watch tile and the
     one-event nudge banner; The Watch went with the strip-to-events change and
     the banner is retired below, so each was computing a number that nothing
     rendered. `decisionByEvent` is now read straight by the cards. */

  // STORYTELLER doorway signal — does this account already author chapters?
  // Real head-count on the user's own creator_chapters rows (owner-scoped RLS).
  // ≥1 chapter → the Spaces tile shows a plain "Your Story" doorway row;
  // 0 chapters → the "Become a Storyteller" promo row IS the doorway (creator
  // readiness verdict 2026-07-16 B4 + the owner's home-promo requirement —
  // exactly ONE entry either way). Graceful-degrade to 0 (promo renders)
  // rather than the error boundary.
  let chapterCount = 0;
  // Which FINISHED celebrations this account has already turned into a posted
  // story — the Unpublished / Published split below (owner 2026-08-20).
  // `null` = NOT MEASURED, which is a different thing from "none", and the
  // split degrades to a single shelf rather than inviting somebody to write a
  // story they have already written.
  try {
    const { data, error } = await supabase
      .from('creator_chapters')
      .select('event_id, status')
      .eq('user_id', user.id);
    if (error) console.error('[supabase-error] app/dashboard/(launcher)/page.tsx · from:creator_chapters.select', error);
    if (!error) {
      chapterCount = ((data ?? []) as unknown[]).length;
    } else {
      logQueryError('Launcher (creator_chapters count)', error, { user_id: user.id }, 'graceful_degrade');
    }
  } catch {
    // ⚠ 0, NOT null — AND THAT DIFFERS FROM ITS THREE NEIGHBOURS ON PURPOSE.
    // adminOpenTotal / alagaCount / connectionCount all degrade to null so the
    // surface says "we do not know" rather than reporting a clear desk. This one
    // degrades to 0 because the doorway is exactly one entry either way: 0 renders
    // the "Become a Storyteller" promo instead of an error boundary.
    // ⚖ THE COST, STATED: an author who HAS chapters is shown a promo telling them
    // to start, and loses the link to their own page. Accepted — but do NOT copy
    // this pattern to a count that feeds a number or a list.
    chapterCount = 0;
  }

  /*
    WHICH FINISHED CELEBRATIONS HAVE THEIR STORY WRITTEN.

    🔑 THE STORY OF AN EVENT IS THE EVENT'S OWN STORY PAGE — the one Setnayan
    drafts from the day's photos and schedule and the couple then corrects. It is
    NOT a Storyteller chapter.

    This read used to ask `creator_chapters` instead, and that was the whole of
    the owner's confusion (2026-08-22: *"isn't that the editorial. the story?"*).
    A chapter is a PERSON's own write-up ABOUT a day, on a blank page, and one day
    can have several — including one from a supplier who worked it. The event's
    story page is Setnayan's write-up OF that day, one per celebration, created
    automatically. They are separate records; nothing copies between them.

    ⚠ THE OLD MEASURE MADE THE SHELF LIE. A couple could compose and publish
    their whole story page and My Events still filed the celebration under
    "Untold", still offering *"Write the story of <name>"* — pointing at the OTHER
    door, where the box opens blank and they are asked to write the same day up a
    second time from memory. Two buttons in the product read "Write the story" and
    went to different screens.

    `null` still means NOT MEASURED, which is a different thing from "none": the
    split degrades to a single shelf rather than inviting somebody to write a
    story they have already written.
  */
  let storyEventIds: Set<string> | null = null;
  try {
    const { data, error } = await supabase
      .from('event_editorial')
      .select('event_id, status')
      .eq('status', 'published');
    if (error) console.error('[supabase-error] app/dashboard/(launcher)/page.tsx · from:event_editorial.select', error);
    if (!error) {
      storyEventIds = new Set(
        ((data ?? []) as Array<{ event_id: string | null }>)
          .filter((r) => r.event_id)
          .map((r) => r.event_id as string),
      );
    }
    // A REFUSED read leaves it null on purpose — see above. Supabase resolves
    // with { error } rather than throwing, so the `if (!error)` is the guard
    // that matters here; the catch below only covers a transport failure.
  } catch {
    storyEventIds = null;
  }

  // FINISHED SPLITS IN TWO (owner 2026-08-20: *"change it to unpublished and
  // published. They get to choose on the unpublish which they will make a story
  // of."*). Same shelf, same order, same cards — the question added is whether
  // the day has been written up yet.
  const {
    unpublished: unwritten,
    published: written,
    measured: storiesMeasured,
  } = splitFinishedByStory(finished, storyEventIds);

  // PEOPLE · Alaga — the dependants this account holds. Both gates are checked
  // BEFORE the query, so while NEXT_PUBLIC_DEPENDENT_PEOPLE is off (production
  // today) this costs nothing: no privacy-control read, no `dependents` read.
  // A denied/failed read leaves the count null, and a null count renders NO row
  // — an RLS denial and an empty table are the same value, so "0" is never
  // asserted from a read we could not prove was permitted.
  let alagaCount: number | null = null;
  if (
    dependentPeopleEnabled() &&
    (await isDataPrivacyControlActive('dependent_minor_profiles'))
  ) {
    try {
      const { count, error } = await supabase
        .from('dependents')
        .select('dependent_id', { count: 'exact', head: true });
      if (error) console.error('[supabase-error] app/dashboard/(launcher)/page.tsx · from:dependents.select', error);
      if (!error) alagaCount = count ?? 0;
    } catch {
      alagaCount = null;
    }
  }

  // PEOPLE · Connections — confirmed first-degree edges. Counsel-gated flag, so
  // again: flag off (production today) = no query at all. RLS on
  // `person_connections` already scopes the read to edges this user is in.
  let connectionCount: number | null = null;
  if (peopleConnectionsEnabled()) {
    try {
      const { count, error } = await supabase
        .from('person_connections')
        .select('connection_id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .is('deleted_at', null);
      if (error) console.error('[supabase-error] app/dashboard/(launcher)/page.tsx · from:person_connections.select', error);
      if (!error) connectionCount = count ?? 0;
    } catch {
      connectionCount = null;
    }
  }
  // TRUE when /dashboard/people renders something interactive. With both flags
  // off that route short-circuits to its "coming soon" PeoplePreview, so the
  // home must not advertise it as a destination.
  const peoplePageIsLive = alagaCount != null || connectionCount != null;

  // EVENT CARD SCENES — the per-type hero the create-event picker already uses,
  // same precedence (admin `hero_photo_url` → repo `/event-types/<key>.webp`).
  // ONE cached vocab read for the whole render tree; falls back to the constant
  // roster on error, and a type with no asset at all lands on the deterministic
  // branded gradient inside <EventScene> rather than a wrong stand-in photo.
  const eventTypeHero = new Map<string, string>();
  try {
    for (const t of await getEventTypeVocab()) {
      eventTypeHero.set(t.key, eventTypePhotoSrc(t));
    }
  } catch {
    // Graceful-degrade: EventScene falls back to `/event-types/<key>.webp` and
    // then to the gradient, so the band always renders.
  }
  const heroFor = (type: string) =>
    eventTypeHero.get(type) ?? `/event-types/${type}.webp`;

  // THE EVENT'S OWN HERO — the card's correct picture whenever it exists.
  // `events.landing_page_hero_image_url` is the couple's guest-site hero,
  // stored as an `r2://bucket/key` ref, so it has to be presigned before it
  // can be an <img src>. It is NULL on every event in prod today, which is
  // exactly why the type stock photo needed the per-event treatment as well:
  // this layer is the right long-term answer and becomes true for free as
  // couples fill in their sites, but it fixes nothing on its own yet.
  //
  // ⚠ Deliberately NOT folded into fetchUserEvents(): that helper is React
  // cache()d and shared by all four dashboard layouts, and its own comment
  // records that one bad column there empties the event switcher app-wide.
  // This read is isolated and failure-tolerant — an empty map just means every
  // card falls back to the type scene, which is the state of the world today.
  const ownHeroById = new Map<string, string>();
  const cardEventIds = [
    ...new Set([...upcoming, ...finished].map((e) => e.event_id)),
  ];
  if (cardEventIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('event_id, landing_page_hero_image_url')
        .in('event_id', cardEventIds)
        .not('landing_page_hero_image_url', 'is', null);
      if (error) {
        logQueryError(
          'Launcher (events.landing_page_hero_image_url SELECT)',
          error,
          { user_id: user.id },
          'graceful_degrade',
        );
      } else {
        const rows = (data ?? []) as Array<{
          event_id: string;
          landing_page_hero_image_url: string | null;
        }>;
        // Presign in parallel — each is a local signing operation, but they
        // are still N of them and a card row can hold a handful of events.
        const signed = await Promise.all(
          rows.map((r) =>
            displayUrlForStoredAsset(siteMediaServeRef(r.landing_page_hero_image_url)).catch(
              () => null,
            ),
          ),
        );
        rows.forEach((r, i) => {
          // The column is host-writable straight through PostgREST and any
          // non-`r2://` value passes through displayUrlForStoredAsset
          // unchanged, so what lands in an <img src> gets narrowed to an
          // actual image URL first.
          const src = renderableImageSrc(signed[i]);
          if (src) ownHeroById.set(r.event_id, src);
        });
      }
    } catch (caught) {
      logQueryError(
        'Launcher (own hero resolve threw)',
        caught instanceof Error ? caught : new Error(String(caught)),
        { user_id: user.id },
        'graceful_degrade',
      );
    }
  }

  const spaces: SpaceCardProps[] = [];
  // SPACES → the vendor's actual shop(s), by name. One card per shop the
  // user owns or is on the team of (owner: "show what shop we have"), so a
  // multi-shop vendor sees each business by name instead of a single generic
  // "Your shop" tile. Logo when set; the store glyph otherwise.
  const inquiryLabel = (n: number) =>
    `${n} new ${n === 1 ? 'inquiry' : 'inquiries'}`;
  const unreadChatLabel = (n: number) =>
    `${n} unread ${n === 1 ? 'chat' : 'chats'}`;
  // A shop needs a reply for either a brand-new inquiry OR an unread message in
  // an accepted chat. New inquiries lead the line (they gate the conversation);
  // unread chats fall through.
  const shopAttention = (inquiries: number, unread: number) =>
    inquiries > 0
      ? inquiryLabel(inquiries)
      : unread > 0
        ? unreadChatLabel(unread)
        : undefined;
  const shopNeedCount = (vpId: string) =>
    (inquiryByShop.get(vpId) ?? 0) + (unreadByShop.get(vpId) ?? 0);
  if (roles.hasVendorAccess) {
    // Cap the number of shop tiles so a many-shop vendor's section stays short;
    // the rest collapse into a single "N more shops" tile. Rank shops that need
    // a reply first so a waiting shop is never hidden behind the cap, and the
    // "more" tile still surfaces what's waiting among the shops it hides.
    const MAX_SHOP_CARDS = 3;
    const ranked = [...roles.vendorProfiles].sort(
      (a, b) =>
        shopNeedCount(b.vendor_profile_id) - shopNeedCount(a.vendor_profile_id),
    );
    const shown = ranked.slice(0, MAX_SHOP_CARDS);
    const hidden = ranked.slice(MAX_SHOP_CARDS);
    // 🪤 `logo_url` DOES NOT HOLD A URL. It holds an `r2://bucket/key` reference
    // by design, and a browser cannot load that scheme — so passing it straight
    // to an <img> fails silently and the card falls back to the generic shop
    // glyph. The owner uploaded a logo, saw the glyph, and reported it missing.
    // Nothing errored: a broken <img> is not an exception.
    //
    // The event-hero block ~50 lines above already resolves the same way; the
    // shop cards were simply missed. Resolved in ONE batch (at most 3 cards) so
    // this stays a single await, matching that block. `.catch(() => null)`
    // mirrors it too: a signing hiccup degrades to the glyph rather than
    // breaking the whole launcher.
    const shopLogoUrls = await Promise.all(
      shown.map((vp) =>
        vp.logo_url
          ? displayUrlForStoredAsset(vp.logo_url).catch(() => null)
          : Promise.resolve(null),
      ),
    );
    for (const [i, vp] of shown.entries()) {
      spaces.push({
        id: vp.vendor_profile_id,
        href: '/vendor-dashboard',
        icon: Store,
        logoUrl: shopLogoUrls[i] ?? null,
        title: vp.business_name,
        subtitle: 'Vendor shop',
        tone: 'default',
        attention: shopAttention(
          inquiryByShop.get(vp.vendor_profile_id) ?? 0,
          unreadByShop.get(vp.vendor_profile_id) ?? 0,
        ),
      });
    }
    if (hidden.length > 0) {
      const hiddenInquiries = hidden.reduce(
        (sum, vp) => sum + (inquiryByShop.get(vp.vendor_profile_id) ?? 0),
        0,
      );
      const hiddenUnread = hidden.reduce(
        (sum, vp) => sum + (unreadByShop.get(vp.vendor_profile_id) ?? 0),
        0,
      );
      spaces.push({
        id: 'more-shops',
        href: '/vendor-dashboard',
        icon: Store,
        title: `${hidden.length} more ${hidden.length === 1 ? 'shop' : 'shops'}`,
        subtitle: 'See all your shops',
        tone: 'default',
        attention: shopAttention(hiddenInquiries, hiddenUnread),
      });
    }
  }
  if (roles.hasAdminAccess) {
    spaces.push({
      href: '/admin',
      icon: ShieldCheck,
      title: 'HQ',
      subtitle: 'Admin console',
      tone: 'admin',
      /*
        🔴 THREE STATES, NOT TWO. A number worth acting on, a desk that is
        genuinely clear (say nothing — silence is correct there), and a read
        that FAILED. The third one used to look exactly like the second. It now
        says so, because "we could not check" is a reason to open the console,
        and the whole point of this line is to tell someone whether to.
      */
      attention:
        adminOpenTotal === null
          ? "Couldn't check the queues"
          : adminOpenTotal > 0
            ? `${adminOpenTotal} awaiting review`
            : undefined,
    });
  }

  // SAMAHAN rows — the user's communities as compact SpaceRows (owner
  // 2026-07-15 composable-event model). Organizer subtitle carries the member
  // count; a plain member reads just "Member". Capped at 3 (MAX_SHOP_CARDS
  // idiom) with a "N more samahans" overflow row into the index. RA 10173: only
  // display name + role + count reach the DOM — never a user UUID or email.
  const samahanSubtitle = (c: CommunityWithRole) =>
    c.role === 'organizer'
      ? `Organizer · ${c.member_count} ${c.member_count === 1 ? 'member' : 'members'}`
      : 'Member';
  const MAX_SAMAHAN_CARDS = 3;
  const samahanRows: SpaceCardProps[] = communities
    .slice(0, MAX_SAMAHAN_CARDS)
    .map((c) => ({
      id: `samahan-${c.community_id}`,
      href: `/dashboard/samahan/${c.community_id}`,
      icon: Users,
      title: c.name,
      subtitle: samahanSubtitle(c),
      tone: 'default' as const,
    }));
  if (communities.length > MAX_SAMAHAN_CARDS) {
    const moreCount = communities.length - MAX_SAMAHAN_CARDS;
    samahanRows.push({
      id: 'more-samahans',
      href: '/dashboard/samahan',
      icon: Users,
      title: `${moreCount} more ${moreCount === 1 ? 'samahan' : 'samahans'}`,
      subtitle: 'See all your samahans',
      tone: 'default',
    });
  }

  /*
    ⚠ THE INLINE `commandItems` INDEX THAT LIVED HERE IS GONE (One top bar,
    2026-08-14). It is built ONCE now, for every signed-in tree, in
    `app/_components/frontdoor/command-data.ts`, and the shared top bar renders
    the palette. Two builders would have listed different things on /dashboard
    than inside a wedding, with nothing to notice — and the palette was
    reachable on this ONE screen out of ~300.
  */
  /*
    ⚠ THE RAIL'S OWN READS (unread count + switcher) MOVED BACK TO
    `(launcher)/layout.tsx` on 2026-08-14. They came down here on 2026-07-30 so
    the one-line rail could sit inside the page; the bar is chrome again, and
    chrome belongs to the layout — where four other trees now render the very
    same one.
  */
  // ── Board tiles — REAL aggregates only, all already computed above ─────────
  // `soonest` is the nearest DATED upcoming event; undated events legitimately
  // have nothing to say here, so the line is omitted rather than guessed.
  const soonest = [...upcoming]
    .filter((e) => dateKey(e))
    .sort((a, b) => (dateKey(a)! < dateKey(b)! ? -1 : 1))[0];
  const shopNeedsTotal = roles.hasVendorAccess
    ? roles.vendorProfiles.reduce(
        (sum, vp) => sum + shopNeedCount(vp.vendor_profile_id),
        0,
      )
    : 0;
  const topShop = roles.hasVendorAccess
    ? [...roles.vendorProfiles].sort(
        (a, b) =>
          shopNeedCount(b.vendor_profile_id) -
          shopNeedCount(a.vendor_profile_id),
      )[0]
    : undefined;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pb-10 sm:pt-10 lg:px-8">
      {/* ONE LINE, ONE CLAIM-FREE TITLE (owner 2026-08-18 · 2026-08-19).
          No eyebrow, no grey tail — that was the 08-18 ruling and it stands.

          ⚠ AND THE ZERO-STATE HAD TO GO, because this page is now ONLY events.
          It read "Let's set up your first event." whenever `boardEvents` was
          empty — but `fetchUserEvents` GRACEFULLY DEGRADES TO `[]` ON EVERY
          ERROR (lib/events.ts, "collapse to graceful-degrade-always" after a
          re-throw crashed every dashboard surface twice). So an empty list
          cannot be told apart from a REFUSED READ.

          While four other blocks rendered, that was a bad line in a corner. On
          an events-only page it is the ENTIRE SCREEN: somebody with six
          weddings, whose read just failed, is told to set up their first one
          and shown nothing else.

          The FINISHED shelf below already states this rule — "an empty shelf
          cannot be told apart from a refused read — the line therefore says
          what this shelf is FOR and never that you have none." The title now
          obeys the same rule its own page wrote: it NAMES the page and makes no
          claim about how many events you have, so it is true in both states.
          The invitation to create one is the top bar's "+ Create event" (and,
          on phones, the bottom bar's ➕ and the dashed New-event card below). */}
      {/* ⚠ THE TITLE IS NO LONGER PAINTED (owner 2026-08-20: "Remove Your Events
          on My Events. we don't need that text.").

          It is not DELETED, it is unpainted. The top bar already names this
          place — the nav entry `customer.account.events` reads "Events" — so
          the h1 was the same word twice, one under the other, which is the
          shape the 2026-08-18 one-line ruling was aimed at in the first place.

          🔑 BUT A PAGE STILL NEEDS A NAME. Stripping the h1 outright leaves the
          document with no heading at all: a screen-reader user landing here
          would be told nothing about where they are, and the heading outline
          would start at the "Coming up" h2 with no parent. `sr-only` is the
          honest version of "we don't need that text" — nobody SEES it, the page
          still says what it is. The <title> metadata already says "Your events"
          and stays in step with it.

          The anti-regression guards on the greeting eyebrow and the
          "Pick up where you left off" tail still apply and still pass: what was
          removed is the visible duplicate, never the page's identity. */}
      <h1 className="sr-only">Your events</h1>

      {/* THE COMPOSER IS RETIRED (owner 2026-08-20: "we do not need it there
          because create event is already found on the top nav"). The
          "What's your event?" row was asked for on 2026-08-07, when creation
          had only three SMALL doors; the top bar's full "+ Create event"
          button arrived 2026-08-15 and overtook that premise. It also read as
          a second search bar one row under the real one — the owner himself
          misread it — so keeping it cost more than it invited. Creation stays
          reachable here via the dashed New-event card, the phone pill's ➕,
          the top bar and ⌘K. */}


      {/* ⚠ THE ONE-EVENT NUDGE BANNER IS RETIRED (owner 2026-08-20: "for the
          9 things need you - Cale & Ice, can't we just place a counter on the
          event card for that event itself on that page?").

          🔑 HIS INSTINCT IS A REAL DEFECT, NOT A PREFERENCE. The banner rendered
          `watchRows[0]` — the BUSIEST event and no other. `watchRows` is built
          from every active event and then sorted, so an account with two events
          that both need something showed one number and silently swallowed the
          rest. The count was on the page; the OTHER counts were nowhere, and
          nothing on the second event's card hinted that anything was waiting.

          ⚖ THIS REVERSES AN OWNER RULING, AND THE PREMISE IT RESTED ON HAS
          EXPIRED. GlassEventCard's docblock records owner 2026-07-15: attention
          counts live in ONE home (The Watch tile / the mobile nudge row), never
          on a card. That was right while a home existed — The Watch listed EVERY
          event with its own count. Stripping this page to events (2026-08-19)
          deleted The Watch tile AND the "Needs you" board tile, and what
          survived was this banner, which is not a home for the numbers: it is a
          home for ONE of them. "One home for overdue counts" quietly became
          "one count", and the ruling outlived the thing that made it correct.

          Per-card is now the only place that can carry all of them, so the
          count travels with the event it belongs to, on every shelf and at
          every width. */}
      {/* COMING UP — the first of the board's TWO ALWAYS-PRESENT shelves
          (owner 2026-08-13). Glass cards, soonest first since 2026-09-24 (the
          collection template), UNDATED at the tail reading "Date to be set".
          The FINISHED shelf follows as its own section — it is no longer hidden
          behind a "Show all" toggle. */}
      {/* NOW HAPPENING — the day itself (owner 2026-08-21).
          ⚠ IT RENDERS EVEN WHEN EMPTY, and that REVERSES the call this block
          shipped with. The first cut hid the row on every ordinary day, on the
          reasoning that "a permanent 'nothing today' row would be the loudest
          thing on the board saying the least". The owner ruled otherwise the
          same day: *"we show the different rows and leave it blank when no
          event is there."*
          🔑 AND HIS CALL IS THE BETTER ONE FOR A BOARD PEOPLE LEARN. Five rows
          that are always in the same place can be navigated from memory; rows
          that appear and vanish make the page a different shape every visit, so
          a person cannot learn where anything lives. The empty line says what
          the row is FOR — never that they have nothing, because
          `fetchUserEvents` degrades to `[]` on an RLS denial and an empty read
          is indistinguishable from an empty life. */}
      <section
        id="now"
        className="sn-reveal mb-7 scroll-mt-24 sm:mb-6"
        style={{ animationDelay: '0.36s' }}
      >
        <SectionLabel
          sub="today"
          info="Your celebration is running today. It leaves this row on its own tomorrow."
        >
          Now happening
        </SectionLabel>
        {happeningNow.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 bg-white/[0.35] px-4 py-5 text-[13px] text-[color:var(--sn-ink-500)]">
            On the day itself, your celebration moves up here — and moves on by
            itself the morning after.
          </p>
        ) : null}
        <CollectionGrid>
          {happeningNow.map((event, i) => (
            <BoardCardWithMenu key={event.event_id} event={event}>
              <GlassEventCard
                event={event}
                pct={progressByEvent.get(event.event_id) ?? null}
                heroSrc={heroFor(event.event_type)}
                ownHeroSrc={ownHeroById.get(event.event_id) ?? null}
                index={i}
                todayISO={todayISO}
                summary={decisionByEvent.get(event.event_id)}
                hasMenu={event.member_type === 'couple'}
              />
            </BoardCardWithMenu>
          ))}
        </CollectionGrid>
      </section>

      <section
        id="events"
        className="sn-reveal mb-7 scroll-mt-24 sm:mb-6"
        style={{ animationDelay: '0.4s' }}
      >
        <SectionLabel
          sub="yours to run"
          info="Everything you’re organising or were invited to, soonest first. Put one away and it hides here until you switch it back on."
          action={
            <PlanningHeaderActions
              count={upcoming.length}
              putAwayOn={showPutAway}
              putAwayCount={putAway.length}
            />
          }
        >
          Planning
        </SectionLabel>
        <ClashNotice clashes={clashes} />
        {/* THE COLLECTION TEMPLATE (owner-approved 2026-09-24): soonest first,
            undated last, ten per page. The dashed tile closes the grid only
            while the page has room — a full page's way in is the header (+).
            ⚠ THE EMPTY STATE MAKES NO ZERO-CLAIM: `fetchUserEvents` degrades
            to [] on a refused read, and a person with finished celebrations
            has an empty Planning shelf too — so it never says "no events". */}
        {upcoming.length === 0 ? (
          <CollectionEmptyState
            title="Start a celebration"
            body="Guests, suppliers, the day itself — everything you plan gathers here, soonest first."
            action={
              <Link
                href="/dashboard/create-event"
                className="sn-press inline-block rounded-full bg-ink px-[18px] py-[9px] text-[13px] font-semibold text-white transition-colors hover:bg-black"
              >
                Create an event
              </Link>
            }
          />
        ) : (
        <CollectionGrid>
          {upcomingOnPage.map((event, i) => (
            <BoardCardWithMenu key={event.event_id} event={event}>
              <GlassEventCard
                event={event}
                pct={progressByEvent.get(event.event_id) ?? null}
                heroSrc={heroFor(event.event_type)}
                ownHeroSrc={ownHeroById.get(event.event_id) ?? null}
                index={i}
                todayISO={todayISO}
                summary={decisionByEvent.get(event.event_id)}
                hasMenu={event.member_type === 'couple'}
              />
            </BoardCardWithMenu>
          ))}
          {planningPage.hasRoomForNewTile ? (
            <NewEventCard delay={0.5 + upcomingOnPage.length * 0.08} />
          ) : null}
        </CollectionGrid>
        )}
        <CollectionPager
          label="Planning pages"
          rangeLabel={planningPage.rangeLabel}
          links={planningPage.stops.map((stop) =>
            stop.kind === 'gap'
              ? stop
              : {
                  kind: 'page' as const,
                  href: planningPageHref(stop.page, showPutAway),
                  label: stop.label,
                  current: stop.current,
                },
          )}
        />
        {/* THE ONES THEY PUT AWAY — only when asked for. Muted, and each still
            carries its own ⋯ menu, because the one thing a person wants here is
            "bring it back", which is exactly what that menu already offers on an
            archived row. */}
        {showPutAway && putAway.length > 0 ? (
          <div className="mt-4 border-t border-dashed border-ink/12 pt-4">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--sn-ink-400)]">
              Put away
            </p>
            <CollectionGrid>
              {putAway.map((event, i) => (
                <BoardCardWithMenu key={event.event_id} event={event}>
                  <GlassEventCard
                    event={event}
                    pct={progressByEvent.get(event.event_id) ?? null}
                    heroSrc={heroFor(event.event_type)}
                    ownHeroSrc={ownHeroById.get(event.event_id) ?? null}
                    finished
                    index={upcomingOnPage.length + i}
                    todayISO={todayISO}
                    summary={decisionByEvent.get(event.event_id)}
                    hasMenu={event.member_type === 'couple'}
                  />
                </BoardCardWithMenu>
              ))}
            </CollectionGrid>
          </div>
        ) : null}
        {/* ⚠ THE ALL-EVENTS SUBSCRIPTION BLOCK STOOD HERE AND IS RETIRED
            (owner 2026-08-22: *"block delete."*). Adding a celebration to a
            phone calendar is now a PER-EVENT action in each card's "⋯" menu,
            which is where the owner asked for it — *"adding an event to a
            calendar is not all events but just per event."*

            🔑 KNOW WHAT WAS TRADED, so nobody re-derives this as a bug. The
            block handed out one `webcal:` link the phone RE-READ, so moving a
            date moved it in their calendar too. A per-card .ics is a copy
            taken once and never checked again. That loss was stated to the
            owner and accepted; it is a decision, not an oversight. Prod held
            one token, never once read, so nothing live was broken.
            Migration 20271157440480. */}
      </section>

      {/* WORTH PLANNING — the days that come around for this person (owner
          2026-08-21: the Your Year menu is retired and its contents live on the
          board).
          🔑 NOTHING HERE IS AN EVENT YET, and that is the whole reason it is a
          separate shelf rather than more cards on Planning: Planning holds
          celebrations that EXIST, this holds days that do not. Merging them
          would have a person looking for their wedding among suggestions. */}
      <section
        id="worth-planning"
        className="sn-reveal mb-7 scroll-mt-24 sm:mb-6"
        style={{ animationDelay: '0.44s' }}
      >
        <SectionLabel
          sub="not events yet"
          info="Days that come around for you — birthdays, anniversaries, the seasons that book out early. Nothing here is an event yet."
        >
          Worth planning
        </SectionLabel>
        <YearMomentsStrip userId={user.id} heading={null} />
      </section>

      {/* FINISHED, IN TWO SHELVES (owner 2026-08-13, split 2026-08-20).
          It used to be the hidden half of the Events block, revealed by a
          "Show all" link: **a thing you have to switch on reads as a thing that
          might not be there**, and what was behind it is somebody's memories.
          Then the owner asked for Your Story to live here: *"we have a place
          there for finished. change it to unpublished and published. They get
          to choose on the unpublish which they will make a story of."*

          🔑 THE TWO WORDS ARE ABOUT THE STORY, NOT THE CELEBRATION. Every day
          on both shelves is finished and kept; what is unpublished is the
          chapter about it. Each shelf therefore says so in a sentence, and
          neither ever calls a wedding "unpublished" on its own.

          🪤 AND THE SPLIT ONLY HAPPENS WHEN THE STORIES WERE MEASURED. A
          refused read of somebody's own chapters is indistinguishable from
          having written none, and acting on that would put a "Write the story"
          button beside a story they already wrote. Unmeasured ⇒ one shelf, the
          board exactly as it was.

          🔑 THE EMPTY STATE MAKES NO ZERO-CLAIM. `fetchUserEvents`
          graceful-degrades to `[]` on every error including an RLS denial, so an
          empty shelf cannot be told apart from a refused read — the line
          therefore says what this shelf is FOR and never that you have none. */}
      <section
        id="finished"
        className="sn-reveal mb-7 scroll-mt-24 sm:mb-6"
        style={{ animationDelay: '0.46s' }}
      >
        <SectionLabel
          sub={storiesMeasured ? 'no story written yet' : 'kept for good'}
          info={
            storiesMeasured
              ? 'The day has passed and its story isn’t written. Pick the ones worth telling.'
              : 'Celebrations move here on their own once the day has passed.'
          }
        >
          {storiesMeasured ? 'Untold' : 'Ended'}
        </SectionLabel>
        {unwritten.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 bg-white/[0.35] px-4 py-5 text-[13px] text-[color:var(--sn-ink-500)]">
            {storiesMeasured
              ? 'Celebrations move here on their own once the day has passed — this is where you pick the ones to tell. Nothing you keep is ever taken away.'
              : 'Celebrations move here on their own once the day has passed. Nothing you keep is ever taken away.'}
          </p>
        ) : (
          <>
            {/* THE CARD IS THE CHOICE (owner 2026-08-22). This shelf used to pair
                a plain card — opening the event dashboard — with a SEPARATE
                chip below reading "Write the story of X". Two controls for one
                celebration, and the chip was the one that actually mattered.
                Pressing the card itself now opens the story page directly, for
                exactly the same events and under exactly the same rule the chip
                used to gate on: the story has been measured, and this account
                organises the celebration. Guests, and any board where the read
                was refused, keep the ordinary card → event-dashboard behaviour
                — sending either into a stranger's editor, or into an editor a
                refused read cannot vouch for, is not this shelf's call to make. */}
            {/* DESKTOP — the same glass cards, muted scene, reading
                "Celebrated". */}
            <CollectionGrid>
              {unwritten.map((event, i) => (
                <BoardCardWithMenu key={event.event_id} event={event} finished>
                  <GlassEventCard
                    event={event}
                    pct={progressByEvent.get(event.event_id) ?? null}
                    heroSrc={heroFor(event.event_type)}
                    ownHeroSrc={ownHeroById.get(event.event_id) ?? null}
                    finished
                    index={upcoming.length + i}
                    todayISO={todayISO}
                    summary={decisionByEvent.get(event.event_id)}
                    hasMenu={event.member_type === 'couple'}
                    storyHref={
                      storiesMeasured && canWriteStoryFor(event)
                        ? `/dashboard/${event.event_id}/story`
                        : undefined
                    }
                  />
                </BoardCardWithMenu>
              ))}
            </CollectionGrid>
          </>
        )}
      </section>

      {/* TOLD — the celebrations that are now chapters.
          ⚠ IT RENDERS EVEN WHEN EMPTY (owner 2026-08-21: *"we show the different
          rows and leave it blank when no event is there"*). It used to vanish
          unless there was something on it, which made the board a different
          shape for every account.
          🔑 BUT THE EMPTY LINE MUST NOT CLAIM "YOU HAVE NONE", AND THERE ARE TWO
          DIFFERENT REASONS IT CAN BE EMPTY. When the stories were MEASURED, the
          shelf is honestly empty and the line can invite them to write one. When
          the read was REFUSED, `unwritten` holds everything and `written` holds
          nothing — telling that person they have told no stories would be
          asserting a fact from a read that never completed, beside a shelf that
          is silently claiming their published celebrations are unpublished. So
          the unmeasured line says what the row is FOR and nothing about them. */}
      <section
        id="published"
        className="sn-reveal mb-7 scroll-mt-24 sm:mb-6"
        style={{ animationDelay: '0.48s' }}
      >
        <SectionLabel
          sub="in your story"
          info="These days are chapters in your story now."
        >
          Told
        </SectionLabel>
        {written.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 bg-white/[0.35] px-4 py-5 text-[13px] text-[color:var(--sn-ink-500)]">
            {storiesMeasured
              ? 'The celebrations you write up land here, as chapters of your story.'
              : 'This is where the celebrations you have written up live.'}
          </p>
        ) : null}
        <CollectionGrid>
          {written.map((event, i) => (
            <BoardCardWithMenu key={event.event_id} event={event} finished>
              <GlassEventCard
                event={event}
                pct={progressByEvent.get(event.event_id) ?? null}
                heroSrc={heroFor(event.event_type)}
                ownHeroSrc={ownHeroById.get(event.event_id) ?? null}
                finished
                index={upcoming.length + unwritten.length + i}
                todayISO={todayISO}
                summary={decisionByEvent.get(event.event_id)}
                hasMenu={event.member_type === 'couple'}
              />
            </BoardCardWithMenu>
          ))}
        </CollectionGrid>
        {/* ⚠ ONLY WHEN THERE IS SOMETHING TO READ. "These days are told"
            beside an empty shelf names days that are not there.
            🔑 THIS LINE USED TO SAY "chapters" AND POINT AT THE STORYTELLER.
            Both shelves are about the event's OWN story page now, so pointing
            at the composer for a different kind of writing was the confusion
            itself. Memories is where a told day is read back: its Editorials
            shelf opens each celebration's story directly.
            ⚠ THE STORYTELLER IS NOT STRANDED — the account menu carries "Your
            Story". But see the note on `chapterCount`: the board's own
            /dashboard/creator link now lives ONLY in a component nothing
            renders, so the guard asserting the board has that door is
            currently satisfied by dead code. Flagged, not fixed here. */}
        {written.length > 0 ? (
          <p className="mt-3 text-[12px] text-[color:var(--sn-ink-500)]">
            These days are told —{' '}
            <Link href="/dashboard/library" className="underline decoration-ink/25 underline-offset-2 hover:text-ink">
              read them in Memories
            </Link>
            .
          </p>
        ) : (
          <p className="mt-3 text-[12px] text-[color:var(--sn-ink-500)]">
            <Link href="/dashboard/library" className="underline decoration-ink/25 underline-offset-2 hover:text-ink">
              Open Memories
            </Link>
          </p>
        )}
      </section>

      {/* #7b (gap G5): events auto-surfaced to this account + a one-tap Leave.
          Flag-gated so there is ZERO extra query while FEATURE_ACCOUNT_AUTOSURFACE
          is off (the default). Lives with EVENTS — it surfaces events. */}
      {accountAutosurfaceEnabled() ? (
        <div className="mb-7 sm:mb-6">
          <AutoSurfacedEvents userId={user.id} />
        </div>
      ) : null}


      {/* The phone thumb nav MOVED to `(launcher)/layout.tsx` + `(account)/layout.tsx`
          on 2026-08-23. Rendered from here it existed on exactly one route, so it
          disappeared the moment anyone used it. The page keeps its `pb-28` — the
          bar is still fixed over this content. */}
    </div>
  );
}


/**
 * Section header (proto .sec-h): sentence-case bold title with an optional
 * soft sub-caption from `sm` up; at base the mobile treatment — 14px w800 with
 * a trailing hairline rule filling the line (proto .mtitle). Optional
 * right-aligned action either way.
 */
/**
 * The (i) beside a shelf name. `<details>` — no client component, no state, no
 * hydration: it opens on the server-rendered page and works with JavaScript
 * off, which matters because this board is the first thing a person sees on a
 * venue's bad signal.
 *
 * 🔑 IT IS NEVER A LONE CIRCLE. `SectionLabel` renders it only when a sentence
 * was passed, so the failure the owner retired the old one for — a circle that
 * opens onto nothing — cannot occur here by construction rather than by care.
 */
function ShelfInfo({ children }: { children: string }) {
  return (
    <details className="group relative shrink-0">
      <summary
        className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-ink/20 text-[10px] font-bold italic leading-none text-[color:var(--sn-ink-500)] transition hover:border-ink/40 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sn-mulberry-600)] [&::-webkit-details-marker]:hidden"
        aria-label="What is this row?"
      >
        i
      </summary>
      <p className="absolute left-0 top-7 z-20 w-[min(17rem,72vw)] whitespace-normal rounded-xl border border-ink/12 bg-white p-3 text-[12.5px] font-normal leading-relaxed text-ink/75 shadow-lg">
        {children}
      </p>
    </details>
  );
}

/**
 * The switch that reveals put-away celebrations, and the count beside it.
 *
 * 🔑 THE COUNT IS THE POINT, not decoration. The board's previous hidden half
 * was retired in 2026-08-13 because *"a thing you have to switch on reads as a
 * thing that might not be there"*. Printing the number answers that before it
 * is asked: nothing is missing, two are put away, here is the switch.
 *
 * A link rather than a control: the shelf is server-rendered, so flipping it is
 * a navigation. Nothing is written down — putting an event away is the choice
 * that persists; looking at it again is not.
 */
function PutAwaySwitch({ on, count }: { on: boolean; count: number }) {
  return (
    <Link
      href={on ? '/dashboard#events' : '/dashboard?putaway=1#events'}
      aria-pressed={on}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${
        on
          ? 'border-[color:var(--sn-mulberry-600)] text-ink'
          : 'border-ink/15 text-[color:var(--sn-ink-500)] hover:border-ink/30 hover:text-ink'
      }`}
    >
      <span
        aria-hidden
        className={`relative h-[15px] w-[26px] rounded-full transition ${
          on ? 'bg-[color:var(--sn-mulberry-600)]' : 'bg-ink/15'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[11px] w-[11px] rounded-full bg-white shadow transition-all ${
            on ? 'left-[13px]' : 'left-[2px]'
          }`}
        />
      </span>
      {on ? 'Hide the ones I put away' : `Show the ${count} I put away`}
    </Link>
  );
}

/**
 * "You are expected in two places on this day."
 *
 * ⚠ IT NAMES THE DAY AND BOTH CELEBRATIONS, and stops there. It does not say
 * which to move, does not offer to move one, and is not styled as an error —
 * two celebrations on one day is a thing people genuinely do (a morning
 * christening and an evening reception), so this is information, not a fault.
 * The one thing it must never do is stay silent and let somebody find out on
 * the day.
 */
function ClashNotice({ clashes }: { clashes: DateClash[] }) {
  if (clashes.length === 0) return null;
  return (
    <ul className="mb-3 space-y-1.5">
      {clashes.map((c) => (
        <li
          key={c.dayISO}
          className="flex items-start gap-2 rounded-xl border border-[color:var(--sn-gold-700)]/25 bg-[color:var(--sn-gold-700)]/[0.06] px-3 py-2 text-[12.5px] leading-relaxed text-ink/80"
        >
          <CalendarClock
            aria-hidden
            className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[color:var(--sn-gold-700)]"
            strokeWidth={1.9}
          />
          <span>
            <b className="font-semibold">{shortDate(c.dayISO)}</b> holds{' '}
            {c.names.length === 2
              ? `${c.names[0]} and ${c.names[1]}`
              : `${c.names.slice(0, -1).join(', ')} and ${c.names[c.names.length - 1]}`}
            .
          </span>
        </li>
      ))}
    </ul>
  );
}


function SectionLabel({
  children,
  sub,
  info,
  action,
}: {
  children: ReactNode;
  /** Soft caption beside the title (desktop only), e.g. "yours to run". */
  sub?: string;
  /**
   * One full sentence saying what this shelf is, revealed by the (i).
   *
   * ⚠ THE OWNER RETIRED THE PAGE-HEADER (i) ON 2026-08-21 — *"a lone circle
   * explains nothing"* — and re-asked for one HERE the same day, per shelf.
   * It is not a reversal: that one sat beside a page name a person had already
   * read, and opened onto nothing. These five shelf names are new vocabulary,
   * and this circle only ever exists where a real sentence is passed. There is
   * deliberately no empty state: omit `info` and no circle renders at all.
   */
  info?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <h2 className="flex flex-1 items-center gap-2.5 whitespace-nowrap text-sm font-extrabold tracking-tight text-ink after:h-px after:flex-1 after:bg-ink/10 sm:flex-none sm:text-base sm:tracking-[-0.015em] sm:after:hidden">
          {children}
        </h2>
        {info ? <ShelfInfo>{info}</ShelfInfo> : null}
        {sub ? (
          <span className="hidden shrink-0 text-xs text-[color:var(--sn-ink-400)] sm:inline">
            {sub}
          </span>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * THE STANCE CHIP — "You organise this" / "You're invited".
 *
 * The one thing a card has to answer before it is pressed, because it decides
 * what is behind it: an organiser opens the event dashboard, an invited person
 * opens the event's own public page (their photos, their table, their RSVP —
 * with the money and plan surfaces absent, not present-and-refused).
 *
 * Rendered on EVERY card, not just the invited ones. An unexplained difference
 * between two cards is worse than a label on both — and "you organise this" is
 * the sentence that makes the other one legible.
 */
function StanceChip({ stance }: { stance: EventStance }) {
  const invited = stance === 'invited';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.08em] shadow-[0_2px_8px_rgba(30,26,18,0.08)] ${
        invited
          ? 'bg-[color:var(--sn-mulberry-100,rgba(194,78,37,0.14))] text-mulberry'
          : 'bg-white/85 text-[color:var(--sn-ink-500)]'
      }`}
    >
      {invited ? (
        <Mail aria-hidden className="h-[11px] w-[11px]" strokeWidth={2.25} />
      ) : (
        <HeartHandshake
          aria-hidden
          className="h-[11px] w-[11px]"
          strokeWidth={2.25}
        />
      )}
      {stanceLabel(stance)}
    </span>
  );
}

/**
 * One EVENTS glass card (owner-approved final design 2026-07-15). A frosted
 * panel over the warm paper — the Atelier + macOS-glass language (owner-locked
 * 2026-07-12) — carrying the same signals as the old timeline node: badge ·
 * monogram · place/date · gold progress ring · countdown · attention line.
 * The card jumps into the event dashboard — an allowed navigation.
 *
 * ⚠ EXCEPT ON THE UNTOLD SHELF (owner 2026-08-22), where `storyHref` sends it
 * straight to the celebration's own story page instead. See the prop's own
 * doc — the caller decides when, this component only ever obeys.
 *
 * Attention/overdue signals deliberately live ONLY in The Watch (desktop tile)
 * / the mobile nudge row now (owner 2026-07-15: one home for overdue counts) —
 * this card carries identity/type/date/progress, never a decision pill.
 */
function GlassEventCard({
  event,
  pct,
  heroSrc,
  ownHeroSrc = null,
  finished,
  index = 0,
  todayISO,
  summary,
  hasMenu = false,
  storyHref,
}: {
  event: EventWithRole;
  pct: number | null;
  /** This event's own decision summary. `undefined` ⇒ no pill — never a 0. */
  summary?: EventDecisionSummary;
  /** The board's PH-local day — the countdown and the shelf must share it. */
  todayISO: string;
  /** Resolved event-type hero (admin upload → repo asset) for the scene band.
   *  <EventScene> falls back to the branded gradient if it 404s. */
  heroSrc: string;
  /** The event's OWN presigned hero, when the couple has uploaded one. It
   *  outranks the type hero and suppresses the per-event treatment. */
  ownHeroSrc?: string | null;
  finished?: boolean;
  /** Position in the grid — drives the entrance-cascade + ring/count-up
   *  stagger delays (computed, never hardcoded per card). */
  index?: number;
  /** Reserve the scene band's top-right corner for the card menu. */
  hasMenu?: boolean;
  /**
   * THE UNTOLD SHELF'S OWN DESTINATION (owner 2026-08-22: "we want that gone
   * and directly jumps to the story maker upon pressing each untold event").
   * When set, the card opens the event's story page instead of its dashboard —
   * the separate "Write the story of X" chip that used to sit below the grid
   * is retired in favour of the card itself doing that job.
   *
   * The caller computes this (`storiesMeasured && canWriteStoryFor(event)`),
   * never this component: whether a guest, or an unmeasured board, gets sent
   * into somebody's story editor is a decision that belongs where the shelf's
   * other rules already live, not duplicated here.
   */
  storyHref?: string;
}) {
  const { badge, dateLabel, place, status, keptNote, stance, href, closedReason } =
    deriveEventView(event, pct, finished, todayISO);
  // The score is an organiser's number for a plan still in motion: never on an
  // invited card (whose plan is somebody else's), never on a finished one
  // (whose day has happened — a planning score on a celebrated day is the
  // board contradicting its own "Celebrated" badge one line up).
  const showRing = pct != null && stance !== 'invited' && !finished;
  const resolvedHref = storyHref ?? href;

  /*
    THE CARD IS THE COLLECTION CARD (build-sessions/STANDARD-collection-card.md,
    step 1). This function is now only PLANNING'S SLOT MAPPING — which event
    fact fills which slot. How a card is laid out lives in
    `@/app/_components/collection-card`, and the no-fork guard keeps it there.
  */
  return (
    <CollectionCard
      href={resolvedHref}
      inertReason={closedReason}
      muted={finished}
      index={index}
      reserveMenuCorner={hasMenu}
      /* THE SCENE (prototype `events()` → `.top`): the event's hero, scrimmed —
         the thing that makes an event imaginable instead of a stripe (owner
         2026-07-30). The couple's OWN hero when they have one; otherwise the
         same type hero (+ gradient fallback) the create-event picker uses,
         under the per-event treatment that keeps two events of one type from
         reading as the same photograph. Nothing new is invented, and a type
         with no asset gets its deterministic branded gradient, never another
         type's photo. */
      cover={
        <EventScene
          eventId={event.event_id}
          eventType={event.event_type}
          photoSrc={heroSrc}
          ownPhotoSrc={ownHeroSrc}
          muted={finished}
        />
      }
      /* Type badge + STANCE, one row: what kind of event this is, and which
         side of it you are on. */
      kicker={stance ? [badge, <StanceChip stance={stance} key="stance" />] : [badge]}
      /* The event's REAL monogram (uploaded / bespoke SVG · framed lockup ·
         lettered). Uploaded outranks custom per app-wide precedence;
         EventMonogram only reads monogram_custom_svg, so resolve it here. */
      mark={
        <EventMonogram
          event={{
            ...event,
            // SEC-3: gated on read — both columns are host-writable via PostgREST.
            monogram_custom_svg: resolveEventMonogramSvg(event),
          }}
          size="lg"
          shape="square"
          className={collectionMarkClass}
        />
      }
      starred={event.is_primary}
      title={event.display_name}
      /* Omitted (never guessed) when the event has neither a venue name nor an
         address. */
      place={place}
      meta={dateLabel ?? 'Date to be set'}
      /* THE COUNTER (owner 2026-08-20). Above the progress row so it is the
         first thing read after the date — what is waiting outranks how far
         along the plan is. Absent entirely when nothing waits. */
      attention={eventAttention(summary, stance)}
      progress={{
        pct: showRing ? (pct as number) : undefined,
        remainder: status,
        // The ring is the ONE place the figure prints (the old "N% planned"
        // text beside it was the D-6 double-print); this keeps the word for
        // screen readers.
        srLabel: 'planned',
        note: keptNote,
      }}
    />
  );
}

/**
 * Shared per-event display derivation (badge · date/place meta · countdown ·
 * status · planned label) — one source for the desktop glass cards AND the
 * mobile hero/chips, so the two compositions can never drift.
 */
function deriveEventView(
  event: EventWithRole,
  pct: number | null,
  finished: boolean | undefined,
  /** The SAME PH-local day string the shelf split used — see the note below. */
  todayISO: string,
) {
  const badge = eventTypeBadge(event.event_type);
  // 🔴 ONE CLOCK. This used `daysUntilEvent(event.event_date)`, which reduces
  // "now" with the SERVER's clock (UTC on Vercel) while the shelf reduced it in
  // Asia/Manila — so between Manila 00:00 and 08:00 they disagreed by a day and
  // the card read "Tomorrow" ON THE MORNING OF THE WEDDING. Measured under both
  // timezones; correct on a PH laptop, wrong in production. See
  // lib/event-board.daysUntilEventDay.
  const days = daysUntilEventDay(event.event_date, todayISO);
  const place = placeLabel(event);
  const dateLabel = shortDate(event.event_date);
  // WHEN + WHERE on one line — the date leads, place trails. Never blank: an
  // event with neither reads "Date to be set" so the card is self-explanatory.
  const dateMeta =
    [dateLabel, place].filter(Boolean).join(' · ') || 'Date to be set';
  // WHAT'S NEXT — a plain-language countdown. Past dates fall through to the
  // finished / status branches.
  const countdown =
    days == null
      ? null
      : days > 1
        ? `${days} days to go`
        : days === 1
          ? 'Tomorrow'
          : days === 0
            ? 'Happening today'
            : null;
  // WHICH SIDE OF THIS EVENT THE VIEWER IS ON — the thing that decides where the
  // card can send them. NULL for a member_type this board does not carry
  // (vendor · coordinator), which `splitEventBoard` has already filtered out.
  const stance = eventStance(event.member_type);
  const invited = stance === 'invited';
  // WHERE THIS CARD GOES — derived HERE, once, so the destination, the status
  // line and the reason-it-cannot-be-opened can never disagree with each other.
  const href = eventBoardHref(event);

  // 🚨 WHY THIS IS NOT A `status` BRANCH. It was one, and the branch order was
  // the bug: `finished` was tested BEFORE `invited`, so an invited event whose
  // day had passed always read 'Celebrated' and the sentence written to explain
  // an unopenable card was UNREACHABLE on the Finished shelf. Prod's one past
  // event is also its one slug-less event and already carries a live join token,
  // so one scan away a real person had a card that lifted, squashed, opened
  // nothing and said nothing about why.
  //
  // The reason is now tied to the ACTUAL CONDITION — no destination — instead of
  // being re-derived from a chain of stances. A card with nowhere to go says so
  // on every shelf, in every composition, whatever else is true about it.
  const closedReason =
    href === null && invited ? 'The host hasn’t opened their page yet' : null;

  // An INVITED event has no plan to be underway and no tasks to be behind on —
  // "Planning underway" would be describing somebody else's work.
  const status = finished
    ? 'Celebrated'
    : invited
      ? (countdown ?? 'You’re on the guest list')
      : (countdown ?? (pct != null ? 'Planning underway' : 'Just getting started'));
  // ⚠ `plannedLabel` ("N% planned") LIVED HERE AND IS GONE (2026-08-24). It
  // printed the same number the ring already shows an inch away — the exact
  // D-6 defect W1-A removed from the event dashboard, fixed there and not
  // here. The ring is now the ONE place the figure prints (with an sr-only
  // "planned" so a screen reader still hears what the number is), and the
  // sub-line slot carries words that say something the ring cannot.
  //
  // A FINISHED celebration gets no score at all — the day happened, and "0%
  // planned" on a celebrated day tells the person they planned none of it
  // (observed live 2026-08-24, "Movie Night · Celebrated · 0% planned"). What
  // it shows instead is the one sentence that is true of every kept
  // celebration, in the shelf's own words: it is kept, not graded.
  const keptNote = finished ? 'Kept for good' : null;
  return {
    badge,
    dateLabel,
    place,
    dateMeta,
    countdown,
    status,
    keptNote,
    stance,
    href,
    closedReason,
  };
}

/*
 * ─── ONE EVENT CARD, PHONE AND LAPTOP (owner 2026-08-23) ─────────────────
 *
 * `MobileEventHero` and `MobileEventChip` LIVED HERE and are deleted. The
 * board used to render every shelf twice — a phone composition under
 * `sm:hidden` (a full-width dark hero for the first event, compact two-up
 * chips for the rest) and a glass-card grid under `hidden sm:grid`. One card
 * now renders at every width: one column on a phone, two from `sm`, three
 * from `lg`, four from `xl`.
 *
 * ⚖ THIS REPLACES TWO OWNER-APPROVED COMPOSITIONS, AND IT IS AN OWNER
 * DECISION, NOT AN ENGINEERING ONE. `GlassEventCard`'s docblock records
 * "owner-approved final design 2026-07-15" and the phone pair cited the
 * prototype it came from by name. A session was asked to unify them, opened
 * these files, found both signed off, and put the question up rather than
 * reversing two approvals on its own authority. The owner answered yes.
 * `DECISION_LOG.md` 2026-08-23 carries the row.
 *
 * 🔑 NOTHING WAS LOST IN THE COLLAPSE, and that was checked rather than
 * assumed: the glass card already carried every signal the phone pair did —
 * the photograph, the monogram, the name and place, the date, the counter,
 * the progress and the stance — and it carries the story-page override
 * (`storyHref`) the Untold shelf depends on. The `align` alternation the
 * two-up chips needed is gone with them: at one column a card is full width,
 * so its menu hangs from the right edge with room to open.
 */

/**
 * The event-card counter — Planning's fill for the collection card's ONE
 * attention row, or nothing at all.
 *
 * The row itself (the amber pill, "N need you", the rule that the total leads
 * only when it says something the label does not) is the collection card's
 * `CollectionAttentionRow` now; see its docblock for the owner's "9 need you ·
 * 9 tasks overdue" and "9 3 payments to settle" history. This function only
 * decides WHICH numbers Planning hands it.
 *
 * ─── THE TWO WAYS THIS MUST STAY SILENT ────────────────────────────────────
 * 1. NO SUMMARY, NO PILL. `decisionByEvent` is keyed on the organiser's ACTIVE
 *    events. An invited card, an archived card and a card whose decision read
 *    graceful-degraded all arrive here as `undefined` — and none of the three
 *    may render "0 need you". An absence is not a zero; the pill is simply not
 *    there, exactly as the home board's tiles were never rendered as
 *    zero-with-a-flourish.
 * 2. NEVER ON AN INVITED CARD, even if a summary somehow exists for it. A
 *    guest has no payments to settle and no quotes to approve — those are the
 *    host's decisions, and quoting them at somebody who cannot act on them is
 *    the same error as printing "% planned" on a card for somebody else's
 *    plan, which `deriveEventView` already refuses to do.
 */
function eventAttention(
  summary: EventDecisionSummary | undefined,
  stance: EventStance | null,
): CollectionAttention | undefined {
  if (!summary || summary.total <= 0 || !summary.top) return undefined;
  if (stance === 'invited') return undefined;
  /*
    `count` is the TOTAL waiting and `labelCount` is what the count-led label
    already says ("9 tasks overdue"). The row prints the total ahead of the
    label only when `count > labelCount` — other kinds are waiting that the
    label cannot name — so one kind of thing never reads as the same number
    twice.
  */
  return {
    count: summary.total,
    label: summary.top.label,
    labelCount: summary.top.count,
  };
}

/**
 * A board card plus its "⋯" menu — put away / remove for good.
 *
 * ─── WHY IT WRAPS RATHER THAN NESTS ────────────────────────────────────────
 * 🪤 Every board card is a `<Link>` (see CardShell). A `<button>` inside an
 * `<a>` is invalid HTML and behaves like it: the press activates both, so
 * opening the menu would navigate into the event underneath. The menu is
 * therefore a SIBLING of the card inside a `relative` wrapper, and each card
 * takes `hasMenu` so it can reserve the corner the button will occupy — a
 * button laid over a truncating line of text is the same bug one layer up.
 *
 * ─── WHO GETS ONE ──────────────────────────────────────────────────────────
 * `member_type === 'couple'` ONLY. This board carries exactly two kinds of card
 * (couple → organiser, guest → invited; `splitEventBoard` drops the rest), and
 * a guest must not be offered controls over somebody else's celebration. It
 * matches the server gate exactly — `deleteOwnEvent` admits couple members and
 * nobody else — so the menu is never a door to a refusal.
 *
 * `h-full` on the wrapper keeps the card filling its grid cell: the card, not
 * this div, used to be the grid item.
 */
function BoardCardWithMenu({
  event,
  tone = 'light',
  align = 'right',
  /**
   * TRUE on the Untold + Told shelves — mirrors the `finished` prop already
   * passed to the card underneath (`GlassEventCard`) on
   * those two shelves only. Owner 2026-08-22, asked directly: *"shouldn't now
   * happening and planning be the only ones to have this add to calendar?"*
   * A day that has already passed is not something to add to a phone
   * calendar, so `EventCardMenu` drops that row entirely when this is true.
   */
  finished = false,
  children,
}: {
  event: EventWithRole;
  tone?: 'light' | 'dark';
  /** Which card edge the popover hangs from — see EventCardMenu's `align`.
   *  The two-up phone chips MUST alternate or the left column's menu renders
   *  partly off the left of the screen, where it cannot be scrolled to. */
  align?: 'left' | 'right';
  finished?: boolean;
  children: ReactNode;
}) {
  if (event.member_type !== 'couple') return <>{children}</>;
  return (
    <div className="relative h-full">
      {children}
      <EventCardMenu
        eventId={event.event_id}
        eventName={event.display_name}
        archived={!!event.archived}
        eventDateIso={event.event_date}
        venueName={event.venue_name}
        venueAddress={event.venue_address}
        finished={finished}
        tone={tone}
        align={align}
      />
    </div>
  );
}

/**
 * The terminal EVENTS card — "New event". Creating an event is a distinct flow
 * (not a page of content to preview), so this stays a navigation. At base a
 * compact dashed ROW (proto .mghost — a light footer to the Events block);
 * from `sm` the dashed ghost card with the same footprint as an event card
 * (proto .evghost — bare gold plus, no circle). The tile itself is the
 * collection standard's `NewThingTile`; Planning supplies where and what.
 */
function NewEventCard({ delay = 0 }: { delay?: number }) {
  return <NewThingTile href="/dashboard/create-event" label="New event" delay={delay} />;
}

/**
 * The Planning header's right side: how many are on the shelf (never a zero —
 * see `CollectionEmptyState`), the put-away switch when there is anything put
 * away, and the (+).
 */
function PlanningHeaderActions({
  count,
  putAwayOn,
  putAwayCount,
}: {
  count: number;
  putAwayOn: boolean;
  putAwayCount: number;
}) {
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      {count > 0 ? (
        <span className="text-[12px] tracking-[0.04em] text-[color:var(--sn-ink-400)]">
          {count === 1 ? '1 event' : `${count} events`}
        </span>
      ) : null}
      {putAwayCount > 0 ? <PutAwaySwitch on={putAwayOn} count={putAwayCount} /> : null}
      <NewEventButton />
    </span>
  );
}

/**
 * The Planning header's (+) — the template's always-present way to add one
 * (owner-approved 2026-09-24). The dashed tile leaves a FULL page, so without
 * this a person on page 1 of 30 events would have no door to a new one.
 */
function NewEventButton() {
  return (
    <Link
      href="/dashboard/create-event"
      aria-label="New event"
      className="sn-press inline-grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-black"
    >
      <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
    </Link>
  );
}

/**
 * A Planning page's URL. Page 1 is the bare board (no `page=1` noise), the
 * put-away switch rides along, and `#events` lands the person on the shelf
 * rather than the top of the board.
 */
function planningPageHref(page: number, putAway: boolean): string {
  const q = new URLSearchParams();
  if (putAway) q.set('putaway', '1');
  if (page > 1) q.set('page', String(page));
  const qs = q.toString();
  return `/dashboard${qs ? `?${qs}` : ''}#events`;
}

type SpaceCardProps = {
  /** Stable key when several rows share an href (e.g. one per vendor shop). */
  id?: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Shop logo — shown in the icon chip in place of the glyph when set. */
  logoUrl?: string | null;
  title: string;
  subtitle: string;
  /** admin = slate accent · default = gold. */
  tone: 'admin' | 'default';
  /** "Needs a decision" line (e.g. "3 new inquiries" · "5 awaiting review"). */
  attention?: string;
};

/*
 * ─── FOUR COMPONENTS DELETED HERE (2026-08-23) ───────────────────────────
 *
 * `SpaceRow` · `CreateSamahanRow` · `OpenShopRow` · `BecomeStorytellerRow`.
 * All four were the remains of the "Yours to run" Spaces tile, which the
 * owner removed on 2026-08-19 when he made the account home only his events.
 * Measured before deleting: ZERO call sites app-wide for every one of them.
 *
 * 🪤 AND A NAIVE `grep -rn '<OpenShopRow' app` RETURNS ONE HIT, which is why
 * this is written down. That hit is inside `open-shop/has-a-doorway.test.ts`'s
 * OWN regex — the guard's assertion contains the component name it is looking
 * for. Exclude the test files before you count, or you read "it is rendered
 * once" off the guard that says it is not.
 *
 * ✅ NO DOOR IS LOST, and that was checked rather than assumed. Every
 * destination these rows carried is on the account switcher in the top bar,
 * on every width: /open-shop (behind `canOpenShop`), /dashboard/creator, and
 * the Samahan surfaces. Both guards that used to assert these strings were
 * already repointed at the switcher on 2026-08-19, each recording the same
 * lesson: a string in an unmounted component is not a door.
 *
 * ⏭ NAMED DEBT, NOT FIXED HERE: `spaces` and `samahanRows` (above, ~:755 and
 * ~:873) are still BUILT and never read — the same tile's data half. Left
 * alone deliberately: unpicking them reaches back into the reads that feed
 * them, and a design study is reading this file right now.
 */

