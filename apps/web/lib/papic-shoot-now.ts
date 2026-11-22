/**
 * lib/papic-shoot-now.ts — 📷 THE ONE CONTROL IN THE HEAD OF THE PAPIC CARD: OFF · ON — EVENT DAY · ON — EVERYONE, NOW.
 *
 * Owner, 2026-10-30: *"actually the switch on event home should be the let everybody shoot now function"* · *"If we
 * cannot turn it off, then maybe assign partial turn on?"*. ⇒ ONE dropdown (a set of choices is one `PickMenu`), three
 * positions, over the two columns that already say these facts.
 *
 * ⚡ LIVE — NO APPLY (owner 2026-11-22, specs DECISION_LOG "THE PAPIC DROPDOWN IN MEMORIES IS LIVE — NO APPLY": *"No need
 * to apply. Just go to memories and change the papic drop down there"*). This supersedes the 30 Oct "Off/On through the
 * Event Hub draft, live only after Apply" half of the ruling:
 *
 *   Off                   → `events.papic_on` false, LIVE. `papic_guest_capture_early` is left as it is.
 *   On — event day        → `papic_on` true + `papic_guest_capture_early` false, LIVE.
 *   On — everyone, now    → `papic_on` true + `papic_guest_capture_early` true, LIVE.
 *
 * Both columns go in ONE write (`setPapicGuestCaptureEarly`), which also clears any `papic_on` still waiting in the
 * Event Hub draft, so a later Apply cannot undo the pick. The head therefore reads the LIVE value, and no line says
 * "after you Apply". Event Details › Photos from guests keeps its own draft path. An unread value is "Couldn’t check
 * just now".
 *
 * Pure. Held by `app/dashboard/[eventId]/home-papic-head-is-shoot-now.test.ts`.
 */

export type PapicHeadPosition = 'off' | 'eventday' | 'now';

export const PAPIC_HEAD_LABEL = 'Papic';

/** The three positions, in order — the dropdown's options. `short` is the head's compact button. */
export const PAPIC_HEAD_OPTIONS: ReadonlyArray<{ key: PapicHeadPosition; label: string; short: string }> = [
  { key: 'off', label: 'Off', short: 'Off' },
  { key: 'eventday', label: 'On — event day', short: 'On — event day' }, // controller 21 Nov: the head pill reads the drawing's words
  { key: 'now', label: 'On — everyone, now', short: 'Now' },
];

/** What the head knows — both LIVE. `live` = `events.papic_on` as guests have it; null = not read. */
export type PapicHeadFacts = { live: boolean | null; early: boolean | null };

export function papicHeadPosition(f: PapicHeadFacts): PapicHeadPosition | null {
  if (f.live === null || f.early === null) return null;
  if (!f.live) return 'off';
  return f.early ? 'now' : 'eventday';
}

/**
 * The writes a position makes, against what is stored (both live): `papic_on` only when it changes; the early column
 * only for an On position, and only when it changes. Off never touches `papic_guest_capture_early`.
 */
export function papicHeadWrites(
  to: PapicHeadPosition,
  stored: { on: boolean; early: boolean },
): { papic_on?: boolean; papic_guest_capture_early?: boolean } {
  const out: { papic_on?: boolean; papic_guest_capture_early?: boolean } = {};
  const on = to !== 'off';
  if (on !== stored.on) out.papic_on = on;
  if (on) {
    const early = to === 'now';
    if (early !== stored.early) out.papic_guest_capture_early = early;
  }
  return out;
}

/**
 * The line under the card's title — the current position, and SHORT: one line beside the head's 96 px control at
 * 390 px (owner-approved 2026-10-30). Live since 2026-11-22: it never says "after you Apply".
 */
export function papicHeadLine(f: PapicHeadFacts): string {
  const at = papicHeadPosition(f);
  if (at === null) return 'Couldn’t check just now';
  if (at === 'off') return 'Off';
  return at === 'now' ? 'Guests can shoot now' : 'On the event day';
}
