/**
 * lib/papic-shoot-now.ts — 📷 WHICH SWITCH SITS IN THE HEAD OF HOME'S PAPIC CARD, AND WHAT ITS LINE SAYS.
 *
 * Owner, 2026-10-30: *"actually the switch on event home should be the let everybody shoot now function"* · *"of papic
 * on papic's widget with that toggle switch"*.
 *
 *   · Papic OFF (or no guest cameras on this event) → the head keeps the Papic switch (`events.papic_on`, saved into the
 *     Event Hub draft) — guests cannot shoot before Papic is on, so "shoot now" would govern nothing.
 *   · Papic ON (and guest cameras not 'off') → the head is "Let everybody shoot now" (`events.papic_guest_capture_early`,
 *     saved LIVE through `setPapicGuestCaptureEarly`), and the line under the card's title says what is saved.
 *
 * 'unknown' guest access (a failed entitlement read) still gives the shoot-now switch: the switch only widens WHEN —
 * the capture route still runs `eventPapicGuestActive` — so it is never a promise the gate does not keep, and hiding it
 * on a failed read would look exactly like an event with no cameras.
 *
 * Pure. Held by `app/dashboard/[eventId]/home-papic-head-is-shoot-now.test.ts`.
 */

export type PapicHeadKind = 'papic' | 'shoot-now';

/** The switch's name — its screen-reader name, and the ⓘ's word for it. */
export const SHOOT_NOW_LABEL = 'Let everybody shoot now';

export function papicHeadKind(papicOn: boolean | null, access: 'on' | 'off' | 'unknown'): PapicHeadKind {
  return papicOn === true && access !== 'off' ? 'shoot-now' : 'papic';
}

/** The line under the card's title while the head is the shoot-now switch. null = the saved value was not read. */
export function shootNowLine(early: boolean | null): string {
  if (early === null) return 'Couldn’t check just now';
  return early ? 'Guests can shoot now' : 'Guests shoot on the event day';
}
