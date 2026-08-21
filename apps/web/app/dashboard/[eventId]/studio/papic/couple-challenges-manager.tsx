// Papic Games — couple challenge manager (spec §5 / gap #1 + #8). Lets the couple
// AUTHOR their own generic challenges (so every event has a real game, not just
// booth missions for booked vendors) and CURATE the live set — hide/show any
// mission, delete their own. Async SERVER component: self-fetches the event's
// APPROVED missions (RLS-scoped authenticated client) — pending vendor challenges
// stay in the separate approval panel. Self-gates on papicGamesEnabled().

import Link from 'next/link';
import { Trophy, Eye, EyeOff, Trash2, Plus, MessageSquareQuote, Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicMissionCost } from '@/lib/papic-cameras';
import { fetchEventPoolStatus } from '@/lib/papic-event-pool';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import { eventPabatiActive } from '@/lib/pabati';
import { resolveProfileByEvent } from '@/lib/event-type-profile';
import { ensurePapicBoard } from '@/lib/papic-games';
import {
  BOARD_SIZE,
  displayChallengePrompt,
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
  createCoupleChallengeAction,
  addLibraryChallengeAction,
  setCoupleChallengeActiveAction,
  deleteCoupleChallengeAction,
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
  pabati: 'Video greeting',
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
}: {
  eventId: string;
  /** The picker's own URL keys, prefixed `c` so they cannot collide with the
   *  fifteen other `?papic_*` params this page already carries. */
  search?: { cq?: string; ccat?: string; ckind?: string };
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
  // destroys anything. `pabatiActive` is computed server-side here, exactly as
  // the guest route does it; a wrong value would show Pabati on a board that
  // will not carry it. Fail-soft on error (the wrapper returns 0), and the list
  // below still renders — just without positions.
  const pabatiActive = await eventPabatiActive(supabase, eventId);
  await ensurePapicBoard(supabase, eventId, pabatiActive);

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
  // about an event that may have twenty.
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

  // Cost of the board a guest actually sees, per guest. Fail-soft: the pool read
  // degrades to "absent" on any error and we then say nothing about a balance
  // rather than printing a confident zero — a zero here reads as "you have no
  // shots left", which would be a lie told at the worst moment.
  const boardCostPerGuest = onBoard
    .filter((m) => m.is_active)
    .reduce((sum, m) => sum + papicMissionCost(m.capture_kind), 0);
  const pool = await fetchEventPoolStatus(createAdminClient(), eventId);
  const poolRemaining = pool.applies ? pool.remainingPoints : null;

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

  // The board shows at most 10 of the couple's own picks. Past that an added
  // question is real but waits its turn, and saying so beats a guest board that
  // quietly does not match what this screen lists.
  const couplePicked = missions.filter((m) => m.source === 'couple').length;

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
        <Trophy aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
        Papic Challenges
      </h3>
      <p className="mt-1 text-xs text-ink/60">
        Little photo missions for your guests. We add a set of recommended ones;
        write your own, and hide any you don&rsquo;t want — booth challenges
        appear here as you book vendors.
      </p>

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

          {couplePicked >= 10 ? (
            <p className="mt-3 rounded-lg bg-ink/5 px-3 py-2 text-[11px] text-ink/70">
              Your guests see up to 10 of your own picks at once. Anything you add
              now waits until you hide one of yours.
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
            {onBoard.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {onBoard.map((m) => (
                  <ChallengeRow key={m.mission_id} m={m} eventId={eventId} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink/45">
                Nothing is showing yet — unhide one below, or add a challenge above.
              </p>
            )}
          </div>

          {offBoard.length > 0 ? (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-ink">
                Not showing · {offBoard.length}
              </h4>
              <p className="mt-0.5 text-xs text-ink/55">
                {waiting.length > 0
                  ? `Your guests see ${BOARD_SIZE} challenges at a time. ${
                      waiting.length === 1
                        ? 'This one is waiting for a free spot'
                        : `These ${waiting.length} are waiting for a free spot`
                    } — hide one above to make room.`
                  : 'Hidden by you. Tap the eye to bring one back.'}
              </p>
              <ul className="mt-2 space-y-2">
                {offBoard.map((m) => (
                  <ChallengeRow key={m.mission_id} m={m} eventId={eventId} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** One row of the couple's list. Extracted so the on-board and not-showing
 *  groups render identically — two copies of this markup is how the two groups
 *  would quietly drift apart. */
function ChallengeRow({ m, eventId }: { m: MissionRow; eventId: string }) {
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
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
