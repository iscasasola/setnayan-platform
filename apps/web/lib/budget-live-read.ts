/**
 * lib/budget-live-read.ts — THE COUPLE'S PAID / STILL-OWING READ, ONE COPY.
 *
 * Root map part 2, "the same fact shown twice on one screen" (owner 2026-10-02):
 * the same four steps — read the budget snapshot, resolve the event money behind
 * the flag, collapse them with `budgetLiveSummaryMoney`, degrade honestly — were
 * written out in the Home page and again in the Merkado budget lens, each
 * "the same rule, the same shape" as `/budget`. Two copies of one calculation is
 * how a Paid figure on one screen stops matching the one on the next.
 *
 * ⚠ HONESTY IS PART OF THE CONTRACT. `fetchBudgetSnapshot` THROWS on any refused
 * read, so `summary: null` means "NOT MEASURED" — a caller prints "—", never ₱0.
 * A resolver failure degrades to the legacy figures rather than a confident ₱0.
 * Flag OFF issues no resolver query at all (`money` is null).
 *
 * Callers still decide WHO may see money (`resolveBudgetVisibility`) BEFORE they
 * call this: a refusal that still queries the money is a refusal on the screen
 * only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { buildBudgetLiveSummary, fetchBudgetSnapshot, type BudgetLiveSummary } from '@/lib/budget';
import { resolveEventMoney, type EventMoney } from '@/lib/budget-truth';
import { budgetLiveSummaryMoney } from '@/lib/budget-page-money';
import { isBudgetTruthEnabled } from '@/lib/budget-truth-flag';

export type BudgetLiveRead = {
  /** The Paid / remaining summary, or null when the snapshot could not be read. */
  summary: BudgetLiveSummary | null;
  /** Which arithmetic the figures follow (it changes the noun under a percentage). */
  truth: boolean;
  /** The resolved event money (null: flag off, or the resolver failed). Feeds the Sai guard. */
  money: EventMoney | null;
};

export async function readBudgetLiveSummary(
  supabase: SupabaseClient,
  eventId: string,
  opts: {
    /** Cap on the upcoming milestones listed (the Merkado lens shows 3; /budget lists all). */
    upcomingCap?: number;
    /** Told about a refused snapshot read, so the caller can log it with its own context. */
    onSnapshotError?: (err: unknown) => void;
  } = {},
): Promise<BudgetLiveRead> {
  const truth = isBudgetTruthEnabled();
  const [snapshot, money] = await Promise.all([
    fetchBudgetSnapshot(supabase, eventId).catch((err: unknown) => {
      opts.onSnapshotError?.(err);
      return null;
    }),
    truth
      ? resolveEventMoney(supabase, eventId).catch((): EventMoney | null => null)
      : Promise.resolve<EventMoney | null>(null),
  ]);
  if (!snapshot) return { summary: null, truth, money };
  return {
    summary: budgetLiveSummaryMoney({
      enabled: truth,
      money,
      legacy: buildBudgetLiveSummary(snapshot, opts.upcomingCap),
    }),
    truth,
    money,
  };
}
