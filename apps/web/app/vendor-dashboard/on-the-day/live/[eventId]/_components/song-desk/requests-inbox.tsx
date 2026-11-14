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
import { Check, Pause, Play, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

import type { ActSongRequest } from '../../../../actions';
import { decideActSongRequest, setSongRequestsOpen } from '../../../../actions';
import { formatCount } from '@/lib/format-number';

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
        <h4 className="text-base font-semibold text-ink">
          {pending.length > 0
            ? `${pending.length} ${pending.length === 1 ? 'request' : 'requests'} waiting`
            : 'Requests from the room'}
        </h4>
        <PauseToggle eventId={eventId} paused={paused} />
      </div>

      <p className="text-sm leading-relaxed text-[color:var(--m-slate-2)]">
        {paused
          ? 'Paused — the room can’t ask right now. Anything already asked is still below.'
          : 'Guests can ask any time tonight. Accept the ones you’ll play.'}
      </p>

      {error ? (
        <p role="alert" className="text-sm leading-relaxed text-danger-700">
          {error}
        </p>
      ) : null}

      {pending.length === 0 && accepted.length === 0 && declinedCount === 0 ? (
        <p className="text-sm leading-relaxed text-[color:var(--m-slate-2)]">
          Nothing asked yet. It’ll appear here the moment someone does.
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul className="divide-y divide-[color:var(--m-line)]">
          {pending.map((r) => (
            <li key={r.requestId} className="flex min-h-14 min-w-0 items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{r.title}</span>
                <span className="block truncate text-sm text-[color:var(--m-slate-2)]">
                  {[r.artist, asker(r)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <ActionButton
                  tone="ok"
                  icon={Check}
                  label="We’ll play it"
                  name={`We’ll play it — ${r.title}`}
                  onClick={() => decide(r.requestId, 'accepted')}
                />
                <ActionButton
                  tone="neutral"
                  iconOnly
                  icon={X}
                  label="Decline"
                  name={`Decline ${r.title}`}
                  onClick={() => decide(r.requestId, 'declined')}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {accepted.length > 0 ? (
        <div className="space-y-0.5 pt-1">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">
            You said yes to {accepted.length}
          </h5>
          <ul>
            {accepted.map((r) => (
              <li key={r.requestId} className="flex min-w-0 items-baseline gap-2 py-0.5">
                <span className="min-w-0 truncate text-sm text-ink">{r.title}</span>
                {r.artist ? (
                  <span className="min-w-0 shrink truncate text-sm text-[color:var(--m-slate-2)]">{r.artist}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {declinedCount > 0 ? (
        <p className="text-sm text-[color:var(--m-slate-2)]">
          {formatCount(declinedCount)} {declinedCount === 1 ? 'request' : 'requests'} declined.
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
      {error ? <span className="text-sm text-danger-700">{error}</span> : null}
      <ActionButton
        tone="neutral"
        icon={isPaused ? Play : Pause}
        label={isPaused ? 'Resume requests' : 'Pause requests'}
        waiting={pending}
        aria-pressed={isPaused}
        onClick={toggle}
      />
    </span>
  );
}
