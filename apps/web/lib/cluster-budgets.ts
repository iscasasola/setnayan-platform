import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * ITEM 7d — a cluster shows the BUDGETS of its celebrations.
 *
 * 7a made the link, 7b made one guest one person across it, 7c gave it a
 * timeline. This is the last phase: the same group of celebrations, read for
 * the money each one is PLANNING to spend.
 *
 * ─── 🛑 TWO DIFFERENT MONIES, AND ONLY ONE OF THEM MAY BE ADDED UP ────────
 * BUDGET = pesos the couple plans to spend with vendors. Rolling that across a
 *   cluster is what this file is.
 * THE POT = Papic capture credits, bought per celebration. Rolling THAT across
 *   a cluster is FORBIDDEN — owner ruling 2026-09-02 — because it would change
 *   what every customer already bought. Nothing here reads, names or sums a
 *   point, credit or shot, and
 *   `tests/db/a-pot-belongs-to-one-celebration.db.test.ts` fails the required
 *   check if any code or column starts blurring the two.
 *
 * ─── ⚠ THE TOTAL IS DERIVED HERE AND STORED NOWHERE ───────────────────────
 * 7a's migration forbids a value-bearing column on either cluster table in
 * advance, and its guard's `VALUE_BEARING` pattern already names `budget`. So
 * `rollUpClusterBudgets()` recomputes on every read. A stored span goes stale
 * the first time a date moves (7c); a stored MONEY total goes stale the same
 * way and is read as fact while it does it.
 *
 * ─── ⚠ WHY THE TARGET AND NOT "COMMITTED" ─────────────────────────────────
 * The 2026-09-02 ruling is that a cluster is "presentation and planning; it is
 * NOT accounting." A target is planning — it is the number the host typed.
 * Committed / paid / still-owed are accounting, they belong to `/budget`, and
 * `resolveEventMoney()` is their one calculator. Two further reasons this is
 * not merely deference:
 *   · that resolver is gated on `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED`, which is
 *     NOT SET in Vercel (measured 2026-09-02, 109 vars, no match) and therefore
 *     OFF — a committed column here would be blank in production, or would have
 *     to reproduce the page-local legacy formula and become the SIXTH
 *     incompatible definition of "the budget" that `budget-truth.ts` exists to
 *     end;
 *   · it costs six queries per celebration, fanned across every member.
 * Adding it later is additive. Inventing a second formula is not undoable.
 *
 * ─── ⚠ AN UNREADABLE BUDGET IS NOT A BUDGET OF ZERO ───────────────────────
 * Every row carries a `state`, never a bare number, because ₱0 is a claim: a
 * tile reading "₱0" against a real target is byte-identical to a couple who has
 * planned nothing. `'unknown'` means WE DO NOT KNOW. A caller that renders it
 * as a peso figure — including as "₱0" — has reintroduced the defect this repo
 * has already paid for on the guest list and the supplier ledger.
 */

/**
 * What we actually know about one celebration's budget target.
 *
 * Four states, because four things really are different and one of them is a
 * refusal wearing the same face as an answer:
 *   `set`      — the host typed a target and we read it.
 *   `none`     — we read the row; the host has set no target yet.
 *   `withheld` — you are not a host of this celebration, so its money is not
 *                yours to see. It is in the group; its budget is not shown.
 *   `unknown`  — the read was refused or failed. Not zero. Not "none".
 */
export type BudgetReadState = 'set' | 'none' | 'withheld' | 'unknown';

export type CelebrationBudget = {
  event_id: string;
  state: BudgetReadState;
  /** PHP. Non-null ONLY when `state === 'set'`. */
  targetPhp: number | null;
};

export type ClusterBudgetRollup = {
  /** One row per celebration, in the order the caller supplied them. */
  rows: CelebrationBudget[];
  /**
   * Σ of the `set` rows, in PHP.
   *
   * 🛑 `null` WHENEVER NOTHING CONTRIBUTED — no members, none readable, or
   * every host has yet to set a target. Σ of no rows is 0 in arithmetic and a
   * LIE on a screen: it states that a year costs nothing. The caller says
   * "no budgets set yet" or "we could not read them" in its own words.
   */
  totalPhp: number | null;
  /** How many celebrations the total is actually made of. */
  countedIn: number;
  /** Read fine; the host has set no target yet. */
  noTarget: number;
  /**
   * `unknown` + `withheld`. Greater than zero means the total is PARTIAL and
   * the caller MUST say so — a partial total presented as whole is the same
   * confident-wrong-number defect in a subtler place.
   */
  notCounted: number;
  /**
   * The two halves of `notCounted`, kept apart because they are DIFFERENT
   * SENTENCES. "We could not read it" is a failure the couple can retry;
   * "it is not yours to see" is a rule working correctly. Merging them lets a
   * surface say "no budgets set yet" over a read that actually failed — the
   * same absence-wearing-the-face-of-an-answer defect, in the summary line.
   */
  unknownCount: number;
  withheldCount: number;
};

/**
 * The rollup itself — pure, so the arithmetic is testable with no database and
 * the "unknown never becomes zero" rule is provable rather than asserted.
 */
export function rollUpClusterBudgets(rows: CelebrationBudget[]): ClusterBudgetRollup {
  let totalPhp = 0;
  let countedIn = 0;
  let noTarget = 0;
  let withheldCount = 0;
  let unknownCount = 0;

  for (const row of rows) {
    if (row.state === 'set' && row.targetPhp !== null) {
      totalPhp += row.targetPhp;
      countedIn += 1;
    } else if (row.state === 'none') {
      noTarget += 1;
    } else if (row.state === 'withheld') {
      withheldCount += 1;
    } else {
      // Anything that is not affirmatively one of the three above — including a
      // `set` row that arrived with no figure — is unknown. The fallthrough
      // fails toward "we do not know", never toward a number.
      unknownCount += 1;
    }
  }

  return {
    rows,
    totalPhp: countedIn === 0 ? null : totalPhp,
    countedIn,
    noTarget,
    notCounted: withheldCount + unknownCount,
    unknownCount,
    withheldCount,
  };
}

/**
 * What to SAY when there is no figure to print.
 *
 * 🛑 THE WHOLE POINT IS THAT NONE OF THESE IS A NUMBER. The defect this repo
 * has shipped and re-fixed is an absence rendered as an amount, so the three
 * non-`set` states are given words here — once, in one place a test can sweep —
 * instead of each surface reaching for a dash or a zero of its own.
 *
 * Returns `null` for `set`, where the caller prints the actual peso figure.
 */
export function budgetStateNote(state: BudgetReadState): string | null {
  switch (state) {
    case 'set':
      return null;
    case 'none':
      return 'No budget set yet';
    case 'withheld':
      return 'Not shown — you are not a host of this celebration';
    case 'unknown':
      return 'We could not read this budget';
  }
}

type HostRow = { event_id: string; estimated_budget_centavos: number | string | null };

/**
 * Read every member celebration's budget target, for one signed-in person.
 *
 * `eventIds` comes from the caller's already-read membership (the 7c timeline),
 * so there is ONE source of truth for what is in the group and this function
 * never has to agree with a second one. Order is preserved.
 *
 * ─── 🔒 BELT OVER RLS, AND IT IS LOAD-BEARING ─────────────────────────────
 * `events_host` is `security_invoker = false` and its own WHERE admits a
 * COUPLE member **or an accepted MODERATOR** — that is exactly the leak
 * `lib/budget-visibility.ts` was written for: production carried an accepted
 * planner, `checkout: false`, on an event with a ₱930,000 target. A cluster
 * rollup is a brand-new surface that prints that figure, so it asks first
 * whether this person is a COUPLE member of each celebration and shows the
 * money of no other. A celebration you merely coordinate appears in the group
 * and its budget reads `withheld`.
 *
 * 🔑 THE HOLE THIS CLOSES IS REAL, NOT THEORETICAL. 7a's INSERT policy checks
 * both halves at LINK time — but nothing re-checks them afterwards. Lose your
 * couple membership and you still own a cluster that contains that
 * celebration; without the filter below, the rollup would keep printing its
 * budget forever. Membership is therefore re-asked on every read.
 */
export async function fetchClusterBudgets(
  supabase: SupabaseClient,
  userId: string,
  eventIds: string[],
): Promise<ClusterBudgetRollup> {
  if (eventIds.length === 0) return rollUpClusterBudgets([]);

  const [mineRes, targetsRes] = await Promise.all([
    supabase
      .from('event_members')
      .select('event_id')
      .eq('user_id', userId)
      .eq('member_type', 'couple')
      .in('event_id', eventIds),
    // SEC-2b: events_host, not events — `estimated_budget_centavos` is
    // SELECT-denied to `authenticated` on the base table by 20271008731642.
    // Same door `resolveEventMoney` uses; this file invents no access path.
    supabase
      .from('events_host')
      .select('event_id, estimated_budget_centavos')
      .in('event_id', eventIds),
  ]);

  // A failed membership read cannot be read as "not a couple member" — that
  // would silently relabel every budget `withheld`, which looks deliberate and
  // reassuring on screen. It is unknown, and it says so.
  if (mineRes.error) {
    logQueryError('fetchClusterBudgets.members', mineRes.error, { user_id: userId });
    return rollUpClusterBudgets(
      eventIds.map((event_id) => ({ event_id, state: 'unknown' as const, targetPhp: null })),
    );
  }
  const mine = new Set(
    (mineRes.data ?? []).map((r) => (r as { event_id: string }).event_id),
  );

  if (targetsRes.error) {
    logQueryError('fetchClusterBudgets.targets', targetsRes.error, { user_id: userId });
    return rollUpClusterBudgets(
      eventIds.map((event_id) => ({
        // Still say `withheld` where we KNOW it — that fact came from a read
        // that succeeded, and reporting it as `unknown` would throw away an
        // answer we hold.
        event_id,
        state: mine.has(event_id) ? ('unknown' as const) : ('withheld' as const),
        targetPhp: null,
      })),
    );
  }

  const targets = new Map<string, number | null>();
  for (const row of (targetsRes.data ?? []) as HostRow[]) {
    const raw = row.estimated_budget_centavos;
    targets.set(row.event_id, raw === null || raw === undefined ? null : Number(raw));
  }

  const rows: CelebrationBudget[] = eventIds.map((event_id) => {
    if (!mine.has(event_id)) return { event_id, state: 'withheld', targetPhp: null };

    // A couple member is inside `events_host`'s own WHERE, so a MISSING row
    // here is a refusal or a drift — never an answer. Calling it "no budget
    // set" would invent the one fact we failed to read.
    if (!targets.has(event_id)) return { event_id, state: 'unknown', targetPhp: null };

    const centavos = targets.get(event_id) ?? null;

    // A NULL column is the host's own answer: no target yet.
    if (centavos === null) return { event_id, state: 'none', targetPhp: null };

    // 🛑 A VALUE WE CANNOT READ IS NOT AN UNSET ONE. `estimated_budget_centavos`
    // is BIGINT and PostgREST may hand it back as a string, so this parse is
    // defensive — but folding its failure into `none` would print "No budget
    // set yet" over a figure the host really typed, which is this whole
    // module's defect in miniature. Unparseable falls to `unknown`.
    if (!Number.isFinite(centavos)) return { event_id, state: 'unknown', targetPhp: null };

    return { event_id, state: 'set', targetPhp: centavos / 100 };
  });

  return rollUpClusterBudgets(rows);
}
