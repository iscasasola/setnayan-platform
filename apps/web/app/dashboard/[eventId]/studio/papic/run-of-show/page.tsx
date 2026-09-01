/**
 * THE RUN OF SHOW — the ceremony sequence, with a challenge at each moment.
 *
 * Build order § 5: "`lib/kwento-moments.ts` already carries the sequence in
 * order … The challenge library exists. **Nothing joins them.** Joining them
 * means a coordinator sets up in two minutes instead of writing prompts from
 * scratch."
 *
 * 🔑 THE TWO MINUTES ARE THE PRODUCT. Everything on this page is answerable to
 * it: the moments are already in order, each one arrives with the prompts that
 * suit it, and placing one is a single tap on a plain form. A coordinator who
 * has to think about which of 631 prompts belongs at the veil and cord has been
 * sold nothing.
 *
 * ── 🔴 THE SEQUENCE IS THE CLOCK, AND THIS PAGE OWNS NO PART OF IT ──────────
 * "This is happening now" posts `armChallengeAction`, which calls 4a's
 * `papic_arm_challenge()` — close-then-open, in one transaction. Which
 * challenge the room is being asked comes back from `papic_armed_challenge()`,
 * which delegates to `papic_challenge_is_open()`. There is no duration here, no
 * countdown, no comparison against `armed_at`: openness has exactly one answer
 * and this screen is a caller, never a second one.
 *
 * ── WHY IT IS ITS OWN ROUTE, BESIDE THE PICKER RATHER THAN INSIDE IT ────────
 * The picker (`/challenges`) is a CHOOSING task over 631 rows: search, filter,
 * compare. This is a SEQUENCING task over ten fixed moments, done once at setup
 * and then driven live during the reception, quite possibly by somebody who is
 * not the couple. They share the board, the ceiling and the server action; they
 * are not the same screen and folding one into the other would make both worse.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Radio, Play, X } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { resolveProfileByEvent } from '@/lib/event-type-profile';
import { displayChallengePrompt } from '@/lib/papic-missions';
import { KWENTO_MOMENTS } from '@/lib/kwento-moments';
import { fetchArmedChallenge } from '@/lib/papic-challenge-clock';
import {
  fetchRunOfShow,
  fetchSequenceSuggestions,
  type MomentSuggestions,
} from '@/lib/papic-ceremony-sequence';
import { addLibraryChallengeAction, armChallengeAction, clearMomentChallengeAction } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Run of Show',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ add?: string }>;
};

export default async function RunOfShowPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;

  // The flag gates the whole Papic games feature. A route that renders an empty
  // shell when it is off is a door onto nothing; 404 is the honest answer.
  if (!papicGamesEnabled()) notFound();

  // ⚠ THE ROUTE IS NOT THE GATE — THE DATABASE IS. Every read below runs on the
  // coordinator's own RLS-scoped client (`papic_missions_member_all`, Pattern
  // B), so a stranger with the URL sees nothing regardless. This check exists
  // to send them somewhere useful rather than to an empty page.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/${eventId}/studio/papic/run-of-show`);

  // What kind of celebration this is, from the shipped resolver — React-cache()d
  // per request, so this costs nothing the page was not already paying. It is
  // what keeps a birthday from being offered a garter toss, and it is what makes
  // the degrade path live rather than hypothetical: at a non-wedding, most of
  // the sequence's mapped prompts are out of scope and those moments fall back.
  const profile = await resolveProfileByEvent(eventId);
  const words = { organizer: profile.terminology.organizerNoun };

  const [runOfShow, armedReading] = await Promise.all([
    fetchRunOfShow(supabase, eventId),
    fetchArmedChallenge(supabase, eventId),
  ]);

  // Placed prompts are not offered again — a prompt can sit at only one moment
  // and the database refuses the second, so offering it would be a button that
  // fails. Built from the run of show itself, so the two cannot disagree.
  const taken = new Set(
    [...runOfShow.placed.values()]
      .map((p) => p.libraryId)
      .filter((id): id is number => id !== null),
  );
  const suggestions = await fetchSequenceSuggestions(supabase, profile.eventType, taken);

  return (
    <div className="sn-col py-6">
      <Link
        href={`/dashboard/${eventId}/studio/papic`}
        className="inline-flex items-center gap-1.5 text-sm text-link underline-offset-2 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Papic
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-ink">Run of show</h1>
      <p className="mt-1 text-sm text-ink/70">
        The day in order. Put a challenge at each moment now, then start it when
        the moment arrives &mdash; each one runs until you start the next.
      </p>

      {/* 🔑 A GUARD THAT REFUSES IN SILENCE IS INDISTINGUISHABLE FROM ONE THAT
          PASSED. The server action refuses an over-the-ceiling add and an
          uncountable board, and writes the outcome into the URL; this is where
          somebody reads it. There are TEN moments and the board holds ten, so a
          celebration with a paid supplier mission genuinely cannot fit a full
          sequence — that has to be said, not silently truncated. */}
      {search.add === 'full' ? (
        <p className="mt-4 rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink/75">
          That one didn&rsquo;t go on &mdash; your board is already full. Take a
          challenge off a moment below, or remove one from your challenge list,
          and it will fit.
        </p>
      ) : null}
      {search.add === 'unavailable' ? (
        <p className="mt-4 rounded-lg bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
          We couldn&rsquo;t check your board just now, so nothing was added. Try
          again in a moment &mdash; nothing has changed.
        </p>
      ) : null}

      {/* ⏱ WHAT THE ROOM IS BEING ASKED, STATED ONCE. Three sentences for three
          states, because an un-armed celebration and a read we could not make
          are NOT the same thing — collapsing them tells a coordinator
          mid-reception that nothing is running when something is. */}
      {!armedReading.measured ? (
        <p className="mt-4 rounded-lg bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
          We couldn&rsquo;t check which challenge is being asked just now. Refresh
          in a moment &mdash; nothing has stopped, and your guests can still take
          photos either way.
        </p>
      ) : armedReading.armed ? (
        <p className="mt-4 flex items-start gap-1.5 text-sm text-ink/70">
          <Radio aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-mulberry" strokeWidth={2} />
          <span>
            Being asked now:{' '}
            <span className="font-medium text-ink">
              {displayChallengePrompt(armedReading.armed.prompt, { organizer: words.organizer })}
            </span>
          </span>
        </p>
      ) : (
        <p className="mt-4 text-sm text-ink/45">
          No challenge is being asked yet. Start one when the moment comes.
        </p>
      )}

      {!runOfShow.measured ? (
        <p className="mt-4 rounded-lg bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
          We couldn&rsquo;t read your run of show just now, so the moments below
          are shown empty. That is what we could not see, not what you have set
          up &mdash; refresh before changing anything.
        </p>
      ) : null}

      <ol className="mt-5 space-y-3">
        {KWENTO_MOMENTS.map((moment, i) => {
          const placed = runOfShow.placed.get(moment.key);
          const shelf = suggestions.byMoment.get(moment.key);
          const isArmed =
            armedReading.measured &&
            armedReading.armed !== null &&
            placed !== undefined &&
            armedReading.armed.missionId === placed.missionId;

          return (
            <li
              key={moment.key}
              className="rounded-xl border border-ink/10 bg-white/60 p-3 sm:p-4"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-xs tabular-nums text-ink/40">{i + 1}</span>
                <div>
                  <p className="text-[0.7rem] uppercase tracking-wide text-ink/45">
                    {moment.eyebrow}
                  </p>
                  <h2 className="text-sm font-semibold text-ink">{moment.label}</h2>
                </div>
              </div>

              {placed ? (
                <div className="mt-2">
                  <p className="text-sm text-ink/90">
                    {displayChallengePrompt(placed.prompt, { organizer: words.organizer })}
                  </p>
                  {/* A placed challenge the couple has hidden reaches nobody.
                      `papic_challenge_is_open` already treats it as closed, so
                      arming it would produce a live moment with no audience —
                      say so here rather than letting the button lie. */}
                  {!placed.isActive ? (
                    <p className="mt-1 text-xs text-terracotta-700">
                      Hidden from guests &mdash; show it again on your challenge
                      list before this moment.
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isArmed ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-mulberry/10 px-2.5 py-1 text-xs font-medium text-mulberry">
                        <Radio aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        Being asked now
                      </span>
                    ) : (
                      <form action={armChallengeAction}>
                        <input type="hidden" name="event_id" value={eventId} />
                        <input type="hidden" name="mission_id" value={placed.missionId} />
                        <input type="hidden" name="return_to" value="run-of-show" />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-medium text-white"
                        >
                          <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          This is happening now
                        </button>
                      </form>
                    )}

                    <form action={clearMomentChallengeAction}>
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="mission_id" value={placed.missionId} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-xs text-ink/55 underline-offset-2 hover:underline"
                      >
                        <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        Take off this moment
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <MomentShelf
                  shelf={shelf}
                  readable={suggestions.readable}
                  eventId={eventId}
                  momentKey={moment.key}
                  organizer={words.organizer}
                />
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-xs text-ink/50">
        Every moment&rsquo;s challenge sits on the same board your guests see.{' '}
        <Link
          href={`/dashboard/${eventId}/studio/papic/challenges`}
          className="text-link underline-offset-2 hover:underline"
        >
          Your whole challenge list
        </Link>{' '}
        is where you hide, remove or add more.
      </p>
    </div>
  );
}

/**
 * WHAT TO OFFER AT AN EMPTY MOMENT.
 *
 * 🔑 IT SAYS WHICH SHELF THIS IS. `basis: 'general'` means nothing authored for
 * this moment fits this celebration and the coordinator is looking at the
 * general pool. Presenting that as "our suggestions for the first kiss" is a
 * claim that is not true, and it is exactly the claim an empty mapping invites
 * — the same rule that makes the picker say whether its order is real
 * popularity. The shelf is never empty either way; that is the ruled behaviour.
 */
function MomentShelf({
  shelf,
  readable,
  eventId,
  momentKey,
  organizer,
}: {
  shelf: MomentSuggestions | undefined;
  readable: boolean;
  eventId: string;
  momentKey: string;
  organizer: string;
}) {
  // ⚠ SUPPRESS, NEVER RENDER AN EMPTY SHELF. "We could not look" and "this
  // moment has nothing" are the same shape in a naive reader, and telling a
  // coordinator mid-setup that a moment has no prompts, when the library is
  // full, is the failure this build order is named after.
  if (!readable || !shelf) {
    return (
      <p className="mt-2 text-xs text-terracotta-700">
        We couldn&rsquo;t load suggestions for this moment. Refresh in a moment
        &mdash; nothing is wrong with your setup.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-ink/50">
        {shelf.basis === 'sequence'
          ? 'Made for this moment:'
          : 'We haven’t written prompts for this moment at a celebration like yours — here are strong ones from the whole library:'}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {shelf.candidates.map((c) => (
          <li key={c.library_id} className="flex items-start justify-between gap-2">
            <span className="text-sm text-ink/85">
              {displayChallengePrompt(c.prompt, { organizer })}
            </span>
            <form action={addLibraryChallengeAction} className="shrink-0">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="library_id" value={c.library_id} />
              <input type="hidden" name="moment_key" value={momentKey} />
              <input type="hidden" name="return_to" value="run-of-show" />
              <button
                type="submit"
                className="rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/5"
              >
                Use this
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
