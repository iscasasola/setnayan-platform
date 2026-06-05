/**
 * Wedding Roadmap — the free "things to complete" list on the couple Home
 * (owner 2026-06-05).
 *
 * A plain, ordered list of the decisions a couple makes for their wedding,
 * timed by ONE question: "how many months until your earliest date?" As the
 * date nears, more items become due. The couple TAPS each one done themselves
 * — manual check-off, persisted in `events.roadmap_completed`. A done item is
 * removed and stays removed.
 *
 * Explicitly NOT automated (owner): no reading the couple's data to infer
 * "done", no AI/personalized planning intelligence — that Today's-Focus
 * automation is the part we don't want. The only computed thing here is plain
 * date math (months to the earliest chosen date) deciding which items are due.
 *
 * Anchored on the EARLIEST chosen date — committed `event_date` → earliest
 * candidate → window start — the same anchor the countdown uses.
 *
 * Pure: maps (months-to-earliest, completed[]) → the ordered open items.
 */

export type RoadmapItemKey =
  | 'lock_date'
  | 'reception_venue'
  | 'ceremony_venue'
  | 'budget'
  | 'guest_list'
  | 'core_vendors'
  | 'reception_look'
  | 'save_the_dates'
  | 'setnayan_capture'
  | 'invitations'
  | 'seating';

type ItemDef = {
  key: RoadmapItemKey;
  label: string;
  /** Band label shown as the timing hint. */
  band: string;
  /**
   * Becomes "due" once months-to-earliest ≤ this. `null` = due from the very
   * start (the 12+ month band) and stays due until the couple marks it done.
   */
  dueWithinMonths: number | null;
};

// The planning sequence, in order. Bands: 12+ · 9–12 · 6–9 · 4–6 · 2–4.
const ITEMS: readonly ItemDef[] = [
  { key: 'lock_date', label: 'Lock in your final wedding date', band: '12+ months', dueWithinMonths: null },
  { key: 'reception_venue', label: 'Book your reception venue', band: '12+ months', dueWithinMonths: null },
  { key: 'ceremony_venue', label: 'Book your ceremony venue', band: '12+ months', dueWithinMonths: null },
  { key: 'budget', label: 'Set your budget', band: '9–12 months', dueWithinMonths: 12 },
  { key: 'guest_list', label: 'Build your guest list', band: '9–12 months', dueWithinMonths: 12 },
  { key: 'core_vendors', label: 'Start booking your core vendors', band: '9–12 months', dueWithinMonths: 12 },
  { key: 'reception_look', label: 'Decide your reception look', band: '6–9 months', dueWithinMonths: 9 },
  { key: 'save_the_dates', label: 'Send your save-the-dates', band: '6–9 months', dueWithinMonths: 9 },
  { key: 'setnayan_capture', label: 'Set up your Setnayan capture', band: '4–6 months', dueWithinMonths: 6 },
  { key: 'invitations', label: 'Send your invitations', band: '4–6 months', dueWithinMonths: 6 },
  { key: 'seating', label: 'Start your seating plan', band: '2–4 months', dueWithinMonths: 4 },
] as const;

export type RoadmapItem = {
  key: RoadmapItemKey;
  label: string;
  band: string;
};

/**
 * The open items to show: those that are DUE (within their months-out window,
 * or always-due for the 12+ band) AND not yet marked done. In planning order.
 */
export function resolveRoadmap(
  monthsToEarliest: number | null,
  completed: readonly string[],
): RoadmapItem[] {
  const out: RoadmapItem[] = [];
  for (const i of ITEMS) {
    const due =
      i.dueWithinMonths === null
        ? true
        : monthsToEarliest !== null && monthsToEarliest <= i.dueWithinMonths;
    if (!due) continue;
    if (completed.includes(i.key)) continue;
    out.push({ key: i.key, label: i.label, band: i.band });
  }
  return out;
}

/** Total items in the flow — for an "N of M done" progress read. */
export const ROADMAP_TOTAL = ITEMS.length;

/** Valid item keys — for validating the toggle action's input. */
export const ROADMAP_ITEM_KEYS: readonly RoadmapItemKey[] = ITEMS.map((i) => i.key);

/**
 * Months from now until the earliest chosen date. PH-midnight (`+08:00`) of the
 * date, mirroring the countdown's anchor. Returns null when no date is given.
 */
export function monthsUntil(earliestIso: string | null, nowMs: number): number | null {
  if (!earliestIso) return null;
  const target = new Date(`${earliestIso}T00:00:00+08:00`).getTime();
  if (Number.isNaN(target)) return null;
  return (target - nowMs) / 86_400_000 / 30.44;
}
