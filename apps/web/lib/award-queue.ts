import { formatCount } from '@/lib/format-number';

/**
 * 🎬 THE AWARD QUEUE AND ITS ONE TODAY LINE (owner 15 Nov 2026, DECISION_LOG e5ec685d "THE WHOLE BADGE + SEAL FLOW —
 * ONE ORDER, AND TWELVE COLLISIONS RULED"; prototype badge-flow-walkthrough_v5):
 *
 *   (7) several earned together = ONE line, played one at a time, in this order: **No. 1 → the other seals → badges in
 *       the order earned** (`orderAwardQueue`);
 *   (8) the Today line is **News until opened, becomes To do if Later mid-flow** — "Continue … · N of M" resumes at the
 *       exact step (`shop_award_flow_progress`, `lib/award-queue.server.ts`);
 *   the line's button is **See it** — the reward is already claimed (pick 2), so there is no "tap to claim", and it never
 *   links to Shop › Promote.
 *
 * PURE — no I/O, no clock. The player that walks the flow is J4's; this is the order and the words it starts from.
 */

/** What an award is: the No. 1 seal, another seal (Verified is a seal — pick 4), or a tiered badge. */
export type AwardKind = 'no1' | 'seal' | 'badge';

export type AwardItem = {
  kind: AwardKind;
  /** The flow's key — the reward key ('completed_bookings:tier2', 'verified') or a seal's key. */
  key: string;
  /** What the shop reads ("Silver Completed bookings", "SETNAYAN Verified"). */
  title: string;
  /** When it was earned (the grant is the earning). */
  earnedAt: string;
};

/** Where a shop is in one flow. `step` 0 = not opened; `finishedAt` set = done. */
export type FlowProgress = {
  flowKey: string;
  step: number;
  totalSteps: number | null;
  openedAt: string | null;
  finishedAt: string | null;
};

const KIND_ORDER: Readonly<Record<AwardKind, number>> = { no1: 0, seal: 1, badge: 2 };

/** No. 1 → the other seals → badges in the order earned (oldest first); a tie keeps a stable key order. */
export function orderAwardQueue(items: readonly AwardItem[]): AwardItem[] {
  return [...items].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.earnedAt.localeCompare(b.earnedAt) || a.key.localeCompare(b.key),
  );
}

/** The Today line for the shop's awards: one line, or null when nothing waits. */
export type TodayAwardLine = {
  /** 'news' until the first award is opened; 'todo' once one was left mid-flow (Later). */
  tone: 'news' | 'todo';
  text: string;
  /** The line's button. */
  action: 'See it' | 'Continue';
  /** The flow the button opens — at its saved step when it is a 'todo'. */
  flowKey: string;
  /** The step to resume at (0 = from the start). */
  resumeStep: number;
  /** How many awards wait in the queue, this one included. */
  waiting: number;
};

/**
 * The one Today line. Unfinished awards only (a finished flow never comes back). A flow left mid-way leads, as a To do
 * at its exact step; otherwise the first in queue order, as News. `progress` null = the progress could not be read: the
 * awards still show as News (never a made-up step).
 */
export function todayAwardLine(
  items: readonly AwardItem[],
  progress: Readonly<Record<string, FlowProgress>> | null,
): TodayAwardLine | null {
  const queue = orderAwardQueue(items).filter((i) => !progress?.[i.key]?.finishedAt);
  if (queue.length === 0) return null;
  const midway = progress ? queue.find((i) => (progress[i.key]?.step ?? 0) > 0) : undefined;
  if (midway) {
    const p = progress![midway.key]!;
    const of = p.totalSteps ? ` · ${formatCount(p.step)} of ${formatCount(p.totalSteps)}` : '';
    return { tone: 'todo', text: `Continue ${midway.title}${of}`, action: 'Continue', flowKey: midway.key, resumeStep: p.step, waiting: queue.length };
  }
  const first = queue[0]!;
  const more = queue.length > 1 ? ` · +${queue.length - 1} more` : '';
  return { tone: 'news', text: `You earned ${first.title}${more}`, action: 'See it', flowKey: first.key, resumeStep: 0, waiting: queue.length };
}

/** A step to save, checked: a whole number 0…200, never past the flow's own length. Null = refuse it. */
export function validFlowStep(step: unknown, totalSteps: unknown): { step: number; totalSteps: number | null } | null {
  const s = typeof step === 'number' ? step : Number.NaN;
  if (!Number.isInteger(s) || s < 0 || s > 200) return null;
  if (totalSteps === undefined || totalSteps === null) return { step: s, totalSteps: null };
  const t = typeof totalSteps === 'number' ? totalSteps : Number.NaN;
  if (!Number.isInteger(t) || t < 1 || t > 200 || s > t) return null;
  return { step: s, totalSteps: t };
}
