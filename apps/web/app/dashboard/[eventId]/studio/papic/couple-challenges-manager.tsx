// Papic Games — couple challenge manager (spec §5 / gap #1 + #8). Lets the couple
// AUTHOR their own generic challenges (so every event has a real game, not just
// booth missions for booked vendors) and CURATE the live set — hide/show any
// mission, delete their own. Async SERVER component: self-fetches the event's
// APPROVED missions (RLS-scoped authenticated client) — pending vendor challenges
// stay in the separate approval panel. Self-gates on papicGamesEnabled().

import Link from 'next/link';
import { Trophy, Eye, EyeOff, Trash2, Plus, MessageSquareQuote, Search, X, Radio, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicMissionCost } from '@/lib/papic-cameras';
import { fetchEventPoolStatus } from '@/lib/papic-event-pool';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import { resolveProfileByEvent } from '@/lib/event-type-profile';
import { ensurePapicBoard } from '@/lib/papic-games';
import {
  BOARD_SIZE,
  boardIsTrustworthy,
  boardOccupancyClaim,
  coupleSlots,
  displayChallengePrompt,
  type BoardReading,
  type CaptureKind,
  type PapicMissionSource,
} from '@/lib/papic-missions';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '@/lib/papic-challenge-categories';
import {
  fetchPickerRows,
  isDefaultView,
  readFilters,
  PICKER_PAGE_SIZE,
  type PickerFilters,
} from '@/lib/papic-challenge-picker';
import {
  fetchArmedChallenge,
  CHALLENGE_DURATION_CHOICES,
  CHALLENGE_DURATION_DEFAULT,
  CHALLENGE_DURATION_LABELS,
  type ArmedChallengeReading,
} from '@/lib/papic-challenge-clock';
import {
  createCoupleChallengeAction,
  addLibraryChallengeAction,
  setCoupleChallengeActiveAction,
  deleteCoupleChallengeAction,
  armChallengeAction,
} from './actions';

type MissionRow = {
  mission_id: string;
  // ⚠ Reuse the shared union — do NOT restate it. This file used to declare its
  // own ('auto' | 'couple' | 'vendor'). When the §9 library added a fourth
  // source the database learned it and this screen did not, so every Setnayan
  // recommendation rendered under the fallback badge and told the couple a
  // vendor had written it. Keyed off the shared type, adding a source now fails
  // the build here until it gets a badge.
  source: PapicMissionSource;
  prompt: string;
  is_active: boolean;
  /** The guest board position, 1..20. NULL = this challenge exists but is NOT
   *  being shown to guests — see the split below. */
  board_slot: number | null;
  capture_kind: CaptureKind | null;
};

/** What the guest is asked to DO. A story and a photo errand are different acts
 *  and the couple's list has to say which — "Brag about the bride for ten
 *  seconds" and "Catch the cake" read as the same kind of item otherwise. */
const KIND_LABEL: Record<CaptureKind, string> = {
  photo: 'Photo',
  clip: 'On camera',
};

const SOURCE_BADGE: Record<PapicMissionSource, { label: string; cls: string }> = {
  couple: { label: 'Yours', cls: 'bg-mulberry/15 text-mulberry' },
  auto: { label: 'Booth', cls: 'bg-terracotta/15 text-terracotta' },
  vendor: { label: 'Vendor', cls: 'bg-ink/10 text-ink/60' },
  setnayan: { label: 'Recommended', cls: 'bg-gold/15 text-gold-700' },
};

/**
 * ONE FILTER CHIP — a LINK, not a button.
 *
 * A filter is a place. Making it a link means the back button works, the state
 * survives a refresh, a couple can send the URL to whoever is helping them
 * plan, and none of it needs a line of client JavaScript on a screen that is
 * mostly read on a phone.
 *
 * 🔑 `patch` CHANGES ONE AXIS AND CARRIES THE REST. Tapping "Video" while
 * "Tell a story" is on must not silently drop the category — that reads as the
 * chip having done something else entirely. Passing `null` in `patch` clears
 * that one axis on purpose, which is how "All" and "Everything" work; `in` is
 * used rather than a truthiness check so an explicit null is not mistaken for
 * "not supplied".
 */
function FilterChip({
  eventId,
  filters,
  patch,
  label,
  active,
}: {
  eventId: string;
  filters: PickerFilters;
  patch: Partial<PickerFilters>;
  label: string;
  active: boolean;
}) {
  const next: PickerFilters = {
    q: 'q' in patch ? (patch.q ?? '') : filters.q,
    category: 'category' in patch ? (patch.category ?? null) : filters.category,
    kind: 'kind' in patch ? (patch.kind ?? null) : filters.kind,
  };
  const params = new URLSearchParams();
  if (next.q) params.set('cq', next.q);
  if (next.category) params.set('ccat', next.category);
  if (next.kind) params.set('ckind', next.kind);
  const qs = params.toString();

  return (
    <Link
      href={`/dashboard/${eventId}/studio/papic${qs ? `?${qs}` : ''}#challenges`}
      // The active chip is announced, not just coloured: on this palette the
      // difference between a selected and an unselected chip is a fill, and a
      // fill is invisible to a screen reader and to anyone who cannot see it.
      aria-current={active ? 'true' : undefined}
      className={
        active
          ? 'rounded-full bg-mulberry px-2.5 py-1 text-[11px] font-medium text-cream'
          : 'rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-[11px] text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink'
      }
    >
      {label}
    </Link>
  );
}

export async function CoupleChallengesManager({
  eventId,
  search,
  standalone = false,
}: {
  eventId: string;
  /** The picker's own URL keys, prefixed `c` so they cannot collide with the
   *  fifteen other `?papic_*` params this page already carries. */
  search?: { cq?: string; ccat?: string; ckind?: string };
  /**
   * TRUE on `/studio/papic/challenges` — the full screen: the picker, the
   * search, the list, the count. FALSE when embedded on the Papic setup page,
   * where it renders a SUMMARY and a way in.
   *
   * 🔑 THE TWO ARMS SHARE ONE COMPONENT SO THEY CANNOT DISAGREE. The obvious
   * alternative — a second summary card written on the setup page — is two
   * readers of the same rows, and the one nobody edits goes quietly wrong. This
   * one reads the board ONCE and decides how much of it to show.
   */
  standalone?: boolean;
}) {
  if (!papicGamesEnabled()) return null;

  const supabase = await createClient();

  // 🔑 BUILD THE BOARD BEFORE LISTING IT, or this screen lists the wrong thing.
  //
  // `board_slot` is written by ensure_papic_board, and until 2026-08-10 the ONLY
  // caller was the guest route — so for the whole planning period, when the
  // couple is actually curating, every slot is NULL. Listing that state honestly
  // would tell a couple none of their challenges reach guests; listing it
  // without slots at all (what this screen used to do) tells them nothing and
  // silently misrepresents the order.
  //
  // The resolver's own auth guard names the couple and coordinator, so this is
  // the caller it was written for. It is idempotent, advisory-locked per event,
  // and MATERIALIZE-ONCE/NEVER-DELETE — a de-selection is board_slot = NULL, not
  // a row delete — so calling it on a page render neither duplicates nor
  // destroys anything. Fail-soft on error, and the list below still renders —
  // just without positions.
  //
  // 🔑 AND WHETHER IT RAN IS LOAD-BEARING, WHICH IS WHY THE ANSWER IS KEPT.
  // From 2026-08-23 until 20271173829027 this call was REFUSED on every render:
  // the pabati retirement revoked `authenticated` from the resolver and never
  // granted it back. Nothing threw, so the screen carried on and read the only
  // state it could see — every board_slot NULL — as "the board is full and these
  // are queued behind it". An unbuilt board is not a full one, and the couple
  // was told to delete their own challenges to make room on a board that was
  // empty. `resolved` is what stops this screen inventing that again.
  const board = await ensurePapicBoard(supabase, eventId);

  // Approved missions only — live or hidden. Pending vendor challenges
  // (approved=false) belong to the approval panel, not the curation list.
  //
  // Ordered the way a GUEST sees them (board_slot), not the way they happened to
  // be created. Creation order is an implementation detail of when a vendor got
  // booked; it means nothing to the couple and matched no other screen.
  const { data, error: missionsErr } = await supabase
    .from('papic_missions')
    .select('mission_id,source,prompt,is_active,board_slot,capture_kind')
    .eq('event_id', eventId)
    .eq('approved', true)
    .order('board_slot', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  // A rejected read resolves with `{ error }` and null data — it never throws.
  // `?? []` alone would render "No challenges yet", which is a confident lie
  // about an event that may have a full board.
  const missions = (data ?? []) as MissionRow[];
  const missionsReadable = !missionsErr;

  // The split the couple actually needs: what guests see, and what does not fit.
  // A hidden challenge is excluded from the board by the resolver, so it lands
  // in `offBoard` — but its own "Hidden from guests" line already explains why,
  // and it is the couple's own doing. `waiting` is the surprising set: active,
  // approved, and still not shown, because the 20 slots are full.
  // ⚠ WHAT THIS BOARD COMMITS A GUEST TO SPEND. Every live challenge is a shot
  // out of the ONE shared pool, and until now this screen said nothing about
  // that: the board is in Set up, the balance is in Cameras, and a couple could
  // sign their guests up for hundreds of shots without a number in sight.
  // Derived from papicMissionCost — never a hand-typed 8.
  const onBoard = missions.filter((m) => m.board_slot !== null);
  const offBoard = missions.filter((m) => m.board_slot === null);
  const waiting = offBoard.filter((m) => m.is_active);

  // ── 🔑 MAY THIS SCREEN SAY "WAITING FOR A FREE SPOT"? ──────────────────────
  // Only when there is a board to be waiting BEHIND. Two ways that is false,
  // and they used to look identical to this component:
  //
  //   · the resolver was refused, so NOTHING has a slot — the live bug this
  //     flag was added for; and
  //   · the resolver ran and put nothing on the board, which it cannot do while
  //     an active approved couple pick exists (the couple lane is slotted
  //     FIRST), so an empty board beside waiting rows means the two reads
  //     disagree and we do not know which is right.
  //
  // ⚠ THE DIRECTION IS THE WHOLE POINT. "Your board is full, hide one to make
  // room" is an instruction to DELETE something, given on the strength of a
  // measurement we do not have. Not-measured is never zero and never a limit
  // reached: when we cannot tell, we say we cannot tell.
  //
  // The rule lives in `lib/papic-missions.ts` beside BOARD_SIZE, not in this
  // JSX, so it can be tested without a Supabase client — and so a second screen
  // cannot answer the same question differently.
  const reading: BoardReading = {
    resolved: board.resolved,
    onBoardCount: onBoard.length,
    waitingCount: waiting.length,
  };
  const boardReadable = boardIsTrustworthy(reading);
  const notShowingClaim = boardOccupancyClaim(reading);

  // Cost of the board a guest actually sees, per guest. Fail-soft: the pool read
  // degrades to "absent" on any error and we then say nothing about a balance
  // rather than printing a confident zero — a zero here reads as "you have no
  // credits left", which would be a lie told at the worst moment.
  const boardCostPerGuest = onBoard
    .filter((m) => m.is_active)
    .reduce((sum, m) => sum + papicMissionCost(m.capture_kind), 0);
  const pool = await fetchEventPoolStatus(createAdminClient(), eventId);
  const poolRemaining = pool.applies ? pool.remainingPoints : null;

  // ── ⏱ WHICH CHALLENGE IS BEING ASKED RIGHT NOW ────────────────────────────
  // Owner ruling 2026-09-01: the window is RELATIVE — it opens when a challenge
  // is ARMED, one at a time per celebration, and the last one closes when the
  // capture window ends. Until this, a challenge had no concept of time at all:
  // a prompt armed during the first dance was as live at 3am as it was then.
  //
  // 🔑 READ THROUGH THE RESOLVER, NOT FROM THE ROWS ABOVE. `armed_at` and
  // `closed_at` are on the mission rows this component already selects, and
  // deciding openness from them here would be a second answer to a question
  // that has exactly one — the guest's phone and this screen could then name
  // different live challenges. `papic_challenge_is_open` decides; this reads.
  const armedReading = await fetchArmedChallenge(supabase, eventId);

  // ⏰ THE CELEBRATION'S OWN CLOCK, NOT THE SERVER'S. This is a SERVER
  // component, so `toLocaleTimeString` with no timeZone formats in the
  // machine's zone — UTC on Vercel. A challenge running until 10:30 PM in
  // Manila would have been printed to the couple as "until 2:30 PM", on the one
  // screen somebody is reading DURING their reception. Asia/Manila is the
  // fallback the SQL side already uses (papic_challenge_ends_at, and
  // papic_guest_spend_ceiling before it), so the two agree.
  //
  // The error is BOUND, not discarded: a refused read leaves `eventRow` null,
  // which is indistinguishable from a celebration that simply stores no zone.
  // Both land on Asia/Manila — right for essentially every Setnayan event and
  // wrong for a travel one — so the refusal has to be visible somewhere, and
  // Sentry is where. Nothing on screen changes: a time is still shown, and the
  // fallback is the same zone the SQL side uses, so the two never disagree.
  const { data: eventRow, error: eventTzErr } = await supabase
    .from('events')
    .select('timezone')
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventTzErr) {
    logQueryError('coupleChallengesManager.eventTimezone', eventTzErr, { event_id: eventId }, 'graceful_degrade');
  }
  const eventTz = (eventRow?.timezone as string | null) || 'Asia/Manila';

  // ── The picker ────────────────────────────────────────────────────────────
  // Was: a list of the twenty story questions, and nothing else. The library is
  // now 631 challenges, so a list is no longer a way to choose — hence the
  // owner's own spec for this block: "here they can filter it so they can pick
  // which challenge they like. also search. but we will show the top 20 most
  // picked challenges."
  //
  // Filtering runs as a URL query (see `lib/papic-challenge-picker.ts`), so the
  // chips are links and the search box is a plain GET form. No client bundle,
  // and it works with JavaScript off — the same shape as every other control on
  // this screen.
  const filters = readFilters(search ?? {});

  // ⚠ THE TAKEN-SET IS READ WITHOUT AN is_active FILTER ON PURPOSE. A question
  // the couple has HIDDEN is still theirs — re-offering it would say "add this"
  // while their own list a few centimetres below says "Hidden from guests", and
  // tapping it would do nothing visible. Hidden means taken; un-hiding is the
  // Show button, not a second Add.
  const { data: takenRows, error: takenErr } = await supabase
    .from('papic_missions')
    .select('library_id')
    .eq('event_id', eventId)
    .not('library_id', 'is', null);

  // What kind of celebration this is (so a birthday is never offered a garter
  // toss) AND the word it uses for whoever is throwing it. Both come from the
  // shipped resolver rather than a second hand-rolled read: it is React-cache()d
  // per request, so this costs nothing the page was not already paying.
  // ⚠ It degrades to the WEDDING profile on a read failure — a deliberate
  // choice made when it was written, so that existing wedding flows could not
  // be disturbed by it. That is the wrong direction for THIS caller in theory;
  // in practice a couple who cannot read their own event has a broken page
  // regardless, and inventing a second resolver to disagree with the first is
  // how two answers to one question get shipped.
  const profile = await resolveProfileByEvent(eventId);
  const words = { organizer: profile.terminology.organizerNoun };

  const taken = new Set((takenRows ?? []).map((r) => Number(r.library_id)));
  // 🔑 ONLY WHEN BOTH READS ARE GOOD IS THE LIST TRUSTWORTHY. A failed taken-read
  // with a good library read would cheerfully offer questions they already have.
  const picker = takenErr
    ? { rows: [], total: 0, rankedByPicks: false, readable: false }
    : await fetchPickerRows(supabase, profile.eventType, taken, filters);

  const showingDefault = isDefaultView(filters);

  // ── HOW MANY OF THE TWENTY ARE THEIRS ──────────────────────────────────────
  // Owner, 2026-08-21: "up to 20 challenges." The couple's ceiling is the whole
  // board minus whatever a supplier has paid for, so it is DERIVED from the live
  // vendor count and never a hand-typed 20 — see `coupleSlots` and migration
  // 20271155952591. Today it is exactly 20: production holds zero sponsorships.
  const vendorLaneUsed = missions.filter(
    (m) => (m.source === 'vendor' || m.source === 'auto') && m.is_active,
  ).length;
  const ceiling = coupleSlots(vendorLaneUsed);
  const chosen = missions.filter((m) => m.source === 'couple' && m.is_active).length;
  const roomLeft = Math.max(0, ceiling - chosen);
  const soldAway = BOARD_SIZE - ceiling;

  // ── EMBEDDED: a summary and a door, never a second copy of the screen ──────
  if (!standalone) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <Trophy aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
          Papic Challenges
        </h3>
        <p className="mt-1 text-xs text-ink/60">
          Little photo missions for your guests. Pick up to {ceiling}.
        </p>
        {/* ⚠ A FAILED READ SAYS SO. `missions.length === 0` on an unreadable
            list would print "none chosen yet" at a couple who may have a full board —
            the confident lie this screen was rebuilt to stop telling. */}
        {!missionsReadable ? (
          <p className="mt-3 rounded-lg bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
            We couldn&rsquo;t load your challenges just now. Open the page below to try again.
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink/80">
            <span className="font-semibold tabular-nums">{chosen}</span> of{' '}
            <span className="tabular-nums">{ceiling}</span> chosen
            {onBoard.length > 0 ? (
              <>
                {' '}&middot; <span className="tabular-nums">{onBoard.length}</span> showing to guests
              </>
            ) : null}
            .
          </p>
        )}
        <Link
          href={`/dashboard/${eventId}/studio/papic/challenges`}
          className="button-primary mt-4 inline-flex"
        >
          {chosen > 0 ? 'Change your challenges' : 'Pick your challenges'} &rarr;
        </Link>
      </section>
    );
  }


  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
        <Trophy aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
        Papic Challenges
      </h3>

      {/* ⚠ THE NUMBER IS THE POINT OF THIS SCREEN, SO IT LEADS.
          Until 2026-08-21 the couple's own lane was capped at TEN while the
          board showed more: a couple who picked twelve got ten, and the two
          that did not fit had no board position and no explanation anywhere.
          Now the ceiling is stated, counted down, and enforced at the Add
          button — a limit somebody can see is a rule; a limit that silently
          drops their work is a defect. */}
      <p
        className="mt-2 text-sm text-ink/80"
        aria-label={`${chosen} of ${ceiling} challenges chosen, ${roomLeft} still free`}
      >
        <span className="font-semibold tabular-nums">{chosen}</span> of{' '}
        <span className="tabular-nums">{ceiling}</span> chosen
        {roomLeft > 0 ? (
          <> &mdash; room for <span className="tabular-nums">{roomLeft}</span> more.</>
        ) : (
          <> &mdash; that&rsquo;s the lot. Remove one to swap it out.</>
        )}
      </p>
      <p className="mt-1 text-xs text-ink/60">
        Your guests see up to {BOARD_SIZE} on their phone. Anything you don&rsquo;t
        pick, we fill in for you &mdash; so the board is never empty. Booth
        challenges appear here as you book suppliers.
      </p>
      {/* Only ever shown when it is TRUE. A permanent "0 slots are sponsored"
          line would be noise on every event, and today it is nought on all of
          them. */}
      {soldAway > 0 ? (
        <p className="mt-2 rounded-lg bg-ink/5 px-3 py-2 text-[11px] text-ink/70">
          <span className="tabular-nums">{soldAway}</span>{' '}
          {soldAway === 1 ? 'slot is' : 'slots are'} held by a supplier who
          sponsored a challenge for you, so your own limit is {ceiling}.
        </p>
      ) : null}

      {/* ⚠ THE COST, ON THE SCREEN THAT SPENDS IT. The board lives here in Set
          up; the shared pool lives over in Cameras. A couple could sign their
          guests up for hundreds of shots without a number in sight. Numbers are
          derived — never a hand-typed 8. */}
      {boardCostPerGuest > 0 ? (
        <p className="mt-3 rounded-xl border border-terracotta/25 bg-terracotta/[0.05] px-3 py-2 text-xs text-ink/75">
          A guest who does every challenge on the board spends{' '}
          <span className="font-semibold tabular-nums">{boardCostPerGuest}</span>{' '}
          {boardCostPerGuest === 1 ? 'shot' : 'shots'} from your shared pool
          {poolRemaining !== null ? (
            <>
              {' '}— you have{' '}
              <span className="font-semibold tabular-nums">
                {poolRemaining.toLocaleString('en-PH')}
              </span>{' '}
              left.
            </>
          ) : (
            '.'
          )}{' '}
          A photo costs one; a video costs more.
        </p>
      ) : null}

      {/* Author your own */}
      <form action={createCoupleChallengeAction} className="mt-4 space-y-2">
        <input type="hidden" name="event_id" value={eventId} />
        <textarea
          name="prompt"
          required
          maxLength={280}
          rows={2}
          aria-label="Write a Papic Challenge for your guests"
          placeholder="Get a photo with the newlyweds on the dance floor"
          className="w-full resize-none rounded-xl border border-ink/10 bg-cream/70 px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-mulberry/40 focus:outline-none"
        />
        <SubmitButton
          pendingLabel="Adding"
          className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add challenge
        </SubmitButton>
      </form>

      {/* ── The picker: 631 challenges, filtered and searched ───────────────
          The owner's spec, verbatim: "here they can filter it so they can pick
          which challenge they like. also search. but we will show the top 20
          most picked challenges."

          🔑 THE SHELF NAMES ITS OWN ORDER. Today nobody has picked anything, so
          "Most picked" would be a claim about other couples that is not true.
          `rankedByPicks` says which of the two orders is on screen and the
          subheading changes with it. Presenting our own recommendations as
          popularity is the launch-day empty-rail failure wearing a compliment. */}
      {!picker.readable ? (
        // Suppressed, not empty. An empty picker is indistinguishable from
        // "you have added them all", which is the most reassuring possible way
        // to show a broken screen.
        <p className="mt-5 rounded-lg bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
          We couldn&rsquo;t load the challenge library just now. Refresh the page
          &mdash; nothing has changed.
        </p>
      ) : (
        <div className="mt-5 rounded-xl border border-gold/25 bg-gold/[0.04] p-4">
          <h4 className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <MessageSquareQuote aria-hidden className="h-4 w-4 text-gold-700" strokeWidth={1.75} />
            {showingDefault
              ? picker.rankedByPicks
                ? 'Most picked'
                : 'Where most people start'
              : 'Challenges you can add'}
          </h4>
          <p className="mt-1 text-xs text-ink/60">
            {showingDefault
              ? picker.rankedByPicks
                ? `The ${PICKER_PAGE_SIZE} other hosts add most often. Search or filter below for the rest.`
                : `Our ${PICKER_PAGE_SIZE} to begin with — nobody has picked enough yet for a favourites list. Search or filter below for the rest.`
              : `${picker.total} ${picker.total === 1 ? 'match' : 'matches'}${
                  picker.total > picker.rows.length ? ` — showing the first ${picker.rows.length}` : ''
                }.`}
          </p>

          {/* Search. A GET form, so the result is a shareable URL and the back
              button works. `cq` rather than `q`: this page already carries
              fifteen other params and a bare `q` is the first thing another
              feature would reach for. */}
          <form method="GET" className="mt-3 flex gap-2">
            {/* The page's own params are NOT carried through. A stale
                `?papic_purchased=1` re-firing its banner on every search would
                congratulate somebody for a purchase they made ten minutes ago. */}
            <label htmlFor="cq" className="sr-only">
              Search the challenges
            </label>
            <div className="relative flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35"
                strokeWidth={1.75}
              />
              <input
                id="cq"
                name="cq"
                type="search"
                defaultValue={filters.q}
                maxLength={60}
                placeholder="cake, dancing, lola, a story…"
                className="w-full rounded-xl border border-ink/10 bg-cream/70 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/35 focus:border-mulberry/40 focus:outline-none"
              />
            </div>
            {/* The chip and kind survive a search, so typing does not silently
                widen a filter the couple set a moment ago. */}
            {filters.category ? (
              <input type="hidden" name="ccat" value={filters.category} />
            ) : null}
            {filters.kind ? <input type="hidden" name="ckind" value={filters.kind} /> : null}
            <SubmitButton
              pendingLabel="Searching"
              className="inline-flex shrink-0 items-center rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              Search
            </SubmitButton>
          </form>

          {/* Photo / Video, then the twelve themes. Links, not buttons: a filter
              is a place, and a place should be linkable and go-backable. */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <FilterChip eventId={eventId} filters={filters} patch={{ kind: null }} label="All" active={filters.kind === null} />
            <FilterChip eventId={eventId} filters={filters} patch={{ kind: 'photo' }} label="Photo" active={filters.kind === 'photo'} />
            <FilterChip eventId={eventId} filters={filters} patch={{ kind: 'clip' }} label="Video" active={filters.kind === 'clip'} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <FilterChip
              eventId={eventId}
              filters={filters}
              patch={{ category: null }}
              label="Everything"
              active={filters.category === null}
            />
            {CATEGORY_ORDER.map((cat) => (
              <FilterChip
                key={cat}
                eventId={eventId}
                filters={filters}
                patch={{ category: cat }}
                label={CATEGORY_LABELS[cat]}
                active={filters.category === cat}
              />
            ))}
          </div>

          {!showingDefault ? (
            <Link
              href={`/dashboard/${eventId}/studio/papic#challenges`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-link underline underline-offset-2"
            >
              <X aria-hidden className="h-3 w-3" strokeWidth={2} />
              Clear search and filters
            </Link>
          ) : null}

          {/* ⚠ THIS SAID "up to 10 of your own picks" AND THAT WAS THE BUG.
              It was true — the couple lane really was capped at ten — and it was
              the only place in the product that said so, at the bottom of a
              block, after they had already chosen. The cap is now the whole
              board and the count lives at the top; what remains here is the
              honest end-stop. */}
          {roomLeft === 0 ? (
            <p className="mt-3 rounded-lg bg-ink/5 px-3 py-2 text-[11px] text-ink/70">
              You have picked all {ceiling}. Remove one below to make room.
            </p>
          ) : null}

          {picker.rows.length === 0 ? (
            <p className="mt-4 text-sm text-ink/45">
              {showingDefault
                ? 'You have added every challenge we have. That is a first.'
                : 'Nothing matches that. Try a different word, or clear the filters.'}
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {picker.rows.map((row) => (
                <li
                  key={row.library_id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-ink/10 bg-cream/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink">
                      {row.title}
                      <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-normal text-ink/60">
                        {KIND_LABEL[row.capture_kind]}
                      </span>
                      <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-normal text-ink/50">
                        {CATEGORY_LABELS[row.category]}
                      </span>
                      {/* Only ever shown when it is a real number. A "0 events"
                          badge on every row would be a worse silence than none. */}
                      {row.picks > 0 ? (
                        <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-normal text-gold-700">
                          {row.picks} {row.picks === 1 ? 'event' : 'events'}
                        </span>
                      ) : null}
                    </p>
                    {/* Neutral wording — a raw {who} or {host} token is never
                        shown to the couple. Each guest sees their own version. */}
                    <p className="mt-0.5 text-sm text-ink/80">
                      {displayChallengePrompt(row.prompt, { organizer: words.organizer })}
                    </p>
                  </div>
                  {/* 🔑 THE END-STOP IS SHOWN, NOT ENFORCED IN SILENCE. When
                      the board is full the Add button becomes a disabled chip
                      that says Full, rather than a live button whose press does
                      nothing visible. The server action refuses independently —
                      this is the half that stops somebody TRYING. */}
                  {roomLeft === 0 ? (
                    <span
                      aria-disabled="true"
                      title={`You have picked all ${ceiling}. Remove one to make room.`}
                      className="inline-flex shrink-0 items-center rounded-md border border-ink/10 bg-ink/5 px-2.5 py-1.5 text-xs font-medium text-ink/40"
                    >
                      Full
                    </span>
                  ) : (
                    <form action={addLibraryChallengeAction} className="shrink-0">
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="library_id" value={row.library_id} />
                      <SubmitButton
                        pendingLabel="Adding"
                        className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
                      >
                        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        Add
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── The list, in two groups ──────────────────────────────────────────
          It used to be ONE flat list in creation order, which answered neither
          question a couple actually has: what will my guests see, and in what
          order. Worse, the 20-slot board silently drops the overflow, so a
          couple could read a list of 24 with no hint that four of them reach
          nobody. Same order as the guest board, and the overflow says so. */}
      {!missionsReadable ? (
        <p className="mt-4 rounded-lg bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
          We couldn&rsquo;t load your challenges just now. Refresh the page &mdash;
          nothing has changed.
        </p>
      ) : missions.length === 0 ? (
        <p className="mt-4 text-sm text-ink/45">
          No challenges yet — add one above, or they&rsquo;ll appear as you book vendors.
        </p>
      ) : (
        <>
          <div className="mt-6">
            <h4 className="text-sm font-medium text-ink">
              What your guests see{onBoard.length > 0 ? ` · ${onBoard.length}` : ''}
            </h4>
            <p className="mt-0.5 text-xs text-ink/55">In this order, on their phone.</p>
            {/* ⏱ The clock, stated once. Three different sentences for three
                different states — an un-armed celebration and a read we could
                not make are NOT the same thing, and collapsing them is how a
                couple mid-reception gets told nothing is running when
                something is. */}
            {!armedReading.measured ? (
              <p className="mt-2 rounded-lg bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
                We couldn&rsquo;t check which challenge is being asked just now.
                Refresh in a moment &mdash; nothing has stopped, and your guests
                can still take photos either way.
              </p>
            ) : armedReading.armed ? (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-ink/70">
                <Radio aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-mulberry" strokeWidth={2} />
                <span>
                  Being asked now:{' '}
                  <span className="font-medium text-ink">
                    {displayChallengePrompt(armedReading.armed.prompt)}
                  </span>
                  {/* ⏱ The INSTANT the database decided, formatted — never
                      `armedAt + 30 minutes` worked out here. Three things can
                      end a challenge and the earliest wins; a sum computed on
                      this screen would be confidently wrong whenever the next
                      arming or the capture window bit first. */}
                  {armedReading.armed.expiresAt ? (
                    <span className="text-ink/55">
                      {' '}&middot; until {formatUntil(armedReading.armed.expiresAt, eventTz)}
                    </span>
                  ) : null}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink/45">
                No challenge is being asked yet. Start one when the moment comes
                &mdash; it runs for the time you pick, or until you start the next.
              </p>
            )}
            {onBoard.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {onBoard.map((m) => (
                  <ChallengeRow
                    key={m.mission_id}
                    m={m}
                    eventId={eventId}
                    armed={armedReading}
                    timeZone={eventTz}
                  />
                ))}
              </ul>
            ) : boardReadable ? (
              <p className="mt-2 text-sm text-ink/45">
                Nothing is showing yet — unhide one below, or add a challenge above.
              </p>
            ) : (
              /* ⚠ NOT "nothing is showing yet". That sentence is a statement
                 about the board, and we could not read the board. Telling a
                 couple their challenges reach nobody — when the truth is that we
                 failed to work it out — is the same confident lie in a quieter
                 voice. */
              <p className="mt-2 rounded-lg bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
                We couldn&rsquo;t work out which of these your guests see just
                now. Refresh in a moment &mdash; nothing has changed, and nothing
                needs removing.
              </p>
            )}
          </div>

          {offBoard.length > 0 ? (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-ink">
                Not showing · {offBoard.length}
              </h4>
              <p className="mt-0.5 text-xs text-ink/55">
                {/* 🔑 THE INVERSION THIS SCREEN SHIPPED. "Waiting for a free
                    spot — hide one above to make room" claims the board is
                    FULL. When the resolver was refused every challenge had a
                    null slot and that branch fired on an EMPTY board: a couple
                    with nothing showing to anyone was told to delete their own
                    challenges to make room. Which sentence is allowed is now
                    `boardOccupancyClaim`'s decision, not this file's. */}
                {notShowingClaim.kind === 'hidden_by_you'
                  ? 'Hidden by you. Tap the eye to bring one back.'
                  : notShowingClaim.kind === 'waiting'
                    ? `Your guests see ${BOARD_SIZE} challenges at a time. ${
                        notShowingClaim.waiting === 1
                          ? 'This one is waiting for a free spot'
                          : `These ${notShowingClaim.waiting} are waiting for a free spot`
                      } — hide one above to make room.`
                    : 'We couldn’t work out where these sit on your board just now. Refresh in a moment — nothing has changed, and nothing needs removing.'}
              </p>
              <ul className="mt-2 space-y-2">
                {offBoard.map((m) => (
                  <ChallengeRow
                    key={m.mission_id}
                    m={m}
                    eventId={eventId}
                    armed={armedReading}
                    timeZone={eventTz}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * The wall-clock time a challenge stops being asked, IN THE CELEBRATION'S OWN
 * TIMEZONE. Formatting only — the instant comes from `papic_challenge_ends_at`
 * and nothing here decides, adds to or compares it.
 *
 * ⚠ `timeZone` IS NOT OPTIONAL POLISH. This renders on the server, so without
 * it the couple reads the time in the server's zone (UTC in production) — a
 * confident, wrong number on the screen somebody is using during the party.
 * An unparseable instant renders as nothing rather than "Invalid Date".
 */
function formatUntil(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone });
  } catch {
    // An unknown zone string throws RangeError. Falling back to the platform's
    // zone beats blanking the line — and beats crashing the couple's page.
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  }
}

/** One row of the couple's list. Extracted so the on-board and not-showing
 *  groups render identically — two copies of this markup is how the two groups
 *  would quietly drift apart. */
function ChallengeRow({
  m,
  eventId,
  armed,
  timeZone,
}: {
  m: MissionRow;
  eventId: string;
  armed: ArmedChallengeReading;
  timeZone: string;
}) {
  // ⚠ `armed.measured === false` is NOT "this one is not live". When the read
  // was refused we know nothing about any row, so neither the badge nor its
  // absence may be shown as a claim — the button stays, because a coordinator
  // mid-reception must still be able to start the next challenge.
  const isLiveNow = armed.measured && armed.armed?.missionId === m.mission_id;
  // The Record is exhaustive over PapicMissionSource, so this only fires on a
  // value the database allows and TypeScript has not heard of. It must NOT fall
  // back to another source's badge — defaulting to `vendor` is exactly how
  // Setnayan's own recommendations came to be labelled as a vendor's.
  const badge = SOURCE_BADGE[m.source] ?? { label: 'Challenge', cls: 'bg-ink/10 text-ink/60' };
  const kind = m.capture_kind ? KIND_LABEL[m.capture_kind] : null;

  return (
    <li
      className={`rounded-xl border border-ink/10 bg-cream/70 p-3 ${
        m.is_active ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {/* The guest's position, so this list and their phone agree. */}
          {m.board_slot !== null ? (
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-[11px] font-semibold tabular-nums text-ink/55"
            >
              {m.board_slot}
            </span>
          ) : null}
          <div className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
              >
                {badge.label}
              </span>
              {kind ? (
                <span className="inline-block rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/50">
                  {kind}
                </span>
              ) : null}
            </span>
            {/* The story challenges store a {who} side token that the guest
                reader swaps per guest. The couple is not a side, so they see the
                neutral wording — never the raw token. */}
            <p className="mt-1 text-sm text-ink/90">{displayChallengePrompt(m.prompt)}</p>
            {!m.is_active ? (
              <p className="mt-0.5 text-[11px] text-ink/45">Hidden from guests</p>
            ) : null}
            {isLiveNow ? (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-mulberry/10 px-2 py-0.5 text-[11px] font-medium text-mulberry">
                <Radio aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                Being asked now
                {armed.measured && armed.armed?.expiresAt
                  ? ` · until ${formatUntil(armed.armed.expiresAt, timeZone)}`
                  : ''}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* ⏱ Start this one. The window opens HERE (owner 2026-09-01) and
              closing the previous one is the same act, done in one transaction
              by papic_arm_challenge — never two taps.

              Not gated on board_slot: when no board has been materialized every
              slot is NULL and the guest reader fail-softs to showing all active
              challenges, so gating here would hide the control on exactly the
              celebrations whose challenges ARE reaching guests. Gated on
              is_active, which is what "a guest can see this" means. */}
          {m.is_active && !isLiveNow ? (
            <form action={armChallengeAction} className="flex items-center gap-1">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="mission_id" value={m.mission_id} />
              {/* ⏱ How long it runs. Owner 2026-09-01: 30 minutes by default,
                  or an hour, or two. A plain select rather than a second
                  screen — the choice is made in the same tap as starting it,
                  because a coordinator making it is standing in a reception. */}
              <label className="sr-only" htmlFor={`len-${m.mission_id}`}>
                How long this challenge runs
              </label>
              <select
                id={`len-${m.mission_id}`}
                name="duration_minutes"
                defaultValue={CHALLENGE_DURATION_DEFAULT}
                className="rounded-md border border-ink/15 bg-cream px-1.5 py-1.5 text-[11px] text-ink/70"
              >
                {CHALLENGE_DURATION_CHOICES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {CHALLENGE_DURATION_LABELS[minutes]}
                  </option>
                ))}
              </select>
              <SubmitButton
                title="Ask this one now"
                aria-label="Ask this challenge now"
                className="inline-flex items-center gap-1 rounded-md border border-mulberry/30 bg-cream px-2 py-1.5 text-[11px] font-medium text-mulberry transition-colors hover:bg-mulberry/10"
              >
                <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                Ask now
              </SubmitButton>
            </form>
          ) : null}
          {/* Hide / show — curation for every source. */}
          <form action={setCoupleChallengeActiveAction}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="mission_id" value={m.mission_id} />
            <input type="hidden" name="active" value={m.is_active ? 'false' : 'true'} />
            <button
              type="submit"
              title={m.is_active ? 'Hide from guests' : 'Show to guests'}
              aria-label={m.is_active ? 'Hide from guests' : 'Show to guests'}
              className="inline-flex items-center rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              {m.is_active ? (
                <EyeOff aria-hidden className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Eye aria-hidden className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          </form>
          {/* Delete — only the couple's own. */}
          {m.source === 'couple' ? (
            <form action={deleteCoupleChallengeAction}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="mission_id" value={m.mission_id} />
              <button
                type="submit"
                title="Delete"
                aria-label="Delete challenge"
                className="inline-flex items-center rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-ink/50 transition-colors hover:border-terracotta/40 hover:text-terracotta-700"
              >
                <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}
