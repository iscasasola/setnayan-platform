/**
 * lib/papic-shoot-now.ts — 📷 THE ONE CONTROL IN THE HEAD OF HOME'S PAPIC CARD: OFF · ON — EVENT DAY · ON — EVERYONE, NOW.
 *
 * Owner, 2026-10-30: *"actually the switch on event home should be the let everybody shoot now function"* · *"of papic
 * on papic's widget with that toggle switch"* — and, told Home would then lose its Papic off switch: *"If we cannot turn
 * it off, then maybe assign partial turn on?"*. ⇒ ONE dropdown (a set of choices is one `PickMenu`), three positions,
 * over the two columns that already say these facts:
 *
 *   Off                   → `events.papic_on` false — through the SAME path the Papic switch used: the Event Hub draft
 *                           (`hubDraftAction`), live only after Apply. `papic_guest_capture_early` is left as it is.
 *   On — event day        → `papic_on` true (the draft, when it is not already on) + `papic_guest_capture_early` false
 *                           (LIVE, `setPapicGuestCaptureEarly`).
 *   On — everyone, now    → `papic_on` true + `papic_guest_capture_early` true.
 *
 * 🔑 NEVER LOOK APPLIED WHEN IT ISN'T: `papic_on` only reaches guests on Apply, so the line says so while the draft and
 * the live value differ ("Off after you Apply" · "On after you Apply"). An unread value is "Couldn’t check just now".
 *
 * Pure. Held by `app/dashboard/[eventId]/home-papic-head-is-shoot-now.test.ts`.
 */

export type PapicHeadPosition = 'off' | 'eventday' | 'now';

export const PAPIC_HEAD_LABEL = 'Papic';

/** The three positions, in order — the dropdown's options. `short` is the head's compact button. */
export const PAPIC_HEAD_OPTIONS: ReadonlyArray<{ key: PapicHeadPosition; label: string; short: string }> = [
  { key: 'off', label: 'Off', short: 'Off' },
  { key: 'eventday', label: 'On — event day', short: 'Event day' },
  { key: 'now', label: 'On — everyone, now', short: 'Now' },
];

/** What the head knows. `draftOn` = papic_on as the couple is editing it (the draft over live); null = not read. */
export type PapicHeadFacts = { live: boolean | null; draftOn: boolean | null; early: boolean | null };

export function papicHeadPosition(f: PapicHeadFacts): PapicHeadPosition | null {
  if (f.live === null || f.draftOn === null || f.early === null) return null;
  if (!f.draftOn) return 'off';
  return f.early ? 'now' : 'eventday';
}

/**
 * The writes a position makes, against what is stored: `papic_on` (the draft) only when it changes; the early column
 * only for an On position, and only when it changes. Off never touches `papic_guest_capture_early`.
 */
export function papicHeadWrites(
  to: PapicHeadPosition,
  stored: { draftOn: boolean; early: boolean },
): { papic_on?: boolean; papic_guest_capture_early?: boolean } {
  const out: { papic_on?: boolean; papic_guest_capture_early?: boolean } = {};
  const on = to !== 'off';
  if (on !== stored.draftOn) out.papic_on = on;
  if (on) {
    const early = to === 'now';
    if (early !== stored.early) out.papic_guest_capture_early = early;
  }
  return out;
}

/**
 * The line under the card's title — the current position, honestly, and SHORT: one line beside the head's 96 px control
 * at 390 px (owner-approved 2026-10-30 — "Guests shoot on the event day" wrapped and orphaned "day"). The dropdown's
 * button already names which On, so the waiting line need not.
 */
export function papicHeadLine(f: PapicHeadFacts): string {
  const at = papicHeadPosition(f);
  if (at === null) return 'Couldn’t check just now';
  if (at === 'off') return f.live ? 'Off after you Apply' : 'Off';
  if (!f.live) return 'On after you Apply';
  return at === 'now' ? 'Guests can shoot now' : 'On the event day';
}
