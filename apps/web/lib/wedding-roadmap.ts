/**
 * Wedding Roadmap — the free "things to complete" list on the couple Home
 * (owner 2026-06-05 · hybrid auto/manual refinement 2026-06-05).
 *
 * A plain, ordered list of the decisions a couple makes for their wedding,
 * timed by ONE question: "how many months until your earliest date?" As the
 * date nears, more items become due.
 *
 * HYBRID completion (owner 2026-06-05). An item is DONE when EITHER:
 *   (a) the couple TAPS it done — manual check-off, persisted in
 *       `events.roadmap_completed`; OR
 *   (b) the app already holds a HARD, structural signal that it's done — the
 *       date is committed, a vendor in that category is at status contracted+,
 *       a count is > 0, a capture SKU is paid.
 * A done item drops off the open list. Of the 11 items, 8 are "confirmable" and
 * carry an auto-signal (see {@link RoadmapSignals}); the other 3 — reception
 * look, save-the-dates, invitations — have no reliable in-app signal and stay
 * MANUAL-only. Every item that is still open — INCLUDING an auto item the app
 * can't yet confirm (e.g. a civil / same-venue couple with no separate ceremony
 * venue) — keeps its manual Done button, so the couple is NEVER stuck.
 *
 * This is NOT the retired Today's-Focus automation: no AI, no inference from
 * soft signals, no personalized planning intelligence. The only computed things
 * are plain date math (months to the earliest date → which items are due) and
 * deterministic structural facts the app already stores.
 *
 * Anchored on the EARLIEST chosen date — committed `event_date` → earliest
 * candidate → window start — the same anchor the countdown uses.
 *
 * Pure: maps (months-to-earliest, completed[], signals) → the ordered open
 * items, and (completed[], signals) → the done count.
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
 * Hard, structural completion signals — booleans the caller derives from data
 * the app ALREADY holds (no AI, no inference). Each maps to exactly one of the
 * 8 "confirmable" items; the 3 manual-only items have no field here. When a
 * signal is true the item is auto-done; when false it falls back to the couple's
 * manual Done button.
 */
export type RoadmapSignals = {
  /** `events.event_date` is committed (a single locked date, not just candidates). */
  dateLocked: boolean;
  /** ≥1 reception-venue `event_vendors` row at status contracted-or-past. */
  receptionVenueBooked: boolean;
  /** ≥1 ceremony-venue `event_vendors` row at status contracted-or-past. */
  ceremonyVenueBooked: boolean;
  /** `events.estimated_budget_centavos` is set ( > 0 ). */
  budgetSet: boolean;
  /** ≥1 guest on the list. */
  hasGuests: boolean;
  /** ≥1 NON-venue `event_vendors` row at status contracted-or-past (a core vendor booked). */
  coreVendorBooked: boolean;
  /** ≥1 seating table created. */
  seatingStarted: boolean;
  /** ≥1 paid/fulfilled Setnayan capture order (Papic / Panood / Patiktok family). */
  setnayanCaptureSet: boolean;
};

/**
 * Whether `key` is auto-satisfied by a structural signal. Items not listed
 * (reception_look · save_the_dates · invitations) are manual-only and always
 * return false. A `null` signals bag means the caller couldn't derive signals
 * (e.g. a failed fetch) — every item then degrades to pure manual check-off.
 */
function autoSatisfied(key: RoadmapItemKey, signals: RoadmapSignals | null): boolean {
  if (!signals) return false;
  switch (key) {
    case 'lock_date':
      return signals.dateLocked;
    case 'reception_venue':
      return signals.receptionVenueBooked;
    case 'ceremony_venue':
      return signals.ceremonyVenueBooked;
    case 'budget':
      return signals.budgetSet;
    case 'guest_list':
      return signals.hasGuests;
    case 'core_vendors':
      return signals.coreVendorBooked;
    case 'seating':
      return signals.seatingStarted;
    case 'setnayan_capture':
      return signals.setnayanCaptureSet;
    default:
      return false;
  }
}

/** Done = auto-satisfied by a structural signal OR manually checked off. */
function isItemDone(
  key: RoadmapItemKey,
  completed: readonly string[],
  signals: RoadmapSignals | null,
): boolean {
  return autoSatisfied(key, signals) || completed.includes(key);
}

/**
 * The open items to show: those that are DUE (within their months-out window,
 * or always-due for the 12+ band) AND not yet done. In planning order.
 *
 * `signals` is optional — omit it (or pass null) to fall back to pure manual
 * check-off, the old behavior, so a signal-fetch failure never hides items.
 */
export function resolveRoadmap(
  monthsToEarliest: number | null,
  completed: readonly string[],
  signals: RoadmapSignals | null = null,
): RoadmapItem[] {
  const out: RoadmapItem[] = [];
  for (const i of ITEMS) {
    const due =
      i.dueWithinMonths === null
        ? true
        : monthsToEarliest !== null && monthsToEarliest <= i.dueWithinMonths;
    if (!due) continue;
    if (isItemDone(i.key, completed, signals)) continue;
    out.push({ key: i.key, label: i.label, band: i.band });
  }
  return out;
}

/**
 * Count of done items across the WHOLE flow (auto + manual), regardless of
 * whether they're due yet — the honest "N of M done" read. A couple who locked
 * their venue or started seating early sees it counted even before that band
 * comes due.
 */
export function countRoadmapDone(
  completed: readonly string[],
  signals: RoadmapSignals | null = null,
): number {
  let n = 0;
  for (const i of ITEMS) {
    if (isItemDone(i.key, completed, signals)) n++;
  }
  return n;
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
