/**
 * dispute-demotion.ts — the ONE decision the dispute-counter cron makes, as a
 * pure function, so it can be executed in a test rather than grepped for.
 *
 * The cron (app/api/admin/cron/dispute-counter/route.ts) finds CANDIDATES with a
 * cheap TypeScript scan, then asks public.count_vendor_disputes_30d — the SQL
 * helper the dispute-mediation migration (20270413204817) shipped for exactly
 * this — for the number that actually demotes. Two counts of one fact can
 * disagree while each passes its own suite (CLAUDE.md RULE 0 §8); this function
 * is where the disagreement is made visible and where the SQL count wins.
 *
 * `authoritative` is typed `unknown` on purpose: it is whatever PostgREST
 * returned. A count that is not a finite non-negative number is a FAULT the
 * caller must record, never a zero to be demoted on or a NaN to be ignored.
 */
export type DisputeCountVerdict =
  | {
      ok: true;
      /** The database's count — the only number the demotion may read. */
      count: number;
      /** count >= threshold. */
      demote: boolean;
      /** The scan and the database disagreed. Record it; the database decides. */
      disagreed: boolean;
    }
  | { ok: false; reason: string };

export function reconcileDisputeCount(input: {
  scanned: number;
  authoritative: unknown;
  threshold: number;
}): DisputeCountVerdict {
  const raw = input.authoritative;
  const count =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : Number.NaN;
  if (!Number.isInteger(count) || count < 0) {
    return {
      ok: false,
      reason: `count_vendor_disputes_30d returned ${JSON.stringify(raw)} — not a count; nothing was demoted on it`,
    };
  }
  if (!Number.isInteger(input.threshold) || input.threshold < 1) {
    return { ok: false, reason: `demotion threshold ${String(input.threshold)} is not a positive integer` };
  }
  return { ok: true, count, demote: count >= input.threshold, disagreed: count !== input.scanned };
}
