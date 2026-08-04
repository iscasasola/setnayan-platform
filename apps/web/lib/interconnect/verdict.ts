/**
 * The verdict rule — the one piece of this system that must never be wrong,
 * kept pure so it can be tested without a database.
 *
 * ── THE PROBLEM IT SOLVES ──────────────────────────────────────────────────
 * A surface that shows nothing is showing one of three completely different
 * facts, and it renders all three identically:
 *
 *   1. you are not allowed in                    → denied
 *   2. you are allowed in, there is nothing here → empty
 *   3. you are allowed in, there IS something    → LYING
 *
 * (3) is the song desk: three pending song requests in the table, a vendor
 * entitled to see them, and an inbox that said "no requests yet" for the whole
 * 8-PR build. `fetchActSongRequests` still collapses (1) into (2) by design —
 * its header says so out loud: "Returns [] rather than throwing on a denied
 * gate". That is a reasonable choice for a venue-floor surface and a fatal one
 * for a health check, so the probe asks the gate SEPARATELY from the read and
 * hands both answers here.
 *
 * ── THE TRAP THIS FILE IS WRITTEN AGAINST ──────────────────────────────────
 * Half of the original defect was `eventTiles ? new Set(eventTiles) : null` —
 * an EMPTY ARRAY IS TRUTHY, so `[]` was treated as a real narrowing and matched
 * nothing. Every count that reaches `classify` is therefore a number, never an
 * array, and `permitted` is a boolean the caller had to state on purpose. There
 * is nothing here for truthiness to get wrong.
 */

/** @see the CHECK constraint on public.interconnection_probe_runs.verdict */
export type ProbeVerdict = 'ok' | 'empty' | 'lying' | 'denied' | 'error';

/**
 * What a probe observed. Deliberately three independent facts — a probe that
 * could only report a row count would reproduce the bug it exists to find.
 */
export type ProbeObservation = {
  /**
   * Did the gate let this reader in? Asked of the gate itself, NOT inferred
   * from an empty result. This is the whole point.
   */
  permitted: boolean;
  /** Rows the surface's own reader returned for this reader. */
  subjectCount: number;
  /** Rows service_role can see for the same question. The ground truth. */
  truthCount: number;
  /** Short, no PII. Surfaces verbatim in the admin console. */
  detail?: string;
};

export type ProbeResult = ProbeObservation & {
  probeKey: string;
  /** Ugat joint id (`J41`) when this probe watches a mapped joint. */
  jointId?: string;
  verdict: ProbeVerdict;
};

/**
 * Reduce an observation to a verdict.
 *
 * Order matters: the gate is asked first, because a denied reader's row count
 * carries no information at all — a surface that refused to run the query
 * returns 0 for reasons that have nothing to do with the data.
 */
export function classify(o: ProbeObservation): ProbeVerdict {
  if (!o.permitted) return 'denied';
  if (o.subjectCount > 0) return 'ok';
  // Permitted, saw nothing. The only question left is whether there was
  // anything TO see — and that is the difference between a quiet surface and a
  // broken one.
  return o.truthCount > 0 ? 'lying' : 'empty';
}

/**
 * The same question asked of a POPULATION rather than one reader.
 *
 * Some joints have no single subject: "can each booked vendor reach their
 * day-of desk" is asked of every booking at once. There, `subjectCount` is how
 * many members the surface can actually serve and `truthCount` is how many
 * exist — and the rule has to be stricter than {@link classify}, because a
 * joint that works for four vendors and fails for the fifth is broken. Feeding
 * that through `classify` would return `ok` on the strength of the four.
 *
 * So: anything less than everyone is `lying`. It is the same accusation —
 * these rows exist and this surface will not serve them — scoped to the members
 * it is true of rather than to the whole population.
 */
export function classifyPopulation(served: number, total: number): ProbeVerdict {
  if (total === 0) return 'empty';
  return served < total ? 'lying' : 'ok';
}

/**
 * The verdicts an operator has to act on.
 *
 * `denied` is in here and `empty` is not. A probe is configured with a reader
 * who is SUPPOSED to get in, so a denial is a real finding — it is what the
 * booked-but-locked-out vendor looked like from the outside. `empty` is a
 * pre-launch app being pre-launch, which is the normal state of this database
 * and must not be allowed to cry wolf.
 */
const FAULTS: ReadonlySet<ProbeVerdict> = new Set<ProbeVerdict>(['lying', 'denied', 'error']);

export function isFault(v: ProbeVerdict): boolean {
  return FAULTS.has(v);
}

/**
 * One line an operator can read without opening anything else. Kept in the
 * same file as the rule so a new verdict cannot be added without a phrasing
 * for it — the `satisfies` below is what enforces that at compile time.
 */
export const VERDICT_COPY = {
  ok: 'Carrying traffic',
  empty: 'Nothing to show yet',
  lying: 'Rows exist that this surface is hiding',
  denied: 'The gate refused a reader who should be allowed in',
  error: 'The probe itself failed to run',
} satisfies Record<ProbeVerdict, string>;
