/**
 * _claims.ts — which /for-coordinators lines may be shown right now.
 *
 * Owner, 2026-11-04: four of the page's claims are true only while a switch is on, so *"show each
 * line only when its switch is on. The page reads the live setting, so it can never promise
 * something that's off."* A line that depends on a switch carries `needs: <switch>`; the page shows
 * it only when that switch reads ON. The switches are read live (`_claims.server.ts`), and an
 * unreadable switch reads OFF — the page then says less, never something untrue.
 *
 *   runOfShow     · each supplier sees only their own rows ............ Data Privacy `coordinator_run_of_show`
 *   announcements · one announcement on every guest's Event Hub ....... Data Privacy `coordinator_day_of_broadcast`
 *   prepRelease   · prepare in private, then release to the couple ..... Data Privacy `coordinator_prep_release`
 *   privateNotes  · private notes + notes the couple can read .......... env `NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED`
 *   dayOfFree     · cue the show · requests inbox · seat scanner are FREE  `FREE_SPECIALIZATION_SETS` (lib/vendor-specialization-gate.ts)
 *
 * 🎚 `dayOfFree` IS THE FIFTH, AND IT DECIDES A PRICE TAG, NOT ONLY WHETHER A LINE SHOWS. The owner ruled
 * the day-of desks free with no end date (DECISION_LOG 2026-11-04), and since 2026-11-05 the gate holds
 * the floor-command set free for any booked supplier (`FREE_SPECIALIZATION_SETS`, board "✅ RESOLVED on
 * main 6 Nov"). The page asks the same set the gate asks, so if the set ever leaves it, those tools are
 * tagged with the plan that opens them instead of "Free" — with no edit here.
 *
 * Pure: no I/O, so the guard beside the page can run it with every switch on and off.
 */

import { formatCount } from '@/lib/format-number';

export const CLAIM_SWITCHES = ['runOfShow', 'announcements', 'prepRelease', 'privateNotes', 'dayOfFree'] as const;
export type ClaimSwitch = (typeof CLAIM_SWITCHES)[number];
export type ClaimSwitches = Readonly<Record<ClaimSwitch, boolean>>;

export const ALL_SWITCHES_OFF: ClaimSwitches = {
  runOfShow: false,
  announcements: false,
  prepRelease: false,
  privateNotes: false,
  dayOfFree: false,
};

/** The items whose switch is on, in their order. An item with no `needs` always shows. */
export function shownWith<T extends { needs?: ClaimSwitch }>(items: readonly T[], on: ClaimSwitches): T[] {
  return items.filter((it) => !it.needs || on[it.needs] === true);
}

const WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen', 'Twenty',
] as const;

/** "Nine" for 9 — a heading's count, spelled the way the prototype spells it. Digits past twenty. */
export function countWord(n: number): string {
  return WORDS[n] ?? formatCount(n);
}
