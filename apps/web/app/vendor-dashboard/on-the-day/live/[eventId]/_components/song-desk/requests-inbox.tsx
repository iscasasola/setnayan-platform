'use client';

/**
 * THE REQUESTS INBOX — the room asks, the act decides.
 *
 * Owner, 2026-07-30: "create the UI." The machinery has shipped in pieces over
 * three days with no screen attached to any of it — two guest submit lanes with
 * rate caps (#3813), always-on requests (#3891), and the entitlement-checked
 * read/decide path (`fetchActSongRequests` / `decideActSongRequest`, #3891). This
 * is the screen.
 *
 * ── THE ONE OPINION THAT MATTERS ON A VENUE FLOOR ──────────────────────────
 *
 * PENDING FIRST, everything else collapsed. A musician looking at a phone
 * between songs has exactly one question — "what do I have to answer?" — and
 * every decided row is noise against it. The server already sorts pending-first;
 * this component keeps decided rows behind a summary line rather than a list.
 *
 * ── ACCEPT MEANS "WE'LL PLAY IT", AND NOTHING ELSE ─────────────────────────
 *
 * Owner-locked twice: "accept IS the setlist" (2026-07-27) and accepting does
 * NOT file the song into a set (2026-07-30). So there is no set-picker here, no
 * "which set?" step, no drag target. A request lands mid-song; asking a musician
 * to sort it in that moment is a decision they do not need. Two buttons.
 *
 * ── OPTIMISTIC, BECAUSE THE ALTERNATIVE IS A SPINNER MID-SET ───────────────
 *
 * A decision applies to local state immediately and reverts if the action fails.
 * A band on stage cannot wait on a round-trip to know whether their tap
 * registered, and `revalidatePath` in the action refreshes the server copy on
 * the next paint anyway.
 */

import { useOptimistic, useState, useTransition } from 'react';
import { Check, Loader2, Pause, Play, X } from 'lucide-react';

import type { ActSongRequest } from '../../../../actions';
import { decideActSongRequest, setSongRequestsOpen } from '../../../../actions';

type Decision = 'accepted' | 'declined';

export function RequestsInbox({
  eventId,
  requests,
  paused,
}: {
  eventId: string;
  requests: ActSongRequest[];
  /** Whether this act has paused the room. Absent row = flowing, never paused. */
  paused: boolean;
}) {
  // Optimistic decisions, keyed by requestId. The reducer merges rather than
  // replaces so two fast taps on different rows don't clobber each other.
  const [decided, applyDecision] = useOptimistic(
    {} as Record<string, Decision>,
    (state, next: { id: string; decision: Decision }) => ({ ...state, [next.id]: next.decision }),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const effective = requests.map((r) => ({ ...r, status: decided[r.requestId] ?? r.status }));
  const pending = effective.filter((r) => r.status === 'pending');
  const accepted = effective.filter((r) => r.status === 'accepted');
  const declinedCount = effective.filter((r) => r.status === 'declined').length;

  function decide(id: string, decision: Decision) {
    setError(null);
    startTransition(async () => {
      applyDecision({ id, decision });
      const res = await decideActSongRequest(eventId, id, decision);
      // No manual revert: a failed action leaves the optimistic value to be
      // discarded when the transition ends, and the server copy is the truth.
      if (!res.ok) setError(res.error ?? 'That didn’t save. Try again.');
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 className="text-sm font-medium text-ink">
          {pending.length > 0
            ? `${pending.length} ${pending.length === 1 ? 'request' : 'requests'} waiting`
            : 'Requests from the room'}
        </h4>
        <PauseToggle eventId={eventId} paused={paused} />
      </div>

      <p className="text-xs leading-relaxed text-ink/60">
        {paused
          ? 'Paused — the room can’t ask right now. Anything already asked is still below.'
          : 'Guests can ask any time tonight. Accept the ones you’ll play.'}
      </p>

      {error ? (
        <p role="alert" className="text-xs leading-relaxed text-terracotta-700">
          {error}
        </p>
      ) : null}

      {pending.length === 0 && accepted.length === 0 && declinedCount === 0 ? (
        <p className="text-sm leading-relaxed text-ink/70">
          Nothing asked yet. It’ll appear here the moment someone does.
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="space-y-1">
          {pending.map((r) => (
            <li key={r.requestId} className="flex min-w-0 items-baseline gap-2 py-1">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                <span className="block truncate text-xs text-ink/55">
                  {[r.artist, asker(r)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => decide(r.requestId, 'accepted')}
                  className="inline-flex items-center gap-1 rounded-full border border-success-400/50 px-2.5 py-1 text-xs font-medium text-success-700 hover:bg-success-500/10"
                >
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  We’ll play it
                </button>
                <button
                  type="button"
                  onClick={() => decide(r.requestId, 'declined')}
                  aria-label={`Decline ${r.title}`}
                  className="inline-flex items-center rounded-full border border-ink/15 p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink/80"
                >
                  <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {accepted.length > 0 ? (
        <div className="space-y-0.5 pt-1">
          <h5 className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink/50">
            You said yes to {accepted.length}
          </h5>
          <ul>
            {accepted.map((r) => (
              <li key={r.requestId} className="flex min-w-0 items-baseline gap-2 py-0.5">
                <span className="min-w-0 truncate text-sm text-ink/85">{r.title}</span>
                {r.artist ? (
                  <span className="min-w-0 shrink truncate text-xs text-ink/55">{r.artist}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {declinedCount > 0 ? (
        <p className="text-xs text-ink/45">
          {declinedCount} {declinedCount === 1 ? 'request' : 'requests'} declined.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Who asked. A wedding guest gave their name at RSVP; a bar walk-in may have
 * typed one or nothing. "Someone in the room" is the honest fallback — better
 * than an empty gap, and it tells the band the ask was real.
 */
function asker(r: ActSongRequest): string {
  if (r.requesterName) return `from ${r.requesterName}`;
  return r.origin === 'open' ? 'from the room' : 'from a guest';
}

/**
 * The pause. Requests are always on (nothing to switch ON), so this is the one
 * control the act has over the stream — for a flood during dinner, or a set they
 * want undisturbed.
 *
 * ⚠ A PAUSE PAUSES THE ROOM, not just this act's view: the request pool is
 * per-EVENT while the pause is per-(vendor × event), so with two acts booked a
 * paused quartet also silences the band. Chosen deliberately (over-pausing beats
 * flooding a band that asked for silence) — see migration 20271020224218.
 *
 * ⚠ OWNER PATH ONLY. `setSongRequestsOpen` resolves the caller's OWN vendor
 * profile, so a day-of grantee gets "No vendor profile." rather than a silent
 * no-op. That is PR #3876's deliberate scope boundary, and surfacing its error
 * inline is more honest than hiding a control we cannot prove they may use.
 */
function PauseToggle({ eventId, paused }: { eventId: string; paused: boolean }) {
  const [isPaused, setIsPaused] = useState(paused);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    const next = !isPaused;
    startTransition(async () => {
      setIsPaused(next);
      // `open` is the column's sense — the inverse of paused.
      const res = await setSongRequestsOpen(eventId, !next);
      if (!res.ok) {
        setIsPaused(!next);
        setError(res.error ?? 'Couldn’t change that.');
      }
    });
  }

  return (
    <span className="flex items-center gap-2">
      {error ? <span className="text-xs text-terracotta-700">{error}</span> : null}
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={isPaused}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-ink/5 hover:text-ink disabled:opacity-60"
      >
        {pending ? (
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : isPaused ? (
          <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Pause aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {isPaused ? 'Resume requests' : 'Pause requests'}
      </button>
    </span>
  );
}
