/**
 * 💳 THE PAYMENT PLAN, FOLDED TO ONE ROW IN THE SUPPLIER CHAT (DECISION_LOG 2026-11-16 CHAT-09, owner "Yes, build it";
 * drawing `chat-room-proto.html` §1). The plan card sat open above the conversation and took ~45% of a phone; in the
 * chat it is now ONE 44 px row — "Plan · ₱0 of ₱8,750 · next ₱1,750 Nov 15" — that opens in place. The customer card's
 * Payment tab keeps the whole card (it is not folded there).
 *
 * Pure: the row's words, and the "a newly logged payment opens it once" rule (copied from the due-now pins'
 * remembered fold, `chat-pins.tsx`: the ids already seen on this device; a NEW one opens the row once).
 * 🔒 lib/the-plan-folds-to-one-row.test.ts
 */
import type { PlanRollup } from './vendor-service-payment-schedules';
import { formatPhp } from './php';

const peso = (n: number) => formatPhp(Math.abs(Math.round(n)));

/** "Nov 15" — a frozen due date is DATE-ONLY (YYYY-MM-DD), anchored at UTC noon so Manila never shifts it a day. */
export function planShortDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(d);
}

/**
 * The folded row's words, after the bold "Plan": the received-of-total roll-up, then the ONE thing that matters next —
 * the same facts, in the same order, the open card says (`vendor-payment-live.tsx`), cut to one line.
 */
export function planFoldLine(rollup: PlanRollup, cleared: boolean, hasSteps: boolean, todayIso: string | null): string {
  if (cleared) return 'cleared · nothing outstanding';
  if (!hasSteps || rollup.total <= 0) return 'no payment schedule';
  const head = `${peso(rollup.received)} of ${peso(rollup.total)}`;
  if (rollup.pending > 0) return `${head} · ${peso(rollup.pending)} to confirm`;
  if (rollup.next) {
    const when = planShortDate(rollup.next.dueDate);
    // ⏰ A due date already past is OVERDUE, never "next" (owner screenshot 17 Nov: "next ₱5,350 Nov 13" on the 17th).
    // `todayIso` is Manila's today from the server; null (unknown) keeps the plain "next" — never a guessed "overdue".
    if (when && todayIso && rollup.next.dueDate && rollup.next.dueDate.slice(0, 10) < todayIso.slice(0, 10)) {
      return `${head} · ${peso(rollup.next.amountPhp)} overdue since ${when}`;
    }
    return `${head} · next ${peso(rollup.next.amountPhp)}${when ? ` ${when}` : ''}`;
  }
  return `${head} · all confirmed`;
}

/** The device's memory of the logged payments already shown, per chat. */
export const PLAN_FOLD_SEEN_KEY = (threadId: string) => `sn-chat-plan-seen:${threadId}`;

/**
 * Does the row open by itself? Only for a logged payment this device has NOT shown yet — once; after that the person's
 * own tap decides. `seenRaw` is what the device remembered (`null` = never), the ids joined by `|`.
 */
export function planFoldOpensFor(pendingIds: readonly string[], seenRaw: string | null): boolean {
  const seen = new Set((seenRaw ?? '').split('|').filter(Boolean));
  return pendingIds.some((id) => !seen.has(id));
}
