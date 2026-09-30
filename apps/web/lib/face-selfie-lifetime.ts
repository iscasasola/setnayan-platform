/**
 * face-selfie-lifetime.ts — HOW LONG A FACE-TAGGING SELFIE LIVES, AND WHO IS
 * ASKED FOR ONE. Pure, no I/O, no `server-only`: the gate (`lib/face-tagging-gate.ts`),
 * the Papic-close sweep (`lib/face-selfie-erase.ts`) and their tests read the
 * same arithmetic.
 *
 * ⚖ Owner, 2026-09-30 (DECISION_LOG, four rows read together):
 *   · "FACE TAGGING IS OFFERED ONLY WHEN THE EVENT HAS PAPIC ACTIVE" —
 *     *"but only register face tagging when papic service is active."*
 *   · "THE FACE-TAGGING SELFIE IS ERASED WHEN THE GUEST LOGS OUT" —
 *     *"face tagging selfie will erase upon log out"*.
 *   · its amendment — *"until papic services close then"*.
 *   · "FACE DATA: THREE OWNER ANSWERS" (2) — *"papic does end. it is 12 hrs
 *     after the event ends. we have a code something like this on papic."*
 *
 * 🔑 "PAPIC CLOSES" IS NOT A NEW CLOCK. It is the capture close the cameras
 * already stop on — `manilaCaptureCloseIso` (lib/papic-window.ts), twelve hours
 * past the event's last Manila day — or the couple's stored window end when that
 * is LATER (a host who opened guest cameras for a longer window). Taking the
 * later of the two means the selfie never outlives a camera and never dies while
 * a camera can still shoot a photo it could have found.
 */
import { manilaCaptureCloseIso, manilaEndOfDayIso } from '@/lib/papic-window';
import { eventLastDay } from '@/lib/face-data-retention-core';

/**
 * The instant the event's Papic service closes, in epoch ms — or null when the
 * event carries no readable date and no stored window.
 *
 * 🔒 null MEANS "WE CANNOT SAY", and every caller treats it as NOT closed: the
 * erase sweep skips the row (a skipped erase is retried; a wrong one is not
 * reversible), and the 92-day retention sweep stays underneath as the backstop.
 */
export function papicCloseMs(input: {
  eventDate: string | null | undefined;
  eventEndDate: string | null | undefined;
  windowEnd?: string | null | undefined;
}): number | null {
  const lastDay = eventLastDay(input.eventDate, input.eventEndDate);
  const dayClose = lastDay ? Date.parse(manilaCaptureCloseIso(lastDay)) : NaN;
  const stored = input.windowEnd ? Date.parse(String(input.windowEnd)) : NaN;
  const candidates = [dayClose, stored].filter((n) => Number.isFinite(n));
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/** Has the event's Papic service closed? Unknown ⇒ false (see {@link papicCloseMs}). */
export function papicHasClosed(
  input: Parameters<typeof papicCloseMs>[0],
  nowMs: number = Date.now(),
): boolean {
  const close = papicCloseMs(input);
  if (close === null || !Number.isFinite(nowMs)) return false;
  return nowMs > close;
}

/**
 * THE ONE END-OF-EVENT RESCAN'S WINDOW (owner 2026-09-30, "FACE DATA: THREE
 * OWNER ANSWERS" (3) + "2. a"): it may run once the event has ENDED — the end
 * of its last Manila day, the same instant the capture close counts twelve
 * hours from — and must be done before Papic CLOSES, when every selfie it
 * would match against is erased. Outside that window: never. No readable
 * clock: never.
 */
export function faceRescanWindowOpen(
  input: Parameters<typeof papicCloseMs>[0],
  nowMs: number = Date.now(),
): boolean {
  const lastDay = eventLastDay(input.eventDate, input.eventEndDate);
  if (!lastDay || !Number.isFinite(nowMs)) return false;
  const endedMs = Date.parse(manilaEndOfDayIso(lastDay));
  if (!Number.isFinite(endedMs) || nowMs <= endedMs) return false;
  const close = papicCloseMs(input);
  return close !== null && nowMs <= close;
}

/**
 * MAY A GUEST BE ASKED "Want to be tagged in the photos?" — and so, behind a
 * Yes, for a selfie? ALL FOUR must hold, and any unreadable input is a no:
 *
 *   1 · the event's Papic service is ACTIVE (owner 2026-09-30) — no Papic, no
 *       question and no face data at all;
 *   2 · face tagging RUNS on the event (`mode === 'mode_a'`) — AUTOMATIC
 *       wherever Papic is active (owner 2026-09-30, "automatic"), and folding
 *       in the couple's "turn it off for my event" (`resolveFaceMode`).
 *       On a mode_b event no face is matched and NO SELFIE IMAGE IS STORED
 *       (`enrollGuestFace` refuses), so asking there would ask for nothing;
 *   3 · Papic has not CLOSED — after the close the selfie would be erased the
 *       moment it was taken, and no photo arriving later is tagged;
 *   4 · (the caller's own) the data-privacy control, the guest's wish, their
 *       existing selfie — see `dayOfFaceCatchShows`.
 */
export function faceTaggingAskable(input: {
  papicActive: boolean;
  mode: 'mode_a' | 'mode_b';
  papicClosed: boolean;
}): boolean {
  return input.papicActive === true && input.mode === 'mode_a' && input.papicClosed !== true;
}

/** The line the sign-out control says BEFORE it runs (owner 2026-09-30, verbatim wording). */
export const SIGN_OUT_ERASES_SELFIE =
  'Signing out also erases your face-tagging selfie. Photos already tagged stay tagged.';

/** The line on "Photos of you" (the approved design, screen 2). */
export const SELFIE_LIFETIME_LINE =
  "Your selfie is erased when you log out or when the event's Papic closes. Photos already tagged stay tagged.";

/** The Save-it-to-your-account switch's form field (owner 2026-09-30). */
export const REUSE_FACE_FIELD = 'reuse_account_face';
