/**
 * lib/ugat/schema-claims.ts — machine-checkable assertions about the schema
 * that the Ugat joint registry describes in prose.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * `lib/ugat/graph.ts` documents how the platform's entities are bonded: which
 * table implements a joint, which column carries it, which RLS helper guards
 * it, and — the genuinely valuable part — which of them are TRAPS. That prose
 * is hand-written on purpose. Foreign keys cannot express "this column is
 * named vendor_id but holds the BOOKING id", or "ON DELETE SET NULL silently
 * orphans instead of failing". Deriving the whole registry from `pg_constraint`
 * would produce a technically-correct map that had lost everything worth
 * reading.
 *
 * But hand-written prose rots, silently, and this registry proved it. The
 * 2026-07-30 re-audit found THREE separate references to columns that do not
 * exist anywhere in the 1,002 migrations — `events.qr_revoked_at`,
 * `payment_inbox_messages`, `order_ledger_entries`. Each had looked
 * authoritative for weeks. Nothing failed, because nothing was checking.
 *
 * So: keep the prose, and make every STRUCTURAL sentence inside it a claim the
 * database itself can refute. A joint may say whatever it likes about meaning;
 * it may not lie about what exists.
 *
 * ── WHY CLAIMS AND NOT FULL DERIVATION ─────────────────────────────────────
 * A derived-edge generator answers "what bonds exist". This answers the harder
 * question: "is the thing we WROTE DOWN still true". The two are complementary
 * — derivation catches a bond nobody documented; claims catch documentation
 * that outlived its schema. This module is the second one.
 *
 * ── PURITY ─────────────────────────────────────────────────────────────────
 * Deliberately free of PGlite, `fs`, and any database driver, mirroring
 * `tests/db/schema-snapshot.ts`. Verification is a pure function over an
 * introspection snapshot, so the interesting cases — including every way a
 * claim SHOULD fail — are unit-testable under `tsx --test` with a synthetic
 * schema and no 6-second replay.
 */

/**
 * One structural assertion a joint makes about the database.
 *
 * `no_column` and `no_fk` are as load-bearing as their positive twins: several
 * joints exist precisely to warn that an expected bond is ABSENT (guests has no
 * user_id; vendor_services.category has no FK). If those annotations were not
 * checked, the day someone finally adds the FK the registry would keep warning
 * about a trap that no longer exists — stale in the opposite direction, and
 * exactly as misleading.
 */
export type UgatSchemaClaim =
  | { kind: 'table'; table: string }
  | { kind: 'column'; table: string; column: string }
  | { kind: 'no_column'; table: string; column: string }
  | { kind: 'fk'; table: string; column: string; references: string }
  | { kind: 'no_fk'; table: string; column: string }
  | { kind: 'unique'; table: string; columns: string[] };

/**
 * A schema, reduced to the three shapes claims care about.
 *
 * Produced from `pg_constraint` / `pg_attribute` against the migration replay
 * (see `tests/db/ugat-schema-claims.db.test.ts`), or hand-built in unit tests.
 */
export interface UgatIntrospection {
  /** `table.column` */
  columns: ReadonlySet<string>;
  /** `table.column->referencedTable` */
  fks: ReadonlySet<string>;
  /** `table(col1,col2)` with columns SORTED — see uniqueKey(). */
  uniques: ReadonlySet<string>;
}

export interface UgatClaimFailure {
  /** The joint (or node) id that made the claim. */
  ownerId: string;
  claim: UgatSchemaClaim;
  detail: string;
}

/** Canonical key for a UNIQUE constraint. Columns are sorted so that a claim
 *  written (event_id, user_id) matches a constraint declared (user_id, event_id). */
export function uniqueKey(table: string, columns: readonly string[]): string {
  return `${table}(${[...columns].sort().join(',')})`;
}

export function columnKey(table: string, column: string): string {
  return `${table}.${column}`;
}

export function fkKey(table: string, column: string, references: string): string {
  return `${table}.${column}->${references}`;
}

/** Every table a claim touches — used by the db test's anti-vacuity floor. */
export function claimedTables(
  owners: ReadonlyArray<{ ownerId: string; claims: readonly UgatSchemaClaim[] }>,
): Set<string> {
  const out = new Set<string>();
  for (const o of owners) for (const c of o.claims) out.add(c.table);
  return out;
}

/**
 * Check every claim against an introspection. Returns ALL failures, never
 * throwing on the first — one stale joint should not hide the other four.
 */
export function verifyUgatClaims(
  owners: ReadonlyArray<{ ownerId: string; claims: readonly UgatSchemaClaim[] }>,
  intro: UgatIntrospection,
): UgatClaimFailure[] {
  const failures: UgatClaimFailure[] = [];

  // A table "exists" if the introspection knows any column on it. Introspection
  // is column-derived, so there is no separate table list to consult.
  const tablesSeen = new Set<string>();
  for (const key of intro.columns) {
    const dot = key.indexOf('.');
    if (dot > 0) tablesSeen.add(key.slice(0, dot));
  }

  const fail = (ownerId: string, claim: UgatSchemaClaim, detail: string) =>
    failures.push({ ownerId, claim, detail });

  for (const { ownerId, claims } of owners) {
    for (const claim of claims) {
      switch (claim.kind) {
        case 'table':
          if (!tablesSeen.has(claim.table)) {
            fail(ownerId, claim, `table "${claim.table}" does not exist`);
          }
          break;

        case 'column':
          if (!intro.columns.has(columnKey(claim.table, claim.column))) {
            fail(
              ownerId,
              claim,
              tablesSeen.has(claim.table)
                ? `column "${claim.table}.${claim.column}" does not exist`
                : `table "${claim.table}" does not exist (so its column cannot)`,
            );
          }
          break;

        case 'no_column':
          // The table must exist for its ABSENT column to mean anything —
          // otherwise a dropped table would make every no_column claim on it
          // "pass", which is a vacuous green.
          if (!tablesSeen.has(claim.table)) {
            fail(ownerId, claim, `table "${claim.table}" does not exist — claim is vacuous`);
          } else if (intro.columns.has(columnKey(claim.table, claim.column))) {
            fail(
              ownerId,
              claim,
              `column "${claim.table}.${claim.column}" NOW EXISTS — the documented absence is stale, update the joint`,
            );
          }
          break;

        case 'fk':
          if (!intro.fks.has(fkKey(claim.table, claim.column, claim.references))) {
            fail(
              ownerId,
              claim,
              `no FK "${claim.table}.${claim.column}" → "${claim.references}"`,
            );
          }
          break;

        case 'no_fk': {
          if (!tablesSeen.has(claim.table)) {
            fail(ownerId, claim, `table "${claim.table}" does not exist — claim is vacuous`);
            break;
          }
          if (!intro.columns.has(columnKey(claim.table, claim.column))) {
            fail(
              ownerId,
              claim,
              `column "${claim.table}.${claim.column}" does not exist — claim is vacuous`,
            );
            break;
          }
          const prefix = `${claim.table}.${claim.column}->`;
          for (const key of intro.fks) {
            if (key.startsWith(prefix)) {
              fail(
                ownerId,
                claim,
                `"${claim.table}.${claim.column}" NOW HAS an FK (${key}) — the documented trap is RESOLVED, delete the annotation`,
              );
              break;
            }
          }
          break;
        }

        case 'unique':
          if (!intro.uniques.has(uniqueKey(claim.table, claim.columns))) {
            fail(
              ownerId,
              claim,
              `no UNIQUE on ${uniqueKey(claim.table, claim.columns)}`,
            );
          }
          break;
      }
    }
  }

  return failures;
}

/** Human-readable failure report, pointing at BOTH possible fixes. */
export function formatClaimFailures(failures: readonly UgatClaimFailure[]): string {
  if (failures.length === 0) return 'All Ugat schema claims hold.';
  const lines = failures.map(
    (f) => `  · ${f.ownerId} [${f.claim.kind}] ${f.detail}`,
  );
  return [
    `${failures.length} Ugat schema claim(s) no longer hold:`,
    ...lines,
    '',
    'The registry in lib/ugat/graph.ts describes a schema that has moved.',
    'Either the joint prose is stale (fix graph.ts) or a migration is missing',
    '(write it). Do NOT delete the claim to make this pass — an unclaimed joint',
    'is exactly the loophole that let three phantom columns sit in the registry',
    'for 25 days.',
  ].join('\n');
}
