/**
 * RA 10173 subject-export INTEGRITY helpers.
 *
 * Why this exists: `app/api/profile/export/route.ts` used to unwrap every
 * Supabase read as `res.data ?? []`. That collapses three very different
 * outcomes into one indistinguishable answer:
 *
 *   1. the subject genuinely has no rows,
 *   2. the query ERRORED, or
 *   3. the read could not be attempted at all.
 *
 * For an ordinary feature page that is a harmless shrug. For a data-subject
 * access response it is not: a file that says "you authored nothing" when the
 * subject authored twelve notes is a FALSE STATEMENT OF FACT to a data
 * subject, made under a law whose whole purpose is to prevent exactly that.
 * Silence is the failure mode RA 10173 §16 cannot tolerate.
 *
 * So: cases 2 and 3 stop being empty arrays and start being an explicit,
 * human-readable line in the export's own `not_included` list, plus a
 * top-level `export_complete: false`. The subject can SEE that a section
 * failed and come back for it.
 *
 * These helpers are deliberately pure and dependency-free so the export's
 * honesty is unit-testable — the route itself lives under `app/` and is never
 * collected by the `lib/**\/*.test.ts` suite.
 */

/** The shape both `supabase.from(...).select(...)` and `.maybeSingle()` settle to. */
export type QueryResultLike<T> = {
  data: T | null;
  error: { message?: string | null } | null;
};

export type ListOutcome<T> = {
  rows: T[];
  /** Non-null when the section is INCOMPLETE and the subject must be told. */
  incomplete: string | null;
};

export type SingleOutcome<T> = {
  row: T | null;
  incomplete: string | null;
};

/**
 * Normalise an error/absent reason to one short clause. Supabase error
 * messages can carry row content in a constraint echo, so we keep only the
 * message text and cap it — an export is not a debugging channel, and the
 * subject should never receive another party's data through an error string.
 */
function reasonOf(error: { message?: string | null } | null | undefined): string {
  const raw = (error?.message ?? '').toString().trim();
  if (!raw) return 'the database returned an error with no message';
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
}

/**
 * Unwrap a multi-row read.
 *
 * `res === null` means the read was NOT ATTEMPTED (e.g. the privileged client
 * needed to guarantee completeness could not be constructed). That is a
 * different failure from a query error, and the subject is told which.
 */
export function listOutcome<T>(
  section: string,
  // `data` is intentionally `unknown` rather than `T[]`: PostgREST types an
  // embedded select (`events(...)`) as `GenericStringError[]` against an
  // untyped schema, so a `T[]`-typed parameter would reject reads this route
  // has always made. The rows are cast at the use site, exactly as before —
  // only the error/absence handling is what this helper is load-bearing for.
  res: { data: unknown; error: { message?: string | null } | null } | null,
  notAttemptedReason?: string,
): ListOutcome<T> {
  if (res === null) {
    return {
      rows: [],
      incomplete:
        `${section} — NOT READ. ` +
        `${notAttemptedReason ?? 'This section could not be queried on this run.'} ` +
        'It is NOT a statement that you have no such records. Request this section from the DPO.',
    };
  }
  if (res.error) {
    return {
      rows: [],
      incomplete:
        `${section} — READ FAILED (${reasonOf(res.error)}). ` +
        'This section is INCOMPLETE and the empty result above must NOT be read as ' +
        '"you have no such records". Request this section from the DPO.',
    };
  }
  return { rows: (res.data as T[] | null) ?? [], incomplete: null };
}

/** Same contract for a `.maybeSingle()` read. */
export function singleOutcome<T>(
  section: string,
  res: QueryResultLike<T> | null,
  notAttemptedReason?: string,
): SingleOutcome<T> {
  const asList = listOutcome<T>(
    section,
    res === null ? null : { data: null, error: res.error },
    notAttemptedReason,
  );
  if (asList.incomplete) return { row: null, incomplete: asList.incomplete };
  return { row: res?.data ?? null, incomplete: null };
}

/**
 * Collect the non-null `incomplete` notices, preserving order.
 * Returns `[]` when every section read cleanly — which is what makes
 * `export_complete` a true assertion rather than a hopeful default.
 */
export function collectIncomplete(
  outcomes: Array<{ incomplete: string | null }>,
): string[] {
  return outcomes.map((o) => o.incomplete).filter((x): x is string => x !== null);
}
