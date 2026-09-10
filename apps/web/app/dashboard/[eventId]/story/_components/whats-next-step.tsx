'use client';

/**
 * WHAT'S NEXT — the Story Maker's fifth step, and the optional one. PORTED from
 * `prototypes/story-maker.html` (`#p-next`), not redrawn: the resting card and
 * its words, the derived cards with their badges, the "Or another kind:" row,
 * the inherit list, the back-cover preview and the two actions are the
 * prototype's. `02_The_Story_Maker.md` §7 · `08` step 1.7.
 *
 * ⚖ THE OWNER'S RULING SHAPES EVERY DEFAULT HERE: **a story is finished on its
 * own. Most end here, and that is a whole story.** So:
 *   · nothing is pre-selected, and "Nothing yet" is the lit card on arrival;
 *   · the back-cover preview is quiet and dashed until the host chooses;
 *   · choosing nothing leaves the back cover ABSENT — not empty, not a
 *     placeholder, not "coming soon".
 *
 * 🔑 AND THE TWO ACTIONS ARE DELIBERATELY NOT ONE. "Announce it only" writes a
 * sentence; "Start it now" creates an event. `event-anchor.ts`'s owner lock is
 * that an event exists only on the go-signal tap, so a single "continue" button
 * that did both would make every announcement a creation.
 *
 * ⛔ THIS IS THE HOST'S DESK, NOT THE READER'S PAGE. The published story never
 * shows a menu of event kinds — it shows at most the one door the host chose.
 */

import { useMemo, useState, useTransition } from 'react';
import { announceNext, startTheNextCelebration } from '../whats-next-actions';
import {
  NOTHING_YET,
  TIMING_BADGE,
  TIMING_WHY,
  backCoverOf,
  type NextCandidate,
} from '@/lib/whats-next';

/**
 * The three the prototype puts on cards, in its order. Not a rule about which
 * kinds exist — the roster decides that — only about which three get the room.
 * A kind the admin roster has retired simply is not here, and the first
 * candidate of each remaining timing takes the empty seat.
 */
const FEATURED_KINDS = ['anniversary', 'christening', 'reunion'] as const;

export function WhatsNextStep({
  eventId,
  candidates,
  initialKind,
}: {
  eventId: string;
  /**
   * Derived on the SERVER, dates already formatted. A formatter cannot cross
   * this boundary — passing one down as a prop throws at render.
   */
  candidates: readonly NextCandidate[];
  /** What was already announced, or null for the resting state. */
  initialKind: string | null;
}) {
  const [picked, setPicked] = useState<string>(initialKind ?? NOTHING_YET);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const resting = candidates.find((c) => c.kind === NOTHING_YET) ?? null;
  const offered = useMemo(
    () => candidates.filter((c) => c.kind !== NOTHING_YET),
    [candidates],
  );

  const featured = useMemo(() => {
    const chosen: NextCandidate[] = [];
    for (const key of FEATURED_KINDS) {
      const match = offered.find((c) => c.kind === key);
      if (match) chosen.push(match);
    }
    // A retired kind leaves a seat. Fill it with the first candidate of a timing
    // that is not already represented, so the three cards always show three
    // DIFFERENT kinds of answer rather than three variations of one.
    for (const candidate of offered) {
      if (chosen.length >= FEATURED_KINDS.length) break;
      if (chosen.some((c) => c.kind === candidate.kind)) continue;
      if (chosen.some((c) => c.timing === candidate.timing)) continue;
      chosen.push(candidate);
    }
    return chosen;
  }, [offered]);

  const others = useMemo(
    () => offered.filter((c) => !featured.some((f) => f.kind === c.kind)),
    [offered, featured],
  );

  const current = offered.find((c) => c.kind === picked) ?? null;
  const nothingChosen = !current;
  const backCover = backCoverOf(current ? { kind: current.kind } : null, candidates);

  const choose = (kind: string) => {
    if (kind === picked) return;
    const previous = picked;
    setPicked(kind);
    setError(null);
    startTransition(async () => {
      const result = await announceNext(eventId, kind);
      if (!result.ok) {
        setPicked(previous);
        setError(result.error);
      }
    });
  };

  const startItNow = () => {
    if (!current) return;
    setError(null);
    startTransition(async () => {
      // On success this REDIRECTS to the new celebration and never returns.
      const result = await startTheNextCelebration(eventId, current.kind);
      if (result && !result.ok) setError(result.error);
    });
  };

  const card = 'rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6';
  const eyebrow =
    'block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45';
  const tile = (on: boolean) =>
    `rounded-xl border p-4 text-left transition ${
      on ? 'border-burgundy/40 bg-burgundy/5' : 'border-ink/10 bg-white hover:border-ink/25'
    }`;

  return (
    <section className={card} aria-labelledby="whats-next-heading">
      <h2 id="whats-next-heading" className="font-display text-lg italic text-ink">
        What&rsquo;s next{' '}
        <span className="align-middle font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/40">
          Optional
        </span>
      </h2>
      <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-ink/60">
        <strong className="font-semibold text-ink/80">
          A story is finished on its own.
        </strong>{' '}
        Most end here, and that is a whole story &mdash; the close is your words,
        and nothing after it is required. If you <em>do</em> want another day to
        follow this one, this is where you say so. Nothing is announced and
        nothing is created unless you choose it.
      </p>

      {/* ── The candidates ─────────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {resting ? (
          <button
            type="button"
            onClick={() => choose(NOTHING_YET)}
            aria-pressed={nothingChosen}
            disabled={pending}
            className={tile(nothingChosen)}
          >
            <span className={eyebrow}>Where you are now</span>
            <span className="mt-1 block text-sm font-semibold text-ink">Nothing yet</span>
            <span className="mt-0.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/50">
              The story ends on your words
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed text-ink/55">
              The back cover stays quiet. No next edition, nothing promised,
              nobody told anything. You can name one years later and this page
              simply gains a door &mdash; or never, which is also a finished
              chronicle.
            </span>
          </button>
        ) : null}

        {featured.map((candidate) => {
          const on = picked === candidate.kind;
          return (
            <button
              key={candidate.kind}
              type="button"
              onClick={() => choose(candidate.kind)}
              aria-pressed={on}
              disabled={pending}
              className={tile(on)}
            >
              <span className={eyebrow}>
                {candidate.timing === 'derived'
                  ? 'If you want one — derived from this day'
                  : candidate.timing === 'waiting'
                    ? 'Needs a date we don’t have'
                    : 'A day you choose'}
              </span>
              <span className="mt-1 block text-sm font-semibold text-ink">
                {candidate.label}
              </span>
              <span className="mt-0.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/50">
                {candidate.dateLabel
                  ? `${candidate.dateLabel}${
                      candidate.inDays === null ? '' : ` · in ${candidate.inDays} days`
                    }`
                  : candidate.timing === 'waiting'
                    ? 'When there is someone to celebrate'
                    : 'Pick a day'}
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-ink/55">
                {TIMING_WHY[candidate.timing]}
              </span>
              <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                {TIMING_BADGE[candidate.timing]}
              </span>
            </button>
          );
        })}
      </div>

      {others.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={eyebrow}>Or another kind:</span>
          {others.map((candidate) => (
            <button
              key={candidate.kind}
              type="button"
              onClick={() => choose(candidate.kind)}
              aria-pressed={picked === candidate.kind}
              disabled={pending}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                picked === candidate.kind
                  ? 'border-burgundy/40 bg-burgundy/5 text-ink'
                  : 'border-ink/15 bg-white text-ink/70 hover:border-ink/30'
              }`}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      ) : null}

      {current ? (
        <p className="mt-3 text-xs leading-relaxed text-ink/55">
          {TIMING_WHY[current.timing]}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-mulberry">
          {error}
        </p>
      ) : null}

      {/* ── What No. 2 inherits ────────────────────────────────────────────── */}
      {current ? (
        <div className="mt-4 rounded-xl border border-ink/10 bg-white/70 p-4">
          <span className={eyebrow}>What No. 2 inherits from this story</span>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink/65">
            <li>
              <strong className="font-semibold text-ink/80">
                Your names and your monogram
              </strong>{' '}
              &mdash; the masthead carries over
            </li>
            <li>
              <strong className="font-semibold text-ink/80">Your colours</strong>{' '}
              &mdash; the same theme, unless you change it there
            </li>
            <li>
              <strong className="font-semibold text-ink/80">
                &ldquo;Previously &middot; No. 1&rdquo;
              </strong>{' '}
              &mdash; and this story gains its back-cover door
            </li>
          </ul>
          {/*
            ⚠ THE GUEST LIST IS NOT ON THIS LIST, AND ITS ABSENCE IS THE POINT.
            `02` §7 lists it; the owner's 2026-07-12 recurrence lock scopes a
            carry-forward to "Details, not the guest list", and the shipped
            clone keeps to that. Two documents disagree and one of them is an
            owner lock, so the lock stands and the screen does not promise a
            list it will not bring. Raised for the owner, not decided here.
          */}
        </div>
      ) : null}

      {/* ── The back cover, as it will read ────────────────────────────────── */}
      <div className="mt-4">
        <span className={eyebrow}>How the back cover of this story will read</span>
        <div
          className={`mt-2 rounded-xl border p-4 ${
            backCover ? 'border-ink/15 bg-white' : 'border-dashed border-ink/20 bg-white/50'
          }`}
        >
          {backCover ? (
            <>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/45">
                Vol. I &middot; No. 2 &middot; not yet written
              </span>
              <span className="mt-1 block font-display text-xl italic text-ink">
                {backCover.title}
              </span>
              <span className="mt-0.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/55">
                {backCover.when}
                {backCover.sub ? ` · ${backCover.sub}` : ''}
              </span>
              <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                &larr; Previously &middot; No. 1
              </span>
            </>
          ) : (
            <>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink/40">
                No next edition announced
              </span>
              <span className="mt-1 block font-display text-xl italic text-ink/45">
                The chronicle stays open
              </span>
              <span className="mt-0.5 block text-xs text-ink/45">
                Name one whenever you like.
              </span>
            </>
          )}
        </div>

        {current ? (
          <div className="mt-3 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={startItNow}
              disabled={pending}
              className="sn-press rounded-full bg-burgundy px-4 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-60"
            >
              Start it now
            </button>
            <span className="inline-flex items-center rounded-full border border-ink/15 px-4 py-2 text-sm font-bold text-ink/70">
              {/* "Announce it only" IS THE PRESS THAT ALREADY HAPPENED. Choosing
                  a card above announced it and created nothing; a second button
                  repeating that write would let a host press it expecting
                  something MORE to happen. So it states the state instead. */}
              Announced &mdash; nothing created
            </span>
          </div>
        ) : null}

        <p className="mt-3 text-xs leading-relaxed text-ink/55">
          {current ? (
            <>
              It is on the back cover and{' '}
              <strong className="font-semibold text-ink/75">nothing has been created</strong>.{' '}
              <strong className="font-semibold text-ink/75">Start it now</strong> opens a new
              celebration with the names and the colours already filled &mdash; and links it
              to this story.
            </>
          ) : (
            'Leaving it here is a complete answer — publish whenever you like.'
          )}
        </p>
      </div>
    </section>
  );
}
