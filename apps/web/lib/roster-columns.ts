/**
 * roster-columns.ts — WHICH columns the Guest list shows, and how many.
 *
 * Owner, 2026-09-30 (DECISION_LOG "THE GUEST LIST USES THE FULL WIDTH; COLUMN
 * COUNT FOLLOWS THE SCREEN; EVERY HEADER IS A DROPDOWN"): *"we also want to
 * stretch the guestlist to maximize the space allowing more columns. number of
 * columns to show depends on the width of the screen. allow dropdown to each
 * column like mobile mode."* — and "GUEST LIST: ACCESS + CHECK-IN BECOME
 * COLUMNS" (the phone: Name + ONE column whose header is a dropdown).
 *
 *   · Name is always first; after it come as many SLOTS as fit (~160px each).
 *   · Each slot's header is a dropdown choosing what it shows. No column twice:
 *     picking one that is already shown SWAPS the two.
 *   · The default fill, left → right: Invite first while anyone is unsent (so
 *     sending stays one tap), then RSVP; from the event day Check-in leads.
 *   · Check-in exists only from the event day.
 *
 * Pure — no React, no DOM, no storage — so the rules are executed by their
 * guard (`the-fable-card-and-rows.test.ts`), not only read.
 */

export const ROSTER_COLUMNS = [
  'invite',
  'rsvp',
  'access',
  'checkin',
  'seat',
  'side',
  'role',
  'groups',
  'plus',
  'account',
  'contact',
] as const;

export type RosterColumn = (typeof ROSTER_COLUMNS)[number];

export const ROSTER_COLUMN_LABEL: Record<RosterColumn, string> = {
  invite: 'Invite',
  rsvp: 'RSVP',
  access: 'Access',
  checkin: 'Check-in',
  seat: 'Seat',
  side: 'Side',
  role: 'Role',
  groups: 'Groups',
  plus: '+N',
  account: 'Account',
  contact: 'Contact',
};

export function isRosterColumn(v: unknown): v is RosterColumn {
  return typeof v === 'string' && (ROSTER_COLUMNS as readonly string[]).includes(v);
}

/** The columns this list can show at all, in their default left → right order. */
export function defaultRosterColumns(opts: {
  /** Anyone still to be sent their invitation. */
  anyUnsent: boolean;
  /** The event day (or after) — Check-in exists and leads. */
  checkinOpen: boolean;
  /** A birthday has no sides. */
  hasSides: boolean;
}): RosterColumn[] {
  let order: RosterColumn[] = [...ROSTER_COLUMNS];
  if (!opts.hasSides) order = order.filter((c) => c !== 'side');
  if (!opts.checkinOpen) order = order.filter((c) => c !== 'checkin');
  // Invite leads while anyone is unsent; otherwise the answers do.
  if (!opts.anyUnsent) order = ['rsvp', 'invite', ...order.filter((c) => c !== 'rsvp' && c !== 'invite')];
  // From the day, who arrived leads.
  if (opts.checkinOpen) order = ['checkin', ...order.filter((c) => c !== 'checkin')];
  return order;
}

/** A slot is ~160px; Name keeps 260px and the tick box 40px. */
export const SLOT_PX = 160;
export const NAME_PX = 260;
export const CHECK_PX = 40;

/** How many slots fit a list this wide — about 4 at a 1280px screen, 6 at 1600, 8+ at 2000. */
export function rosterSlotCount(listWidthPx: number, available: number): number {
  const fit = Math.floor((listWidthPx - NAME_PX - CHECK_PX) / SLOT_PX);
  return Math.max(1, Math.min(available, Number.isFinite(fit) ? fit : 1));
}

/**
 * The columns to draw: what this device remembered (valid, available, once
 * each), then the defaults it did not name, cut to the slots that fit.
 */
export function resolveRosterColumns(
  remembered: readonly unknown[] | null,
  defaults: readonly RosterColumn[],
  slots: number,
): RosterColumn[] {
  const out: RosterColumn[] = [];
  for (const c of remembered ?? []) {
    if (isRosterColumn(c) && defaults.includes(c) && !out.includes(c)) out.push(c);
  }
  for (const c of defaults) if (!out.includes(c)) out.push(c);
  return out.slice(0, Math.max(1, slots));
}

/**
 * Put `column` in `slot`. If it is already shown in another slot, the two swap —
 * no column is ever shown twice. Returns the full new list to remember.
 */
export function pickRosterColumn(
  shown: readonly RosterColumn[],
  slot: number,
  column: RosterColumn,
): RosterColumn[] {
  const next = [...shown];
  const at = next.indexOf(column);
  const was = next[slot];
  if (was === undefined) return next;
  next[slot] = column;
  if (at > -1 && at !== slot) next[at] = was;
  return next;
}
