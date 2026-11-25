import { papicCardHref, type PapicCardSeat } from '@/lib/papic-home-href';
import { PapicStayForm } from './_components/papic-stay-form';
import { ChallengeRowSwipe } from './_components/challenge-row-swipe';
import { ChallengeCardRow } from './_components/challenge-card-row';
// Papic Games — couple challenge manager (spec §5 / gap #1 + #8). Lets the couple
// AUTHOR their own generic challenges (so every event has a real game, not just
// booth missions for booked vendors) and CURATE the live set — hide/show any
// mission, delete their own. Async SERVER component: self-fetches the event's
// APPROVED missions (RLS-scoped authenticated client) — pending vendor challenges
// stay in the separate approval panel. Self-gates on papicGamesEnabled().

import Link from 'next/link';
import { Trophy, Eye, EyeOff, Plus, MessageSquareQuote, Search, X, Radio, Play, Square } from 'lucide-react';
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
  boardLaneCounts,
  boardShowingWords,
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
  setChallengesPausedAction,
  armChallengeAction,
  stopChallengeAction,
} from './actions';
import { formatCount } from '@/lib/format-number';
import { fetchPauseState } from '@/lib/papic-challenge-pause';
import { ACTIVE_CHALLENGE_CAP } from '@/lib/papic-missions';
import { InfoTip } from '@/app/_components/info-tip';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';

import { PostedPick } from '@/app/dashboard/[eventId]/_components/posted-pick';
export type MissionRow = {
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
  /** The library row it came from — null for one written by hand. */
  library_id?: number | null;
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
  vendor: { label: 'Supplier', cls: 'bg-ink/10 text-ink/70' },
  setnayan: { label: 'Recommended', cls: 'bg-gold/15 text-gold-700' },
};


export async function CoupleChallengesManager({
  eventId,
  inCard = false,
  returnTo = null,
}: {
  eventId: string;
  /**
   * 📷 INSIDE THE PAPIC CARD (owner rulings 2026-10-24, the approved sketch): the board a guest sees, IN PLACE — a
   * tag and a switch per challenge (`setCoupleChallengeActiveAction`) and "+ Add your own" (`createCoupleChallengeAction`),
   * under one "Challenges" row that says how many are showing. The same read as the other two arms.
   */
  inCard?: boolean;
  /** 🖼 The Papic card's seat ('memories' since 2026-11-08) when drawn inside it — every press lands back there. */
  returnTo?: PapicCardSeat | null;
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
    .select('mission_id,source,prompt,is_active,board_slot,capture_kind,library_id,created_at')
    .eq('event_id', eventId)
    .eq('approved', true)
    // ✕ A removed challenge leaves the host's list for good (owner 2026-10-26); its row stays for the photos it tagged.
    .is('removed_at', null)
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
  const filters = readFilters({});

  // ⚠ THE TAKEN-SET IS READ WITHOUT AN is_active FILTER ON PURPOSE. A question
  // the couple has HIDDEN is still theirs — re-offering it would say "add this"
  // while their own list a few centimetres below says "Hidden from guests", and
  // tapping it would do nothing visible. Hidden means taken; un-hiding is the
  // Show button, not a second Add.
  const { data: takenRows, error: takenErr } = await supabase
    .from('papic_missions')
    .select('library_id')
    .eq('event_id', eventId)
    .not('library_id', 'is', null)
    // ✕ …and a removed one may be picked again (a fresh challenge; the removed row keeps its old photos).
    .is('removed_at', null);
  if (takenErr) console.error('[supabase-error] app/dashboard/[eventId]/studio/papic/couple-challenges-manager.tsx · from:papic_missions.select', takenErr);

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
  if (inCard) {
    // 📷 IN THE PAPIC CARD: ONE "Challenges" row — "N of 10 challenges on" — whose switch is the board's master switch,
    // the shipped PAUSE (`setChallengesPausedAction`: the board stays, untouched, and comes back as it was). On: the TEN
    // SLOTS (owner 2026-10-27), each `ChallengeCardRow` — its name opens the one challenge sheet (search the 631-row
    // library · create your own) and a pick REPLACES it in place; its switch turns just that one off, and it stays in
    // its slot. No "Add a challenge", no ✕. The hard cap of 10 live is the server's (`activationRefused`).
    const [pause, typeRes] = await Promise.all([
      fetchPauseState(supabase, eventId),
      supabase.from('events').select('event_type').eq('event_id', eventId).maybeSingle(),
    ]);
    const off = pause.measured && pause.pausedAt !== null;
    const running = missions.filter((m) => m.is_active);
    const full = running.length >= ACTIVE_CHALLENGE_CAP;
    const taken = missions.map((m) => m.library_id).filter((id): id is number => typeof id === 'number');
    const ret = returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null;
    const eventType = ((typeRes.data as { event_type?: string | null } | null)?.event_type ?? null) as string | null;
    // The ten: what the event has, oldest first (stable — a switch never reorders), padded to ten with slots to choose.
    const listed = [...missions]
      .sort((a, b) => String((a as { created_at?: string }).created_at ?? '').localeCompare(String((b as { created_at?: string }).created_at ?? '')))
      .slice(0, ACTIVE_CHALLENGE_CAP);
    const slots: Array<(typeof listed)[number] | null> = [...listed, ...Array.from({ length: ACTIVE_CHALLENGE_CAP - listed.length }, () => null)];
    return (
      <section className="flex flex-col" data-papic-challenges-card={off ? 'off' : 'on'}>
        <div className="flex items-center gap-3 py-3">
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <InfoTip label="Challenges" labelClassName="text-[15px] font-semibold text-ink" align="start">
                Ten little photo missions on every guest&rsquo;s board. Tap one to choose a different challenge — search
                ours or write your own; photos already taken keep the old one. Switch one off and it stays in its place,
                just not live. The switch up here pauses the whole board (for a moment everybody must be watching) and it
                comes back exactly as it was.
              </InfoTip>
              {missionsReadable ? (
                <span className="text-[12.5px] text-ink/70" data-papic-challenges-count="">
                  {formatCount(running.length)} of {formatCount(ACTIVE_CHALLENGE_CAP)} challenges on
                </span>
              ) : null}
            </span>
            <span className="block text-[12.5px] text-ink/70" data-papic-challenges-showing="">
              {!pause.measured ? 'Couldn’t check whether they are on' : off ? 'Off' : missionsReadable ? 'On' : 'Couldn’t load your challenges'}
            </span>
          </span>
          {pause.measured ? (
            <PapicStayForm door="setChallengesPausedAction" action={setChallengesPausedAction} className="shrink-0">
              <input type="hidden" name="event_id" value={eventId} />
              {off ? <input type="hidden" name="resume" value="1" /> : null}
              {ret}
              <button type="submit" role="switch" aria-checked={!off} aria-label="Challenges" className={SWITCH_BUTTON}>
                <SwitchTrack on={!off} />
              </button>
            </PapicStayForm>
          ) : null}
        </div>
        {off ? null : (
          <>
            {missionsReadable ? (
              /* 🎚 TEN SLOTS, ALWAYS TEN ROWS (owner 2026-10-27: "there will be 10 challenges the can make. choose a
                 challenge or turn that challenge off. turning 1 off will become 9 of 10 challenges. it stays there, but
                 just off."). Each row: its name — tap to choose its challenge (search · create; the pick replaces it in
                 place) · its switch. In the order they were made, so a switch never moves a row (an off row keeps its
                 place; a replacement takes the replaced one's `created_at`). No "Add a challenge" button, no ✕. */
              <ul className="divide-y divide-ink/10" data-papic-challenges-running="">
                {slots.map((m, i) => (
                  <ChallengeCardRow key={m?.mission_id ?? `slot-${i}`} eventId={eventId} eventType={eventType} taken={taken} mission={m} full={full} returnTo={returnTo} />
                ))}
              </ul>
            ) : null}
            {full ? (
              <p className="pt-2 text-[12.5px] text-ink/70" data-papic-challenges-full="">
                10 are on — turn one off to turn another on.
              </p>
            ) : null}
          </>
        )}
      </section>
    );
  }

  // Final check R6 (25 Nov): the Papic challenges and run-of-show PAGES are retired; this board is drawn only inside the
  // Papic card (`inCard`). Their summary card and full-screen picker went with them.
  return null;
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
export function ChallengeRow({
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
  const badge = SOURCE_BADGE[m.source] ?? { label: 'Challenge', cls: 'bg-ink/10 text-ink/70' };
  const kind = m.capture_kind ? KIND_LABEL[m.capture_kind] : null;

  const row = (
    <div
      className={`rounded-xl border border-ink/10 bg-cream/70 p-3 ${
        m.is_active || m.source === 'couple' ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {/* The guest's position, so this list and their phone agree. */}
          {m.board_slot !== null ? (
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-[12px] font-semibold tabular-nums text-ink/70"
            >
              {m.board_slot}
            </span>
          ) : null}
          <div className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide ${badge.cls}`}
              >
                {badge.label}
              </span>
              {kind ? (
                <span className="inline-block rounded-full bg-ink/[0.06] px-2 py-0.5 text-[12px] font-medium uppercase tracking-wide text-ink/70">
                  {kind}
                </span>
              ) : null}
            </span>
            {/* The story challenges store a {who} side token that the guest
                reader swaps per guest. The couple is not a side, so they see the
                neutral wording — never the raw token. */}
            <p className="mt-1 text-sm text-ink/90">{displayChallengePrompt(m.prompt)}</p>
            {!m.is_active ? (
              <p className="mt-0.5 text-[12px] text-ink/70">Hidden from guests</p>
            ) : null}
            {isLiveNow ? (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-mulberry/10 px-2 py-0.5 text-[12px] font-medium text-mulberry">
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
            <PapicStayForm door="armChallengeAction" action={armChallengeAction} className="flex items-center gap-1">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="mission_id" value={m.mission_id} />
              {/* ⏱ How long it runs. Owner 2026-09-01: 30 minutes by default,
                  or an hour, or two. A plain select rather than a second
                  screen — the choice is made in the same tap as starting it,
                  because a coordinator making it is standing in a reception. */}
              <PostedPick
                name="duration_minutes"
                label="How long"
                initial={String(CHALLENGE_DURATION_DEFAULT)}
                options={CHALLENGE_DURATION_CHOICES.map((minutes) => ({ key: String(minutes), label: CHALLENGE_DURATION_LABELS[minutes] }))}
              />
              <SubmitButton
                title="Ask this one now"
                aria-label="Ask this challenge now"
                className="inline-flex items-center gap-1 rounded-md border border-mulberry/30 bg-cream px-2 py-1.5 text-[12px] font-medium text-mulberry transition-colors hover:bg-mulberry/10"
              >
                <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                Ask now
              </SubmitButton>
            </PapicStayForm>
          ) : null}
          {/* ⏹ Stop — ends the prompt, keeps the challenge. Deliberately NOT
              the eye below it: hiding takes the challenge off every guest's
              board, which is a different and much bigger act. Only rendered on
              the one that is actually running. */}
          {isLiveNow ? (
            <PapicStayForm door="stopChallengeAction" action={stopChallengeAction}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="mission_id" value={m.mission_id} />
              <SubmitButton
                title="Stop asking this one"
                aria-label="Stop asking this challenge"
                className="inline-flex items-center gap-1 rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-[12px] font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <Square aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
                Stop
              </SubmitButton>
            </PapicStayForm>
          ) : null}
          {/* Hide / show — curation for every source. */}
          <PapicStayForm door="setCoupleChallengeActiveAction" action={setCoupleChallengeActiveAction}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="mission_id" value={m.mission_id} />
            <input type="hidden" name="active" value={m.is_active ? 'false' : 'true'} />
            <button
              type="submit"
              title={m.is_active ? 'Hide from guests' : 'Show to guests'}
              aria-label={m.is_active ? 'Hide from guests' : 'Show to guests'}
              className="inline-flex items-center rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              {m.is_active ? (
                <EyeOff aria-hidden className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Eye aria-hidden className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          </PapicStayForm>
        </div>
      </div>
    </div>
  );
  /* 👈 Delete — only the couple's own, and it is the row's SWIPE (owner 2026-11-03, "SWIPE LEFT TO DELETE ON EVERY LIST
     ROW — NO VISIBLE ✕ ON ROWS"): no trash on the row; `ChallengeRowSwipe` reaches the same soft remove
     (`deleteCoupleChallengeAction`, since 2026-10-26 — photos already taken keep the challenge) with Undo. Setnayan's
     and suppliers' challenges are curated with the eye, never deleted, so they stay plain rows. */
  if (m.source !== 'couple') return <li>{row}</li>;
  return (
    <ChallengeRowSwipe eventId={eventId} missionId={m.mission_id} name={displayChallengePrompt(m.prompt)} dim={!m.is_active}>
      {row}
    </ChallengeRowSwipe>
  );
}
