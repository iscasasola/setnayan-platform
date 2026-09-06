/**
 * Shared vocabulary for the schema-drift check: the on-disk format of the
 * production snapshot, the differ, and the allow-list of divergences we have
 * looked at and accepted.
 *
 * Pure functions only — no PGlite, no network, no `fs`. That is deliberate: the
 * differ and the allow-list can then be unit-tested with synthetic inputs
 * (see the neutralisation section of `schema-drift.db.test.ts`) without booting
 * a database, which is how we prove the guard actually fails when it should.
 */

/** Where the committed production snapshot lives, relative to the repo root. */
export const SNAPSHOT_PATH_FROM_REPO_ROOT = 'supabase/security/prod-schema.snapshot.txt';

export type ProdSnapshot = {
  /** Every migration version prod's `schema_migrations` claims to have applied. */
  ledger: string[];
  /** Every `public` BASE TABLE column, as `table.column`, sorted. */
  columns: string[];
  /**
   * The subset of `columns` that production marks NOT NULL, sorted.
   *
   * A SEPARATE list rather than an annotation on `columns` so the existing
   * column diff, its allow-list keys and its pull-request diffs are untouched —
   * and so a reader can see at a glance which constraints prod enforces.
   */
  notnull: string[];
};

export type Divergence = {
  /**
   * DECLARED_NOT_IN_PROD — the migrations create this column but production
   * does not have it, even though prod's ledger says every one of those
   * migrations was applied. This is the dangerous direction: it is the exact
   * signature of a `CREATE TABLE IF NOT EXISTS` that silently no-opped.
   *
   * PROD_NOT_DECLARED — production has an object no migration in the ledger
   * creates. Applied out of band. Less immediately dangerous, but it means the
   * migrations are not a faithful record, and anything invisible to the record
   * is invisible to every other guard built on top of it.
   *
   * NOT_NULL_ONLY_IN_PROD — the column exists on both sides, but production
   * ENFORCES NOT NULL and the migrations do not. **This is the direction that
   * ships broken features.** Every db test runs against the replay, where the
   * constraint does not exist, so an INSERT that omits the column — or writes
   * an explicit NULL — passes the entire suite and then raises 23502 the first
   * time it runs for real. Twice on 2026-09-06: `comp_grants.granted_by` (a
   * SET NULL foreign key that would have made admin accounts undeletable) and
   * `comp_grants.user_id` (a vendor SKU comp writes `user_id: null` on purpose,
   * so the feature could not have been used once). Both were found by hand,
   * against production's catalog, because this guard compared column NAMES and
   * nothing else. That is why nullability is now part of the comparison.
   *
   * NOT_NULL_ONLY_DECLARED — the migrations enforce NOT NULL and production
   * does not. The tests are then STRICTER than reality: prod will accept a row
   * the suite rejects. Less likely to break a user, but the declaration is
   * still lying, and a future migration that trusts it (a SET NULL foreign key,
   * a backfill that assumes no nulls) is reasoning from a false premise.
   */
  kind:
    | 'DECLARED_NOT_IN_PROD'
    | 'PROD_NOT_DECLARED'
    | 'NOT_NULL_ONLY_IN_PROD'
    | 'NOT_NULL_ONLY_DECLARED';
  /** `table.column`. */
  key: string;
};

/* ── The allow-list ────────────────────────────────────────────────────────
 *
 * A RATCHET, not a wall: entries may be REMOVED freely (that is a fix), but the
 * count may never exceed KNOWN_GAP_CEILING, and an entry that no longer
 * corresponds to a real divergence fails the suite so the list cannot rot into
 * a pile of stale excuses.
 *
 * Every entry needs a reason a stranger can act on. "known issue" is not a
 * reason. If you cannot write down why it is acceptable, it is not acceptable.
 */
export const KNOWN_GAPS: ReadonlyMap<string, string> = new Map([
  /* ── prod objects created outside the migration flow ──────────────────────
   * Already documented in supabase/security/README.md ("Scope, honestly").
   * Back-filling declarations would bring them under this guard AND under the
   * exposure freeze; until then they are invisible to both. Left as gaps rather
   * than guessed at, because a wrong back-fill is itself a future no-op trap:
   * a `CREATE TABLE IF NOT EXISTS` whose body does not match the live table
   * lands in the ledger, does nothing, and looks applied forever. That is the
   * very bug this file exists to catch, so the back-fill has to be generated
   * from prod, not hand-written from memory.
   */
  ['event_service_deliveries.*', 'prod-only table, no migration creates it (applied out of band; see supabase/security/README.md)'],
  ['pioneer_incentive_logs.*', 'prod-only table, no migration creates it (applied out of band; see supabase/security/README.md)'],

  /* ── NOT NULL that production enforces and no migration declares ──────────
   * Both found by this guard's FIRST run with nullability enabled, on
   * 2026-09-06 — and one of them had already shipped a defect that morning,
   * which is the whole argument for the section existing.
   *
   * These are gaps, not approvals. The ratchet's dead-entry check removes them
   * the moment they stop being true, so neither can quietly outlive its reason.
   */
  [
    'comp_grants.user_id',
    "prod NOT NULL, migrations nullable. A vendor SKU comp writes `user_id: null` on purpose (it " +
      'targets a vendor, not a user), so this made that feature raise 23502 in prod while the whole ' +
      'db suite stayed green. PR #5246 adds `ALTER COLUMN user_id DROP NOT NULL`; REMOVE THIS ENTRY ' +
      'once that has deployed and the snapshot is refreshed — the direction is settled, only the ' +
      'deploy is outstanding.',
  ],
  [
    'comp_grants.rationale',
    'prod NOT NULL, migrations nullable — same out-of-band origin as user_id, but the direction is ' +
      'NOT settled and must not be guessed. Every application writer supplies a rationale, so prod ' +
      'is arguably right; but `the-public-numbers-keep-the-record.db.test.ts` inserts a comp_grants ' +
      'row without one, so declaring SET NOT NULL would break a shipped test, and that test may ' +
      'itself be asserting a shape prod would refuse. Needs a decision, not a sweep.',
  ],
]);

/** The allow-list may shrink, never grow past this. Lower it when you fix one. */
export const KNOWN_GAP_CEILING = 4;

/**
 * Anti-vacuity floors. A drift check that silently compares nothing is exactly
 * how the drift survived this long, so both sides must be demonstrably
 * substantial before any comparison is believed.
 */
export const MIN_TABLES = 300;
export const MIN_COLUMNS = 4000;
export const MIN_LEDGER = 900;
/**
 * Prod had 3,136 NOT NULL columns when this section was introduced. The floor
 * is deliberately far below that: it exists to catch a snapshot written with an
 * EMPTY or truncated `[notnull]` section, which would silently turn the
 * nullability half of this guard into a comparison against nothing — the exact
 * shape of failure the rest of this file is built to refuse.
 */
export const MIN_NOTNULL = 2500;

/** `public.foo.bar` / `foo.bar` → `foo`. */
export function tableOf(key: string): string {
  const i = key.indexOf('.');
  return i < 0 ? key : key.slice(0, i);
}

/** True when `key` is covered by an exact entry or by its table's `t.*` entry. */
export function isKnownGap(key: string, gaps: ReadonlyMap<string, string> = KNOWN_GAPS): boolean {
  return gaps.has(key) || gaps.has(`${tableOf(key)}.*`);
}

/**
 * Compare the migration-derived schema against production.
 *
 * THREE inputs, not two, and the third is what keeps this guard from crying
 * wolf on every schema pull request:
 *
 *   `declaredLedger` — replay of ONLY the migrations prod's ledger says it
 *                      applied. This is what prod SHOULD look like.
 *   `declaredAll`    — replay of EVERY migration in the repo, including ones
 *                      not yet applied (i.e. added by the open pull request).
 *   `prod`           — the committed snapshot of what prod ACTUALLY has.
 *
 * From those:
 *
 *   DECLARED_NOT_IN_PROD = (declaredLedger ∩ declaredAll) − prod
 *     "an applied migration created this, prod does not have it, AND no pending
 *      migration removes it." The intersection is the subtle half: if a pending
 *      migration DROPS the column, the fix is already in flight and re-reporting
 *      it would block the very pull request that repairs it.
 *
 *   PROD_NOT_DECLARED = prod − declaredAll − declaredLedger
 *     "prod has this and nothing in the repo creates it — not even a pending
 *      migration." Using `declaredAll` here means a pull request that back-fills
 *      an out-of-band column clears the finding immediately, which is the
 *      behaviour that makes fixing these feel worth doing.
 *
 *      ⚠ THE `− declaredLedger` TERM (added 2026-08-01) is the mirror of the
 *      intersection above, and it exists because this guard had an asymmetry: it
 *      excused a pending migration that ADDS a column, and a pending migration
 *      that drops a PHANTOM column, but NOT a pending migration that drops a
 *      REAL one. In that case prod legitimately still has the column (the
 *      migration has not been applied yet), it IS in the ledger (an applied
 *      migration created it, so the record is perfectly faithful), and it is
 *      absent from `declaredAll` only because the pending migration removes it.
 *      Reporting that as "nothing in the repo creates it" is simply false, and
 *      it red-lights every PR that retires a table — the first one being
 *      20271028225106 (retiring the per-USER Setnayan AI path).
 *
 *      The out-of-band case this guard exists for is untouched: a column applied
 *      straight to prod is in NEITHER set, so it still fires.
 *
 * A brand-new column added by a pending migration is in `declaredAll` but not
 * in `declaredLedger`, so it falls out of BOTH sets. That is the no-noise case,
 * and it is the reason this takes three inputs instead of two.
 *
 * Order-independent; the result is sorted so failures are stable across runs.
 */
export function diffSchema(
  declaredLedger: ReadonlySet<string>,
  declaredAll: ReadonlySet<string>,
  prod: ReadonlySet<string>,
): Divergence[] {
  const out: Divergence[] = [];
  for (const key of declaredLedger) {
    if (declaredAll.has(key) && !prod.has(key)) out.push({ kind: 'DECLARED_NOT_IN_PROD', key });
  }
  for (const key of prod) {
    // `!declaredLedger.has(key)` keeps a PENDING DROP quiet — see the docblock.
    if (!declaredAll.has(key) && !declaredLedger.has(key)) {
      out.push({ kind: 'PROD_NOT_DECLARED', key });
    }
  }
  out.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
  return out;
}

/**
 * Compare NOT NULL enforcement, with the same three inputs and the same
 * pending-migration logic as `diffSchema` — see its docblock for why the third
 * set is what stops this crying wolf on every schema pull request.
 *
 *   NOT_NULL_ONLY_IN_PROD  = prod − declaredAll − declaredLedger
 *     Prod enforces it and nothing in the repo does, not even a pending
 *     migration. The dangerous direction: the replay every db test runs against
 *     has no constraint to violate, so an INSERT omitting the column is green
 *     here and 23502 there.
 *
 *   NOT_NULL_ONLY_DECLARED = (declaredLedger ∩ declaredAll) − prod
 *     An APPLIED migration declares it, prod does not have it, and no pending
 *     migration removes it. The intersection keeps a pull request that
 *     deliberately drops a NOT NULL quiet while it is in flight.
 *
 * A pending migration that ADDS a NOT NULL is in `declaredAll` but not in
 * `declaredLedger`, so it falls out of both sets and stays silent until it is
 * actually applied — the same no-noise case `diffSchema` documents.
 *
 * ⚠ Only columns present on BOTH sides are compared. A column that exists on
 * one side only is already a `DECLARED_NOT_IN_PROD` / `PROD_NOT_DECLARED`
 * finding; reporting its nullability too would be the same defect counted
 * twice, and would bury the real one.
 */
export function diffNotNull(
  declaredLedgerNotNull: ReadonlySet<string>,
  declaredAllNotNull: ReadonlySet<string>,
  prodNotNull: ReadonlySet<string>,
  bothSidesHaveColumn: ReadonlySet<string>,
): Divergence[] {
  const out: Divergence[] = [];
  for (const key of prodNotNull) {
    if (!bothSidesHaveColumn.has(key)) continue;
    if (!declaredAllNotNull.has(key) && !declaredLedgerNotNull.has(key)) {
      out.push({ kind: 'NOT_NULL_ONLY_IN_PROD', key });
    }
  }
  for (const key of declaredLedgerNotNull) {
    if (!bothSidesHaveColumn.has(key)) continue;
    if (declaredAllNotNull.has(key) && !prodNotNull.has(key)) {
      out.push({ kind: 'NOT_NULL_ONLY_DECLARED', key });
    }
  }
  out.sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
  return out;
}

/** Divergences that are NOT covered by the allow-list — i.e. the failures. */
export function unexplained(
  divergences: readonly Divergence[],
  gaps: ReadonlyMap<string, string> = KNOWN_GAPS,
): Divergence[] {
  return divergences.filter((d) => !isKnownGap(d.key, gaps));
}

/* ── Snapshot file format ─────────────────────────────────────────────────
 * Two `[section]`-delimited sorted lists under a `#` comment header. Plain text
 * and line-oriented on purpose: the whole value of committing it is that a
 * human can read the diff in a pull request and see what changed.
 */

export function renderSnapshot(s: ProdSnapshot): string {
  const ledger = [...s.ledger].sort();
  const columns = [...s.columns].sort();
  const notnull = [...s.notnull].sort();
  const tables = new Set(columns.map(tableOf)).size;
  return (
    `# Setnayan PRODUCTION schema snapshot — public BASE TABLE columns.\n` +
    `#\n` +
    `# GENERATED, do not hand-edit. Refresh after applying migrations to prod:\n` +
    `#   pnpm --filter @setnayan/web schema:snapshot\n` +
    `#\n` +
    `# Read by apps/web/tests/db/schema-drift.db.test.ts, which replays ONLY the\n` +
    `# migrations in [ledger] below and asserts the result matches [columns]\n` +
    `# AND that the same columns are NOT NULL on both sides ([notnull]).\n` +
    `#\n` +
    `# ledger: ${ledger.length}\n` +
    `# tables: ${tables}\n` +
    `# columns: ${columns.length}\n` +
    `# notnull: ${notnull.length}\n` +
    `[ledger]\n` +
    ledger.join('\n') +
    `\n[columns]\n` +
    columns.join('\n') +
    `\n[notnull]\n` +
    notnull.join('\n') +
    `\n`
  );
}

export function parseSnapshot(text: string): ProdSnapshot {
  const ledger: string[] = [];
  const columns: string[] = [];
  const notnull: string[] = [];
  let section: 'none' | 'ledger' | 'columns' | 'notnull' = 'none';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === '[ledger]') {
      section = 'ledger';
      continue;
    }
    if (line === '[columns]') {
      section = 'columns';
      continue;
    }
    if (line === '[notnull]') {
      section = 'notnull';
      continue;
    }
    if (section === 'ledger') ledger.push(line);
    else if (section === 'columns') columns.push(line);
    else if (section === 'notnull') notnull.push(line);
    else throw new Error(`snapshot line outside any section: ${line}`);
  }
  return { ledger, columns, notnull };
}

/** The `# key: N` counts the file declares about itself, for tamper detection. */
export function declaredCounts(text: string): {
  ledger: number | null;
  tables: number | null;
  columns: number | null;
  notnull: number | null;
} {
  const read = (k: string): number | null => {
    const m = new RegExp(`^# ${k}: (\\d+)$`, 'm').exec(text);
    return m ? Number(m[1]) : null;
  };
  return {
    ledger: read('ledger'),
    tables: read('tables'),
    columns: read('columns'),
    notnull: read('notnull'),
  };
}

export function formatDriftReport(unexplainedDivergences: readonly Divergence[]): string {
  const declared = unexplainedDivergences.filter((d) => d.kind === 'DECLARED_NOT_IN_PROD');
  const prodOnly = unexplainedDivergences.filter((d) => d.kind === 'PROD_NOT_DECLARED');
  const lines: string[] = ['', 'SCHEMA DRIFT — the migrations and production disagree.', ''];

  if (declared.length > 0) {
    lines.push(
      `  ${declared.length} column(s) the migrations CREATE but production does NOT have,`,
      `  even though prod's ledger says every one of those migrations was applied:`,
      '',
      ...declared.map((d) => `      · ${d.key}`),
      '',
      '  This is the signature of a `CREATE TABLE IF NOT EXISTS` that silently',
      '  no-opped against an already-existing table of a different shape. The',
      '  statement succeeded, `db push` reported success, and the version was',
      '  written to schema_migrations — so nothing anywhere went red.',
      '',
      '  Fix the SCHEMA (a new migration using ALTER TABLE ... ADD COLUMN IF NOT',
      '  EXISTS), or fix the DECLARATION if the design was never actually built.',
      '  Do not add columns purely to quieten this — an unused half-feature is',
      '  worse than an honest allow-list entry.',
      '',
    );
  }

  if (prodOnly.length > 0) {
    lines.push(
      `  ${prodOnly.length} column(s) production HAS that no migration in the ledger creates:`,
      '',
      ...prodOnly.map((d) => `      · ${d.key}`),
      '',
      '  Applied out of band. Back-fill a migration so the record is faithful.',
      '',
    );
  }

  const nnProd = unexplainedDivergences.filter((d) => d.kind === 'NOT_NULL_ONLY_IN_PROD');
  const nnDecl = unexplainedDivergences.filter((d) => d.kind === 'NOT_NULL_ONLY_DECLARED');

  if (nnProd.length > 0) {
    lines.push(
      `  ${nnProd.length} column(s) production enforces NOT NULL that the migrations do NOT:`,
      '',
      ...nnProd.map((d) => `      · ${d.key}`),
      '',
      '  🛑 THIS IS THE DIRECTION THAT SHIPS BROKEN FEATURES. Every db test runs',
      '  against the replay, which has no such constraint — so an INSERT that',
      '  omits one of these columns, or writes an explicit NULL into it, passes',
      '  the whole suite here and raises 23502 the first time it runs for real.',
      '  A green test is not evidence about these columns.',
      '',
      '  Decide the direction per column; there is no sweep that is right for all:',
      '    · the constraint is CORRECT → add `ALTER COLUMN … SET NOT NULL` so the',
      '      declaration says what prod enforces (check no test inserts without it);',
      '    · the constraint is the ACCIDENT → add `ALTER COLUMN … DROP NOT NULL`,',
      '      which is a no-op in the replay and the whole fix in production.',
      '',
    );
  }

  if (nnDecl.length > 0) {
    lines.push(
      `  ${nnDecl.length} column(s) the migrations mark NOT NULL that production does NOT:`,
      '',
      ...nnDecl.map((d) => `      · ${d.key}`),
      '',
      '  The suite is STRICTER than reality: prod accepts rows these tests reject.',
      '  Nobody is broken today, but the declaration is lying, and a later',
      '  migration that trusts it — a SET NULL foreign key, a backfill assuming',
      '  no nulls — is reasoning from a false premise.',
      '',
      '  Usually this means the migration was applied to prod but the snapshot is',
      '  stale. Refresh it before treating it as drift.',
      '',
    );
  }

  lines.push(
    '  If a divergence is genuinely expected, add it to KNOWN_GAPS in',
    '  apps/web/tests/db/schema-snapshot.ts WITH A REASON, and raise',
    '  KNOWN_GAP_CEILING deliberately in the same commit.',
    '',
    '  If instead this fired because prod moved and the snapshot did not, refresh it:',
    '      pnpm --filter @setnayan/web schema:snapshot',
    '',
  );
  return lines.join('\n');
}
