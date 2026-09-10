/**
 * The words the program output says when it has no picture to show.
 *
 * ONE SOURCE, TWO SURFACES. `app/panood/program/[eventId]/program-surface.tsx` (the DOM
 * pop-out OBS window-captures) and `lib/encoder/` (the OffscreenCanvas the native encoder
 * reads, S1) must draw the SAME words for the same state — a couple who rehearsed against the
 * pop-out and then streams from the desktop app should never see different copy on air. So
 * the copy lives here and both import it; neither may carry its own literal.
 *
 * Plain constants, no React, no DOM — this module is imported by a Web Worker.
 */

/**
 * The no-signal card draws `frame.label` verbatim (the host's own name for what is on
 * Channel 1, or `EMPTY_FRAME.label` — "Nothing on program yet" — before the console has
 * published anything). There is no separate string: the label IS the card.
 */

/**
 * ⭐ WAVE 5 — a source arrived that this event is not entitled to broadcast. The
 * TAMPER / STALE-ENTITLEMENT state; written to be read by the person who caused it.
 * See `WithheldCard` in program-surface.tsx for the full reasoning.
 */
export const WITHHELD_CARD = {
  kicker: 'Live Studio',
  title: 'Unlock to broadcast all your cameras',
  body: 'Your free broadcast carries one camera — the channel marked ★ default in the controller. Switching between cameras on air is what the Live Studio unlock buys.',
  hint: 'Just changed your default channel? Close this window and open it again from the controller.',
} as const;

/**
 * ⭐ WAVE 5 — the free tier's pinned channel, named on the picture while the host's cut
 * differs from it. See `PinnedChannelNotice` in program-surface.tsx.
 */
export function pinnedChannelNotice(label: string): string {
  return `On air: ${label} · switching cameras needs the Live Studio unlock`;
}
