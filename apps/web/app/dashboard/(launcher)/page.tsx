import {
  Suspense,
  type ReactNode,
  type ComponentType,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Store,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  Wand2,
  AlertCircle,
  Users,
  Clapperboard,
  Heart,
  HeartHandshake,
  MapPin,
  Baby,
  Mail,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchUserEvents, type EventWithRole } from '@/lib/events';
import {
  daysUntilEventDay,
  eventBoardHref,
  eventStance,
  isFinishedEvent,
  manilaTodayISO,
  mergeBoardMemberships,
  splitEventBoard,
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
import { ProgressRing } from '@/app/_components/progress-ring';
import { EventMonogram } from '@/app/_components/event-monogram';
import { ShopLogo } from './_components/shop-logo';
import { accountAutosurfaceEnabled } from '@/lib/account-autosurface-flag';
import { AutoSurfacedEvents } from '../(account)/_components/autosurfaced-events';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { CountUp } from '@/app/_components/count-up';
import { HomePillNav } from './_components/home-pill-nav';
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
 *     · countdown), date DESCENDING (newest on top, per the 2026-07-13 timeline
 *     ordering rule) with UNDATED at the tail reading "Date to be set", ending
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
  searchParams?: Promise<{ hub?: string }>;
}) {
  const user = await getCurrentUser();
  // Layout already redirects to /login if no user; this is for type narrowing.
  if (!user) redirect('/login');
  const supabase = await createClient();
  const sp = (await searchParams) ?? {};

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
  // invited to one has none of that. Folding invited rows in here would silently
  // reverse the owner's single-event auto-jump ruling the moment somebody scans
  // an invitation. Only the BOARD reads the merged set (`boardEvents` below).
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
  // Finished continues oldest-toward-the-bottom. Both shelves ALWAYS RENDER
  // (owner 2026-08-13) — the `?show=all` toggle that used to hide the second one
  // is gone.
  //
  // This is the ONE place the invited memberships join the organiser ones: the
  // board is the person's collection of events, whichever side of it they stand
  // on. Ordering + the finished test + the stance/href derivation all live in
  // lib/event-board.ts.
  const dateKey = (e: EventWithRole) => e.event_date?.slice(0, 10) ?? '';
  const boardEvents = mergeBoardMemberships(events, invitedEvents);
  const { comingUp: upcoming, finished } = splitEventBoard(
    boardEvents,
    todayISO,
  );

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
  const wantsHub = sp.hub === '1';
  const soleUpcoming = active.length === 1 && !isPast(active[0]!);
  if (soleUpcoming && !hasConsole && !wantsHub) {
    redirect(`/dashboard/${active[0]!.event_id}`);
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
  try {
    const { count, error } = await supabase
      .from('creator_chapters')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (!error) chapterCount = count ?? 0;
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
            displayUrlForStoredAsset(r.landing_page_hero_image_url).catch(
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
          place — the nav entry `customer.account.events` reads "My Events" — so
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
          (owner 2026-08-13). Glass cards, date descending (newest on top, owner
          2026-07-13 ordering), UNDATED at the tail reading "Date to be set".
          The FINISHED shelf follows as its own section — it is no longer hidden
          behind a "Show all" toggle. */}
      <section
        id="events"
        className="sn-reveal mb-7 scroll-mt-24 sm:mb-6"
        style={{ animationDelay: '0.4s' }}
      >
        <SectionLabel sub="ongoing & upcoming">Coming up</SectionLabel>
        {/* MOBILE composition (proto .mhero/.mbento/.m-nudge/.mghost): the
            primary event as a full-width dark hero, the rest as compact glass
            chips, the neediest-event nudge row, then the New-event ghost. Same
            real data + hrefs as the desktop cards. */}
        <div className="space-y-3 sm:hidden">
          {upcoming[0] ? (
            <BoardCardWithMenu event={upcoming[0]} tone="dark">
              <MobileEventHero
                event={upcoming[0]}
                pct={progressByEvent.get(upcoming[0].event_id) ?? null}
                todayISO={todayISO}
                summary={decisionByEvent.get(upcoming[0].event_id)}
                hasMenu={upcoming[0].member_type === 'couple'}
              />
            </BoardCardWithMenu>
          ) : null}
          {upcoming.length > 1 ? (
            <div
              className="sn-reveal grid grid-cols-2 gap-2.5"
              style={{ animationDelay: '0.58s' }}
            >
              {upcoming.slice(1).map((event, i) => (
                <BoardCardWithMenu
                  key={event.event_id}
                  event={event}
                  /* Two-up grid: even index = left column. Its menu hangs from
                     the card's LEFT edge so a 280px panel stays on screen. */
                  align={i % 2 === 0 ? 'left' : 'right'}
                >
                  <MobileEventChip
                    event={event}
                    pct={progressByEvent.get(event.event_id) ?? null}
                    todayISO={todayISO}
                    summary={decisionByEvent.get(event.event_id)}
                    hasMenu={event.member_type === 'couple'}
                  />
                </BoardCardWithMenu>
              ))}
            </div>
          ) : null}
          <NewEventCard delay={0.74} />
        </div>
        {/* DESKTOP grid (proto .evrow — 4 columns on the wide canvas). */}
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {upcoming.map((event, i) => (
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
          <NewEventCard delay={0.5 + upcoming.length * 0.08} />
        </div>
      </section>

      {/* FINISHED — the second shelf, and it is ALWAYS HERE (owner 2026-08-13).
          It used to be the hidden half of the Events block, revealed by a
          "Show all" link: **a thing you have to switch on reads as a thing that
          might not be there**, and what was behind it is somebody's memories —
          prod's one finished wedding sat there. Now it is a named place on the
          board whether or not anything has reached it yet.

          🔑 THE EMPTY STATE MAKES NO ZERO-CLAIM. `fetchUserEvents`
          graceful-degrades to `[]` on every error including an RLS denial, so an
          empty shelf cannot be told apart from a refused read — the line
          therefore says what this shelf is FOR ("celebrations move here on their
          own once the day has passed") and never that you have none. Same rule
          the Alaala wall learned on 2026-08-12: "no photos yet" printed over a
          failed read is a lie told about somebody's memories. */}
      <section
        id="finished"
        className="sn-reveal mb-7 scroll-mt-24 sm:mb-6"
        style={{ animationDelay: '0.46s' }}
      >
        <SectionLabel sub="kept for good">Finished</SectionLabel>
        {finished.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 bg-white/[0.35] px-4 py-5 text-[13px] text-[color:var(--sn-ink-500)]">
            Celebrations move here on their own once the day has passed. Nothing
            you keep is ever taken away.
          </p>
        ) : (
          <>
            {/* MOBILE — compact chips, muted (the same treatment the hidden
                half used to get once revealed). */}
            <div className="grid grid-cols-2 gap-2.5 sm:hidden">
              {finished.map((event, i) => (
                <BoardCardWithMenu
                  key={event.event_id}
                  event={event}
                  align={i % 2 === 0 ? 'left' : 'right'}
                >
                  <MobileEventChip
                    event={event}
                    pct={progressByEvent.get(event.event_id) ?? null}
                    finished
                    todayISO={todayISO}
                    summary={decisionByEvent.get(event.event_id)}
                    hasMenu={event.member_type === 'couple'}
                  />
                </BoardCardWithMenu>
              ))}
            </div>
            {/* DESKTOP — the same glass cards, muted scene, reading
                "Celebrated". */}
            <div className="hidden gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {finished.map((event, i) => (
                <BoardCardWithMenu key={event.event_id} event={event}>
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
                  />
                </BoardCardWithMenu>
              ))}
            </div>
          </>
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


      {/* Phone-only thumb nav. Every target is a link this page already renders. */}
      <HomePillNav
        hasSpaces={hasConsole}
        spacesHref={roles.hasVendorAccess ? '/vendor-dashboard' : '/admin'}
      />
    </div>
  );
}


/**
 * Section header (proto .sec-h): sentence-case bold title with an optional
 * soft sub-caption from `sm` up; at base the mobile treatment — 14px w800 with
 * a trailing hairline rule filling the line (proto .mtitle). Optional
 * right-aligned action either way.
 */
function SectionLabel({
  children,
  sub,
  action,
}: {
  children: ReactNode;
  /** Soft caption beside the title (desktop only), e.g. "ongoing & upcoming". */
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <h2 className="flex flex-1 items-center gap-2.5 whitespace-nowrap text-sm font-extrabold tracking-tight text-ink after:h-px after:flex-1 after:bg-ink/10 sm:flex-none sm:text-base sm:tracking-[-0.015em] sm:after:hidden">
          {children}
        </h2>
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
 * The press + hover affordances. Stripped from a card that has nowhere to go —
 * see CardShell. Kept as one list so "which classes make this look pressable"
 * has a single answer.
 */
const PRESSABLE_CLASSES = ['sn-press', 'sn-lift-4'] as const;

/**
 * …and every `hover:` variant, because a named list is a bill you keep paying.
 * The first cut stripped the two classes above and left `hover:border-mulberry/30`
 * on the desktop card, so a dead card still lit its border under the pointer.
 * Anything that changes on hover is an affordance.
 */
const isHoverAffordance = (c: string) => c.startsWith('hover:');

/**
 * A board card is a LINK when there is somewhere to send this person, and an
 * INERT panel when there is not — inert in look as well as in behaviour.
 *
 * 🪤 An INVITED event whose host has never opened a public page has no guest
 * surface at all — and one prod event is in exactly that state. The old card
 * would have linked to `/dashboard/<id>`, which admits organisers only, so the
 * person told they belong would have been shown a 404. Rendering the card
 * without a link is the honest version: they ARE invited, there is just nothing
 * to open yet, and `deriveEventView`'s `closedReason` puts that on the card.
 *
 * 🚨 AND THE FIRST CUT OF THIS SHELL WAS A DEAD CONTROL THAT LOOKED ALIVE.
 * It passed the caller's `className` straight through to the `<div>`, and that
 * string carries `sn-press` (`:active { scale: 0.97 }`) and `sn-lift-4`
 * (`:hover { translateY(-4px) }`) — both plain class selectors in globals.css,
 * so they fire on a div exactly as on a link. The card lifted when you pointed
 * at it and squashed when you pressed it, and then did nothing. Found by an
 * adversarial pass over my own merged work, 2026-08-13; the `cursor` never
 * changed (those rules cover buttons and anchors only), which made it quieter
 * still. **A control that animates under your finger has promised something.**
 */
function CardShell({
  href,
  className,
  style,
  children,
}: {
  href: string | null;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (!href) {
    const inert = className
      .split(/\s+/)
      .filter(
        (c) =>
          !(PRESSABLE_CLASSES as readonly string[]).includes(c) &&
          !isHoverAffordance(c),
      )
      .join(' ');
    return (
      <div className={inert} style={style}>
        {children}
      </div>
    );
  }
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}

/**
 * One EVENTS glass card (owner-approved final design 2026-07-15). A frosted
 * panel over the warm paper — the Atelier + macOS-glass language (owner-locked
 * 2026-07-12) — carrying the same signals as the old timeline node: badge ·
 * monogram · place/date · gold progress ring · countdown · attention line.
 * The card jumps into the event dashboard — an allowed navigation.
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
}) {
  const { badge, dateLabel, place, status, plannedLabel, stance, href, closedReason } =
    deriveEventView(event, pct, finished, todayISO);

  return (
    <CardShell
      href={href}
      className={`sn-tile-glass sn-lift-4 sn-press sn-reveal group flex h-full min-h-[196px] flex-col overflow-hidden rounded-2xl hover:border-mulberry/30 ${
        finished ? 'opacity-75 hover:opacity-100' : ''
      }`}
      style={{ animationDelay: `${0.5 + index * 0.08}s` }}
    >
      {/* THE SCENE (prototype `events()` → `.top`): the event's hero, scrimmed,
          with the type badge, the monogram floating over the band's edge, and
          the event's NAME + PLACE set on it — the thing that makes an event
          imaginable instead of a stripe (owner 2026-07-30). The couple's OWN
          hero when they have one; otherwise the same type hero (+ gradient
          fallback) the create-event picker uses, under the per-event treatment
          that keeps two events of one type from reading as the same
          photograph. Nothing new is invented, and a type with no asset gets
          its deterministic branded gradient, never another type's photo. */}
      <div className="relative h-32 shrink-0 sm:h-36">
        <EventScene
          eventId={event.event_id}
          eventType={event.event_type}
          photoSrc={heroSrc}
          ownPhotoSrc={ownHeroSrc}
          muted={finished}
        />
        {/* Type badge + STANCE, one row: what kind of event this is, and which
            side of it you are on. */}
        <div
          className={`absolute left-3 top-3 flex flex-wrap items-center gap-1.5 ${
            hasMenu ? 'max-w-[calc(100%-3.75rem)]' : 'max-w-[calc(100%-1.5rem)]'
          }`}
        >
          <span className="inline-flex rounded-full bg-white/85 px-2 py-1 font-mono text-[9px] font-normal uppercase tracking-[0.12em] text-[color:var(--sn-gold-700)] shadow-[0_2px_8px_rgba(30,26,18,0.08)]">
            {badge}
          </span>
          {stance ? <StanceChip stance={stance} /> : null}
        </div>
        {/* The event's REAL monogram (uploaded / bespoke SVG · framed lockup ·
            lettered). Uploaded outranks custom per app-wide precedence;
            EventMonogram only reads monogram_custom_svg, so resolve it here. */}
        <EventMonogram
          event={{
            ...event,
            // SEC-3: gated on read — both columns are host-writable via PostgREST.
            monogram_custom_svg: resolveEventMonogramSvg(event),
          }}
          size="lg"
          shape="square"
          className="absolute -bottom-4 right-3 border-2 border-white/80 shadow-[var(--sn-sh-tile)]"
        />
        {/* Name + place ON the scene. `right-[4.75rem]` keeps them clear of the
            monogram that overhangs the band's bottom-right corner. Place is
            omitted (never guessed) when the event has neither a venue name nor
            an address. */}
        <div className="absolute inset-x-3 bottom-2.5 right-[4.75rem] min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-white drop-shadow-[0_1px_6px_rgba(23,22,15,0.6)]">
            {event.is_primary ? (
              <span
                aria-hidden
                className="shrink-0 text-xs text-[color:var(--sn-terra)]"
              >
                ★
              </span>
            ) : null}
            <span className="truncate">{event.display_name}</span>
          </p>
          {place ? (
            <p className="flex items-center gap-1 text-[11.5px] text-white/75">
              <MapPin aria-hidden className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{place}</span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-5">
        <p className="truncate text-[12.5px] text-[color:var(--sn-ink-500)]">
          {dateLabel ?? 'Date to be set'}
        </p>
        {/* THE COUNTER (owner 2026-08-20). Above the progress row so it is the
            first thing read after the date — what is waiting outranks how far
            along the plan is. Absent entirely when nothing waits. */}
        <EventAttention summary={summary} stance={stance} />
        <div className="mt-auto flex items-center gap-2.5 pt-1">
          {pct != null ? (
            <ProgressRing
              pct={pct}
              size={44}
              stroke={4.5}
              trackColor="rgb(var(--color-ink) / 0.08)"
              sweep={{ delayMs: 600 + 150 * index }}
              className="rounded-full shadow-[0_6px_16px_-8px_rgba(30,26,18,0.3)]"
            >
              {/* Frosted inner disc behind the label (proto .ring inner). */}
              <span
                aria-hidden
                className="absolute inset-[4.5px] rounded-full bg-white/[0.78] backdrop-blur-[6px]"
              />
              <span className="relative font-mono text-[10px] font-bold text-ink">
                <CountUp value={pct} suffix="%" delayMs={600 + 150 * index} />
              </span>
            </ProgressRing>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-bold text-ink">{status}</p>
            {plannedLabel ? (
              <p className="truncate font-mono text-[11px] text-ink/45">
                {plannedLabel}
              </p>
            ) : null}
            {/* Why this card does not open. Rendered whenever there is no
                destination, on EVERY shelf — a silent dead card reads as the
                app being broken or the couple having pulled their page. */}
            {closedReason ? (
              <p className="text-[11px] leading-snug text-ink/45">{closedReason}</p>
            ) : null}
          </div>
        </div>
      </div>
    </CardShell>
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
  // "% planned" is an ORGANISER's number. Never shown on an invited card.
  const plannedLabel = !invited && pct != null ? `${pct}% planned` : null;
  return {
    badge,
    dateLabel,
    place,
    dateMeta,
    countdown,
    status,
    plannedLabel,
    stance,
    href,
    closedReason,
  };
}

/**
 * MOBILE events hero (proto .mhero) — the first (primary) upcoming event as a
 * full-width dark card: gold eyebrow, name, mono facts line, slim gold progress
 * bar with the library shimmer. Real data only — facts and the bar render only
 * from what actually exists.
 */
function MobileEventHero({
  event,
  pct,
  todayISO,
  summary,
  hasMenu = false,
}: {
  event: EventWithRole;
  pct: number | null;
  /** The board's PH-local day — the countdown and the shelf must share it. */
  todayISO: string;
  /** This event's own decision summary. `undefined` ⇒ no pill — never a 0. */
  summary?: EventDecisionSummary;
  /** Reserve the top-right corner for the card menu. */
  hasMenu?: boolean;
}) {
  const { badge, dateLabel, countdown, plannedLabel, status, stance, href, closedReason } =
    deriveEventView(event, pct, undefined, todayISO);
  // ⚠ The comment here used to read "attention/overdue lives ONLY in the mobile
  // nudge row now (owner 2026-07-15: one home for overdue counts)". That nudge
  // row IS the banner retired above, and it only ever carried the busiest
  // event — so on a phone this hero could be the neediest card on screen and
  // say nothing. The counter now rides the card (owner 2026-08-20).
  // An INVITED hero shows its status line instead of a plan percentage it has no
  // business quoting — `plannedLabel` is already null for it.
  const facts = [
    plannedLabel,
    stance === 'invited' ? status : null,
    closedReason,
    dateLabel,
  ].filter(Boolean) as string[];
  return (
    <CardShell
      href={href}
      className={`sn-press sn-reveal block w-full rounded-2xl bg-ink p-4 text-cream shadow-[0_20px_44px_-26px_rgba(23,22,15,0.7)] ${
        hasMenu ? 'pr-12' : ''
      }`}
      style={{ animationDelay: '0.5s' }}
    >
      <p className="flex flex-wrap items-center gap-x-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sn-gold-300)]">
        <span>
          {badge} · {countdown ?? dateLabel ?? 'Date to be set'}
        </span>
        {stance ? (
          <span className="normal-case tracking-normal text-cream/55">
            · {stanceLabel(stance)}
          </span>
        ) : null}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-lg font-bold">
        {event.is_primary ? (
          <span aria-hidden className="shrink-0 text-xs text-[color:var(--sn-terra)]">
            ★
          </span>
        ) : null}
        <span className="truncate">{event.display_name}</span>
      </p>
      {facts.length > 0 ? (
        <p className="mt-1 flex gap-3 font-mono text-[11px] text-cream/60">
          {facts.map((f) => (
            <span key={f} className="truncate">
              {f}
            </span>
          ))}
        </p>
      ) : null}
      {summary && stance !== 'invited' && summary.total > 0 ? (
        <span className="mt-2 flex">
          <EventAttention summary={summary} stance={stance} />
        </span>
      ) : null}
      {pct != null ? (
        <span className="sn-bar mt-2.5 block h-1.5 overflow-hidden rounded-full bg-white/15">
          <i
            className="relative overflow-hidden bg-terracotta"
            style={{ width: `${pct}%` }}
          >
            {/* Infinite capiz shim inside the gold fill (library sn-shimmer;
                the global reduced-motion freeze caps it to one instant run). */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-white/25"
              style={{ animation: 'sn-shimmer 2.8s ease-in-out 1.8s infinite' }}
            />
          </i>
        </span>
      ) : null}
    </CardShell>
  );
}

/**
 * MOBILE compact event chip (proto .mbento cell) — eyebrow (badge · date),
 * name, status line, stance. No ring/texture/monogram at this density.
 */
function MobileEventChip({
  event,
  pct,
  finished,
  todayISO,
  summary,
  hasMenu = false,
}: {
  event: EventWithRole;
  pct: number | null;
  finished?: boolean;
  /** The board's PH-local day — the countdown and the shelf must share it. */
  todayISO: string;
  /** This event's own decision summary. `undefined` ⇒ no pill — never a 0. */
  summary?: EventDecisionSummary;
  /** Reserve the top-right corner for the card menu. */
  hasMenu?: boolean;
}) {
  const { badge, dateLabel, status, stance, href, closedReason } = deriveEventView(
    event,
    pct,
    finished,
    todayISO,
  );
  return (
    <CardShell
      href={href}
      className={`sn-press block h-full rounded-2xl border border-ink/15 bg-white/60 p-3 text-left ${
        finished ? 'opacity-75' : ''
      } ${hasMenu ? 'pr-9' : ''}`}
    >
      <p className="truncate font-mono text-[9px] uppercase text-mulberry">
        {badge}
        {dateLabel ? ` · ${dateLabel}` : ''}
      </p>
      <p className="truncate text-sm font-bold text-ink">{event.display_name}</p>
      <p className="truncate text-[11px] text-ink/55">{status}</p>
      {/* The stance, at chip density: a plain line rather than the badge, so a
          two-up grid stays readable. Never omitted — the whole point is that
          two cards side by side say which is which. */}
      {stance ? (
        <p className="truncate text-[10.5px] font-semibold text-ink/45">
          {stanceLabel(stance)}
        </p>
      ) : null}
      {closedReason ? (
        <p className="text-[10.5px] leading-snug text-ink/45">{closedReason}</p>
      ) : null}
      {/* AT CHIP DENSITY THE COUNT IS THE WHOLE MESSAGE. These sit two-up on a
          phone, so the named action ("3 payments to settle") cannot fit beside
          a name and a status without truncating to noise. The number and
          "need you" fit, and the named line is one tap away on the event
          itself — which is where pressing this chip goes. */}
      {summary && summary.total > 0 && stance !== 'invited' ? (
        <p className="mt-1.5 flex items-center gap-1 text-[10.5px] font-bold text-[color:var(--sn-warning)]">
          <AlertCircle aria-hidden className="h-3 w-3 shrink-0" />
          <span className="font-mono">{summary.total}</span> need you
        </p>
      ) : null}
    </CardShell>
  );
}

/**
 * The "needs a decision now" line — a gold pill naming the top pending
 * action (+ "· N more" when other kinds are also waiting). Named, not a bare
 * count badge, so the couple knows WHAT before they click (owner 2026-07-10).
 * Reused on the vendor shop + admin HQ cards, and on every event card.
 *
 * ─── `count` — THE TOTAL, LEADING (owner 2026-08-20) ────────────────────────
 * The owner asked for "a counter on the event card", having watched a banner
 * say "9 things need you" for one event while the rest said nothing. So the
 * event cards pass `count` and the pill leads with that whole number.
 *
 * 🔑 IT LEADS WITH THE NUMBER AND STILL NAMES THE ACTION, because BOTH owner
 * rulings are live and neither cancels the other: 2026-07-10 asked for a named
 * line rather than a bare badge ("so the couple knows WHAT before they click"),
 * and 2026-08-20 asked for the count to be visible per event. A bare "9" would
 * satisfy the new instruction by breaking the old one. The number is first so
 * that it survives truncation on the narrowest card — the label is what gives
 * way when there is no room, never the count.
 */
function AttentionPill({
  label,
  more = 0,
  count,
}: {
  label: string;
  more?: number;
  /** Total waiting on this surface. Omitted → the original label-only pill. */
  count?: number;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-[color:var(--sn-warning-soft)] px-[9px] py-[5px] text-[color:var(--sn-warning)]">
      <AlertCircle aria-hidden className="h-[13px] w-[13px] shrink-0" />
      {count != null ? (
        /*
          🚨 THE TOTAL NEEDS ITS OWN NOUN, AND THE FIRST CUT DID NOT GIVE IT ONE.
          `summarizeEventDecisions` returns a label that is ALREADY COUNT-LED —
          "3 payments to settle" — so printing the total straight before it
          rendered "9 3 payments to settle", and "3 3 payments to settle"
          whenever one kind was the only kind waiting. Two numbers in a row with
          nothing between them, on the pill the owner asked for by name.

          "need you" is what makes the first number a TOTAL and the second one a
          BREAKDOWN. It is also the banner's own word, so the count reads as the
          same fact that used to sit at the top of the page.
        */
        <span className="shrink-0 font-mono text-[12px] font-bold leading-none">
          {count} need you
        </span>
      ) : null}
      <span className="truncate text-[11px] font-bold">
        {count != null ? <span className="opacity-60">· </span> : null}
        {label}
        {/* `· N more` is SUPPRESSED once the total is shown: the total already
            counts the remainder (9 = 3 + 6), so keeping both prints the same
            arithmetic twice and invites the reader to add them again. */}
        {more > 0 && count == null ? (
          <span className="font-mono font-normal opacity-70"> · {more} more</span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * The event-card counter — `AttentionPill` fed from a card's own decision
 * summary, or nothing at all.
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
function EventAttention({
  summary,
  stance,
}: {
  summary: EventDecisionSummary | undefined;
  stance: EventStance | null;
}) {
  if (!summary || summary.total <= 0 || !summary.top) return null;
  if (stance === 'invited') return null;
  return (
    <AttentionPill
      count={summary.total}
      label={summary.top.label}
      more={Math.max(0, summary.total - summary.top.count)}
    />
  );
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
  children,
}: {
  event: EventWithRole;
  tone?: 'light' | 'dark';
  /** Which card edge the popover hangs from — see EventCardMenu's `align`.
   *  The two-up phone chips MUST alternate or the left column's menu renders
   *  partly off the left of the screen, where it cannot be scrolled to. */
  align?: 'left' | 'right';
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
 * (proto .evghost — bare gold plus, no circle).
 */
function NewEventCard({ delay = 0 }: { delay?: number }) {
  return (
    <Link
      href="/dashboard/create-event"
      className="sn-press sn-reveal group flex flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-ink/20 bg-white/[0.35] px-4 py-3.5 text-[13px] font-bold text-[color:var(--sn-ink-500)] transition-[color,background-color,border-color,transform] duration-200 hover:-translate-y-[3px] hover:border-terracotta hover:bg-white/50 hover:text-[color:var(--sn-gold-700)] sm:min-h-[196px] sm:flex-col sm:rounded-2xl sm:p-4"
      style={{ animationDelay: `${delay}s` }}
    >
      <Plus aria-hidden className="h-[22px] w-[22px] text-[color:var(--sn-gold-600)]" />
      New event
    </Link>
  );
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

/** One SPACES doorway row — the prototype tile's compact row (icon chip ·
 *  name · role · attention · jump arrow). Still a real navigation. */
function SpaceRow({
  href,
  icon: Icon,
  logoUrl,
  title,
  subtitle,
  tone,
  attention,
}: SpaceCardProps) {
  const admin = tone === 'admin';
  return (
    <Link
      href={href}
      className="sn-press group -mx-2 flex items-center gap-[11px] rounded-xl px-2 py-2.5 transition-[background-color,transform] hover:translate-x-0.5 hover:bg-white/70"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md ${
          /* HQ = slate (--sn-info) per the prototype — violet retired by the
             2026-07-12 atelier reskin. */
          admin
            ? 'bg-[color:var(--sn-info-soft)] text-[color:var(--sn-info)]'
            : 'bg-[color:var(--sn-gold-100)] text-[color:var(--sn-gold-700)]'
        }`}
      >
        {logoUrl ? (
          <ShopLogo
            src={logoUrl}
            fallback={<Icon className="h-[18px] w-[18px]" />}
          />
        ) : (
          <Icon className="h-[18px] w-[18px]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{title}</span>
        <span className="block truncate text-xs text-ink/55">{subtitle}</span>
        {attention ? (
          <span className="mt-1 block">
            <AttentionPill label={attention} />
          </span>
        ) : null}
      </span>
      <ArrowUpRight
        aria-hidden
        className="h-[15px] w-[15px] shrink-0 text-[color:var(--sn-ink-400)] transition-[transform,color] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-mulberry"
      />
    </Link>
  );
}

/**
 * The "+ Create a Samahan" doorway — the SpaceRow layout with a MUTED dashed
 * Plus chip (the "New event" / samahan-index create-row idiom). Always present
 * in the Spaces tile so a plain couple, or a member with no samahans yet, still
 * has the real create door.
 */
function CreateSamahanRow() {
  return (
    <Link
      href="/dashboard/samahan/new"
      className="sn-press group -mx-2 flex items-center gap-[11px] rounded-xl px-2 py-2.5 transition-[background-color,transform] hover:translate-x-0.5 hover:bg-white/70"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-ink/20 text-[color:var(--sn-ink-400)]">
        <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--sn-ink-500)] group-hover:text-ink">
        Create a Samahan
      </span>
      <ArrowUpRight
        aria-hidden
        className="h-[15px] w-[15px] shrink-0 text-[color:var(--sn-ink-400)] transition-[transform,color] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-mulberry"
      />
    </Link>
  );
}

/**
 * The "Create your shop" doorway — /open-shop for an account that has no shop.
 *
 * ⚠ THE LABEL IS AN OWNER INSTRUCTION (2026-08-10), not a style choice. It read
 * "Open your shop" for one release and the owner corrected it: in a list where
 * every other row takes you INTO something, "Open your shop" reads as "go to my
 * shop" — the one thing this row does not do. "Create" says it is not there yet.
 * The route stays /open-shop; that is a URL, not copy.
 *
 * ── WHY THIS EXISTS (2026-08-10) ───────────────────────────────────────────
 * /open-shop is a FINISHED wizard that handles exactly this case ("logged in,
 * no shop → the onboarding wizard"). Its only doorways in the whole app were
 * the PUBLIC /vendors marketing page and /vendor-dashboard/shop — a page you
 * can only reach if you already have a shop. So a signed-in customer could not
 * get there at all, and this tile is headed "Yours to run" under a Store glyph:
 * the shop is the thing it most implies and the one thing it did not offer.
 *
 * The same wayfinding defect, twice before, in this same file — Creator's Lab
 * (verdict 2026-07-16 B4) and Samahan. A page ships with its doorway.
 *
 * COPY IS HONEST. "For free" is the shipped promise on /vendors ("List your
 * business for free"). The review line is NOT a hedge — a new shop is created
 * hidden + unverified and only an admin can publish it (owner 2026-07-27,
 * confirmed against prod 2026-08-08), so promising couples would see them
 * straight away would be the overstated-copy mistake this repo keeps paying
 * for. It matches what My Shop already tells the vendor.
 */
function OpenShopRow() {
  return (
    <Link
      href="/open-shop"
      className="sn-press group -mx-2 flex items-center gap-[11px] rounded-xl px-2 py-2.5 transition-[background-color,transform] hover:translate-x-0.5 hover:bg-white/70"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-ink/20 text-[color:var(--sn-ink-400)]">
        <Store aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">Create your shop</span>
        <span className="block text-xs leading-snug text-ink/55">
          List your business for free. Setnayan reviews new shops before they go
          live to couples.
        </span>
      </span>
      <ArrowUpRight
        aria-hidden
        className="h-[15px] w-[15px] shrink-0 text-[color:var(--sn-ink-400)] transition-[transform,color] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-mulberry"
      />
    </Link>
  );
}

/**
 * The "Become a Storyteller" promo row — the owner-required home promo that IS
 * the /dashboard/creator doorway while the user has zero chapters (it collapses
 * to a plain "Your Story" SpaceRow once they author one). SpaceRow layout, but
 * the selling line WRAPS instead of truncating — it has to carry the pitch.
 * HONEST scope only (readiness verdict 2026-07-16): everything named here is
 * live today — public chapters on /u, followers + views, shoppable vendor
 * credits, vendor exclusive-rate offers. No viewer promo, no earnings, no
 * tier names.
 */
function BecomeStorytellerRow() {
  return (
    <Link
      href="/dashboard/creator"
      className="sn-press group -mx-2 flex items-center gap-[11px] rounded-xl px-2 py-2.5 transition-[background-color,transform] hover:translate-x-0.5 hover:bg-white/70"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[color:var(--sn-gold-100)] text-[color:var(--sn-gold-700)]">
        <Clapperboard aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">
          Become a Storyteller
        </span>
        <span className="block text-xs leading-snug text-ink/55">
          Publish your events as public chapters on your own page — gather
          followers, feature your vendors, and vendors can offer you exclusive
          rates.
        </span>
      </span>
      <ArrowUpRight
        aria-hidden
        className="h-[15px] w-[15px] shrink-0 text-[color:var(--sn-ink-400)] transition-[transform,color] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-mulberry"
      />
    </Link>
  );
}

