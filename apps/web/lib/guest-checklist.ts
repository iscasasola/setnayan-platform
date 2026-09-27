/**
 * "YOUR CHECKLIST" — the last 30 days, for each identified guest (owner
 * 2026-09-26, DECISION_LOG "THE LAST 30 DAYS: EACH GUEST GETS YOUR CHECKLIST"
 * and "THE GUEST CHECKLIST IS INTERACTIVE — THEY TICK WHAT IS READY").
 *
 * Owner, verbatim: *"When we are on the countdown to the last 30 days. remind
 * each guest of what they need. the clothes they need? motif? etc."* →
 * *"something interactive they can mark checked if those are ready"*.
 *
 * Pure — no I/O. The page gathers the facts; this decides which items exist,
 * what each says, and how many are ticked. An item with nothing true to say is
 * NOT drawn (a "Your table" with no table is a promise, not a checklist item).
 *
 * 🔑 TICKS BELONG TO THE GUEST (saved server-side, `guest_checklist_ticks`),
 * never to the device, and are private to them.
 */

export const CHECKLIST_KEYS = ['wear', 'motif', 'arrive', 'table', 'pass'] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export function isChecklistKey(v: unknown): v is ChecklistKey {
  return typeof v === 'string' && (CHECKLIST_KEYS as readonly string[]).includes(v);
}

/** Stored ticks are data a request wrote — keep only known keys, once each. */
export function sanitizeTicks(raw: unknown): ChecklistKey[] {
  if (!Array.isArray(raw)) return [];
  const out: ChecklistKey[] = [];
  for (const v of raw) if (isChecklistKey(v) && !out.includes(v)) out.push(v);
  return out;
}

/** Tick or untick one item — the stored array the save writes back. */
export function applyTick(current: readonly string[], key: ChecklistKey, done: boolean): ChecklistKey[] {
  const kept = sanitizeTicks(current).filter((k) => k !== key);
  return done ? [...kept, key] : kept;
}

/** The window: the 30 days before the event, up to and including the day before. */
export const CHECKLIST_WINDOW_DAYS = 30;

/**
 * Is the checklist shown today? Both dates are `YYYY-MM-DD` in the event's own
 * day (compared as calendar days, never through `new Date(eventDate)`, which is
 * midnight UTC and the previous evening in Manila).
 */
export function checklistShows(input: { eventDate: string | null | undefined; today: string }): boolean {
  const days = daysUntil(input);
  return days != null && days >= 1 && days <= CHECKLIST_WINDOW_DAYS;
}

/** A `YYYY-MM-DD` as a whole-day number, or null. */
function dayNumber(s: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '');
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

export function daysUntil(input: { eventDate: string | null | undefined; today: string }): number | null {
  const e = dayNumber(input.eventDate);
  const t = dayNumber(input.today);
  if (e == null || t == null) return null;
  return Math.round(e - t);
}

export type ChecklistItem = {
  key: ChecklistKey;
  title: string;
  /** One quiet line under the title. */
  sub: string | null;
  /** Swatches for the motif item. */
  swatches?: string[];
  /** One link on the line (Open in Maps · Save to Photos). */
  link?: { label: string; href: string; download?: boolean } | null;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function buildChecklist(input: {
  /** "Filipiniana formal" — the reader's own role's style, else the general dress code title. */
  wear: string | null;
  wearNote: string | null;
  /** Motif colours — the Mood Board palette (swatches only for now). */
  motif: readonly string[];
  /** "2:30 PM" — the first block of the run of show. */
  arriveBy: string | null;
  venueName: string | null;
  /** Only once the venue is open to this guest (they replied, or it is the day). */
  mapsHref: string | null;
  tableLabel: string | null;
  /** Where "Save to Photos" downloads this guest's own pass. */
  passHref: string;
}): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  if (input.wear || input.wearNote) {
    items.push({ key: 'wear', title: 'What to wear', sub: [input.wear, input.wearNote].filter(Boolean).join(' · ') || null });
  }
  const swatches = input.motif.filter((h) => HEX.test(h)).slice(0, 6);
  if (swatches.length > 0) items.push({ key: 'motif', title: 'Motif colours', sub: null, swatches });
  if (input.arriveBy || input.venueName) {
    items.push({
      key: 'arrive',
      title: input.arriveBy ? `Arrive by ${input.arriveBy}` : 'How to get there',
      sub: input.venueName,
      link: input.mapsHref ? { label: 'Open in Maps', href: input.mapsHref } : null,
    });
  }
  if (input.tableLabel) items.push({ key: 'table', title: 'Your table', sub: input.tableLabel });
  items.push({
    key: 'pass',
    title: 'Your QR pass saved',
    sub: null,
    link: { label: 'Save to Photos', href: input.passHref, download: true },
  });
  return items;
}

/** "3 of 5 ready", and whether they are all set. Only DRAWN items count. */
export function checklistProgress(items: readonly ChecklistItem[], ticks: readonly string[]): {
  ready: number;
  total: number;
  allSet: boolean;
} {
  const t = new Set(sanitizeTicks(ticks));
  const ready = items.filter((i) => t.has(i.key)).length;
  return { ready, total: items.length, allSet: items.length > 0 && ready === items.length };
}
