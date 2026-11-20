/**
 * lib/admin/focus-urgency.ts — ADMIN FOCUS, SAME RULES AS TODAY (Today v3 part 4 · pure).
 *
 * Owner, 19 Nov 2026: *"this applies to admin and supplier's today"*; ruled the same day: one list by urgency, a tap
 * opens the item's card in place, drag right = its page, drag left = tomorrow for THAT admin only, no Reply · N / Fix · N
 * headings (each row keeps its ↩ or ! mark). Drawing `Today, tap opens a card` v3.5, V3 · 4.
 *
 * Where the level comes from — only clocks the code already has (`computeDueState` on `ADMIN_QUEUE_META[…].slaHours`):
 *   · red · Overdue — the queue's oldest item is past its clock;
 *   · amber · Soon — three quarters of the clock (`due-soon`), which existed and Focus did not show;
 *   · no clock (`slaHours: null`) or anything else — normal. "Today" has no admin source (clocks are in hours).
 * 🔒 lib/admin/focus-urgency.test.ts · app/admin/focus-opens-in-place.test.ts
 */
import type { AdminQueueDueState } from '@/lib/admin/queue-counts';

export type FocusLevel = { level: 'red' | 'amber'; word: 'Overdue' | 'Soon' };

export function focusLevel(due: AdminQueueDueState): FocusLevel | null {
  if (due === 'overdue') return { level: 'red', word: 'Overdue' };
  if (due === 'due-soon') return { level: 'amber', word: 'Soon' };
  return null;
}

const RANK = { red: 0, amber: 1 } as const;

/** Red, then amber, then the rest — each level in the order it arrived (stable). */
export function orderFocusRows<T extends { level: FocusLevel | null }>(rows: readonly T[]): T[] {
  return rows
    .map((r, i) => [r, i] as const)
    .sort((a, b) => (a[0].level ? RANK[a[0].level.level] : 2) - (b[0].level ? RANK[b[0].level.level] : 2) || a[1] - b[1])
    .map((x) => x[0]);
}

/**
 * The rows still in Focus today and the ones this admin put off. A red row ignores its record — an overdue item is
 * never hidden. `putOff` unread (null) → nothing is held off.
 */
export function splitFocusPutOffs<T extends { key: string; level: FocusLevel | null }>(rows: readonly T[], putOff: ReadonlySet<string> | null): { now: T[]; tomorrow: T[] } {
  const now: T[] = [];
  const tomorrow: T[] = [];
  for (const r of rows) (putOff?.has(r.key) && r.level?.level !== 'red' ? tomorrow : now).push(r);
  return { now, tomorrow };
}
