/**
 * apps/web/lib/papic-seat-capture-refusal-copy.ts
 *
 * B1(a) — a capture-window refusal is not a failed upload.
 *
 * 🛑 THE LIE THIS FILE EXISTS TO KILL. `papic-seat-capture.tsx` used to route
 * EVERY terminal server refusal it recognised through ONE sentence:
 *
 *     "A shot didn't upload — tap it in the roll to retry."
 *
 * `capture_not_started` and `capture_window_closed` are both in
 * `PAPIC_TERMINAL_ERRORS` (papic-drain.ts) precisely because retrying them can
 * NEVER succeed — but the manual-retry copy tells the photographer to do
 * exactly that. The shot did not fail to upload; the camera is not open yet
 * (or is done for the event). Tapping the thumbnail changes nothing.
 *
 * This is the one place the refusal-reason → user-visible message mapping
 * lives, so a reword of the sentence can never quietly reintroduce a retry
 * instruction on a window that isn't open — see the test file for the
 * property it asserts.
 *
 * PURE + unit-testable. No DB, no I/O, no React.
 */

import { formatManilaDate } from './papic-window';

export type PapicSeatCaptureKind = 'photo' | 'clip';

/** The two window-refusal codes this module has a dedicated message for. */
export type PapicWindowRefusalCode = 'capture_not_started' | 'capture_window_closed';

export function isPapicWindowRefusalCode(
  code: string | null | undefined,
): code is PapicWindowRefusalCode {
  return code === 'capture_not_started' || code === 'capture_window_closed';
}

/**
 * The message for a capture refused because the camera's window hasn't
 * opened yet, or has already closed — as opposed to a genuine upload failure
 * (network / infra), which keeps ITS OWN "tap to retry" copy untouched.
 *
 * `windowStartsAt` is the seat's own `valid_from` (a 'YYYY-MM-DD' Manila
 * calendar date), echoed back by the presign refusal itself (app/api/upload/
 * route.ts) — never re-derived here, so this sentence can't name a date the
 * gate didn't actually use.
 */
export function papicSeatCaptureWindowRefusalMessage(
  code: PapicWindowRefusalCode,
  kind: PapicSeatCaptureKind,
  windowStartsAt: string | null | undefined,
): string {
  const noun = kind === 'clip' ? 'clip' : 'shot';
  if (code === 'capture_window_closed') {
    return `That ${noun} didn't go in — this camera's window has closed. Nothing here to retry.`;
  }
  const date = formatManilaDate(windowStartsAt);
  return date
    ? `That ${noun} didn't go in — the camera opens on ${date}. Nothing here to retry until then.`
    : `That ${noun} didn't go in — the camera hasn't opened yet. Nothing here to retry until then.`;
}
