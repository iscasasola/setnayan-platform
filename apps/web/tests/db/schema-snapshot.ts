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
   */
  kind: 'DECLARED_NOT_IN_PROD' | 'PROD_NOT_DECLARED';
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
]);

/** The allow-list may shrink, never grow past this. Lower it when you fix one. */
export const KNOWN_GAP_CEILING = 2;

/**
 * Anti-vacuity floors. A drift check that silently compares nothing is exactly
 * how the drift survived this long, so both sides must be demonstrably
 * substantial before any comparison is believed.
 */
export const MIN_TABLES = 300;
export const MIN_COLUMNS = 4000;
export const MIN_LEDGER = 900;

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
 *   PROD_NOT_DECLARED = prod − declaredAll
 *     "prod has this and nothing in the repo creates it — not even a pending
 *      migration." Using `declaredAll` here means a pull request that back-fills
 *      an out-of-band column clears the finding immediately, which is the
 *      behaviour that makes fixing these feel worth doing.
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
    if (!declaredAll.has(key)) out.push({ kind: 'PROD_NOT_DECLARED', key });
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
  const tables = new Set(columns.map(tableOf)).size;
  return (
    `# Setnayan PRODUCTION schema snapshot — public BASE TABLE columns.\n` +
    `#\n` +
    `# GENERATED, do not hand-edit. Refresh after applying migrations to prod:\n` +
    `#   pnpm --filter @setnayan/web schema:snapshot\n` +
    `#\n` +
    `# Read by apps/web/tests/db/schema-drift.db.test.ts, which replays ONLY the\n` +
    `# migrations in [ledger] below and asserts the result matches [columns].\n` +
    `#\n` +
    `# ledger: ${ledger.length}\n` +
    `# tables: ${tables}\n` +
    `# columns: ${columns.length}\n` +
    `[ledger]\n` +
    ledger.join('\n') +
    `\n[columns]\n` +
    columns.join('\n') +
    `\n`
  );
}

export function parseSnapshot(text: string): ProdSnapshot {
  const ledger: string[] = [];
  const columns: string[] = [];
  let section: 'none' | 'ledger' | 'columns' = 'none';
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
    if (section === 'ledger') ledger.push(line);
    else if (section === 'columns') columns.push(line);
    else throw new Error(`snapshot line outside any section: ${line}`);
  }
  return { ledger, columns };
}

/** The `# key: N` counts the file declares about itself, for tamper detection. */
export function declaredCounts(text: string): { ledger: number | null; tables: number | null; columns: number | null } {
  const read = (k: string): number | null => {
    const m = new RegExp(`^# ${k}: (\\d+)$`, 'm').exec(text);
    return m ? Number(m[1]) : null;
  };
  return { ledger: read('ledger'), tables: read('tables'), columns: read('columns') };
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
