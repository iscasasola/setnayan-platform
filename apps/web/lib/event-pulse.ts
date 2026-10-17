/**
 * event-pulse.ts — THE PHONE'S HALF OF "HAS ANYTHING CHANGED?" (2026-10-18, live-day polling).
 *
 * Client-safe and pure: the numbers and the one decision, so a test can pin them. The server half is
 * `lib/event-pulse.server.ts`; the hook that asks is `lib/use-event-pulse.ts`.
 */

/** How often a visible phone asks, on the day (± 20 %, `jittered`). Owner's bar: a change reaches guests in ~15 s. */
export const PULSE_POLL_MS = 15_000;

/** A per-guest change (an arrival, a photo tag) is listed in the answer for this long. */
export const PULSE_GUEST_WINDOW_MS = 10 * 60_000;

/** A phone away (hidden) for longer than this may have missed a per-guest change: it re-renders once on return. */
export const PULSE_AWAY_MS = PULSE_GUEST_WINDOW_MS - 60_000;

/** After a "yes, it changed", each phone re-renders somewhere inside this window — never all at the same instant. */
export const PULSE_REFRESH_SPREAD_MS = 3_000;

/** Misses in a row (no answer, a 5xx) before the phone falls back to one full refresh — a broken pulse never freezes a page. */
export const PULSE_MISSES_BEFORE_REFRESH = 3;

/** A per-guest change this close BEFORE the render began may not be in it (a write in flight). Counted as after. */
const RENDER_SLACK_MS = 5_000;

export type PulseAnswer = {
  /** One stamp over everything about the event those pages draw. */
  v: string;
  /** Per guest key (a one-way hash), the latest moment something of theirs changed — recent ones only. */
  g: Record<string, string>;
};

export type PulseBaseline = {
  /** The stamp the page on screen was drawn under. */
  v: string;
  /** This viewer's key in `g`, or null for a viewer who is not a guest of the event. */
  guestKey: string | null;
  /** When the server began drawing the page on screen (ISO). */
  renderedAt: string;
};

/**
 * Should the page on screen be drawn again? Yes when the event's stamp is not the one the page was drawn under, or
 * when this guest's own entry moved after the page was drawn — unless that exact answer was already acted on (a
 * refresh in flight, or a render that came back drawn from a remembered answer a few seconds older).
 */
export function pulseSaysRefresh(
  baseline: PulseBaseline,
  answer: PulseAnswer,
  actedOn: ReadonlySet<string>,
): { refresh: boolean; because: string | null } {
  if (answer.v !== baseline.v && !actedOn.has(`v:${answer.v}`)) return { refresh: true, because: `v:${answer.v}` };
  const mine = baseline.guestKey ? answer.g?.[baseline.guestKey] : undefined;
  if (mine && !actedOn.has(`g:${mine}`)) {
    const at = Date.parse(mine);
    const drawn = Date.parse(baseline.renderedAt);
    if (Number.isFinite(at) && Number.isFinite(drawn) && at > drawn - RENDER_SLACK_MS) return { refresh: true, because: `g:${mine}` };
  }
  return { refresh: false, because: null };
}
