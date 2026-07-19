/**
 * merkado-guard.ts — the Merkado "watch guard" (2026-07-10, PR-4 · S4).
 *
 * Setnayan AI watches the couple's whole BUILD (their picked team) for feasibility
 * conflicts and surfaces them warn-only — it flags, never blocks (owner-locked).
 * Three checks across the team:
 *   • budget — Σ pick costs vs the total budget
 *   • date   — do the picks share an available date among the couple's candidate
 *              dates? (a couple can hold several candidate dates)
 *   • reach  — does every pick reach the venue's area?
 *
 * Pure + framework-free so it unit-tests cleanly and the server can compose it
 * from data it already resolves for the fit-badges (availability, tier-radius
 * reach, quote/starts-at price, budget snapshot). Fail-open: an UNKNOWN input
 * (null) never raises an issue — we never fabricate an unavailability, matching
 * the dashboard's fit-badge rule.
 */

import { formatPhp } from '@/lib/vendors';

export type GuardPick = {
  vendorId: string;
  /** Vendor or category label for the message. */
  label: string;
  /** The pick's price (quote first, else starts-at), or null when unknown. */
  pricePhp: number | null;
  /** Which of the couple's candidate date-keys this vendor is FREE on — or null
   *  when there's no date signal (not marketplace-connected / no candidate dates /
   *  the check didn't run). Null means "no constraint" → never causes a clash. */
  freeCandidateDayKeys: string[] | null;
  /** TRUE = reaches the venue area · FALSE = out of range · null = unknown. */
  withinReach: boolean | null;
};

export type BuildGuardInput = {
  picks: GuardPick[];
  /** The couple's candidate wedding date-keys (they may still be choosing). */
  candidateDayKeys: string[];
  /** Total budget in PHP whole pesos, or null when unset. */
  totalBudgetPhp: number | null;
};

export type GuardIssue = {
  kind: 'budget' | 'date' | 'reach';
  /** The vendor to jump to for a fix, or null for a build-wide issue (budget). */
  vendorId: string | null;
  text: string;
};

export type BuildGuard = { ok: boolean; issues: GuardIssue[] };

/**
 * Warn-only build feasibility. `ok` is true iff no KNOWN conflict exists;
 * unknown inputs never produce an issue.
 */
export function computeBuildGuard(input: BuildGuardInput): BuildGuard {
  const issues: GuardIssue[] = [];

  // Budget — committed total vs the budget (only when both are known).
  if (input.totalBudgetPhp != null) {
    const committed = input.picks.reduce(
      (s, p) => s + (typeof p.pricePhp === 'number' ? p.pricePhp : 0),
      0,
    );
    if (committed > input.totalBudgetPhp) {
      issues.push({
        kind: 'budget',
        vendorId: null,
        text: `Over budget by ${formatPhp(committed - input.totalBudgetPhp)}`,
      });
    }
  }

  // Reach — any pick we KNOW is out of range.
  for (const p of input.picks) {
    if (p.withinReach === false) {
      issues.push({ kind: 'reach', vendorId: p.vendorId, text: `${p.label} doesn’t reach your venue` });
    }
  }

  // Date — do the date-constrained picks share a candidate date? Only picks with
  // a real date signal participate; if their mutual free-set is empty (and ≥2
  // constrain the date) the team can't all show up on one candidate date.
  const dated = input.picks.filter((p) => p.freeCandidateDayKeys != null);
  if (dated.length >= 2) {
    let common = new Set(input.candidateDayKeys);
    for (const p of dated) {
      const free = new Set(p.freeCandidateDayKeys as string[]);
      common = new Set([...common].filter((d) => free.has(d)));
    }
    if (common.size === 0) {
      // Flag the most-restrictive pick (fewest free candidate dates).
      const worst = [...dated].sort(
        (a, b) => (a.freeCandidateDayKeys as string[]).length - (b.freeCandidateDayKeys as string[]).length,
      )[0]!;
      issues.push({
        kind: 'date',
        vendorId: worst.vendorId,
        text: `No shared date — ${worst.label} clashes with the team`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
