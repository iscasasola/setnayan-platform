/**
 * THE STAGING MIGRATION APPLY — its pure core: the target guard, the plan, the ledger, and the run itself behind a
 * one-method `SqlClient`, so the CI proof drives the SAME run over PGlite that `apply-migrations.ts` drives over `pg`.
 *
 * WHY THIS EXISTS (measured 25 Nov 2026). A Supabase preview branch applies `supabase/migrations` strictly in version
 * order. The `final-check` branch applied 116 files and stopped on `20260530010000_iteration_0006_v2_1_amendment_2.sql`
 * (`relation "public.vendor_billing_catalog" does not exist`): that table is created later, by `20260631000000`.
 * Production applied each file once, in merge order, so it never met this. `supabase db push --include-all` is also
 * version order and stops at the same file. The repo already has the order that works — the replay's drain
 * (`replayInFilenameOrder`, apps/web/tests/db/migration-order.ts): a file that fails is rolled back and retried
 * after every later file that succeeds, so it lands at the EARLIEST point it can and every higher-numbered file still
 * runs after it. This file only wires a real database to that engine. It decides no order of its own.
 *
 * HOW EACH FILE RUNS
 *   · In its own transaction: the file and its ledger row go to Postgres as ONE simple query, which Postgres runs as
 *     one implicit transaction — the same way the Supabase CLI's batch and the PGlite replay run a file. A failure
 *     rolls the whole file back (a file that writes its own BEGIN/COMMIT is atomic as far as its own blocks go — as in
 *     the CLI and the replay), and the engine retries it after the next file that succeeds.
 *   · BARE, when Postgres refuses it inside a transaction: SQLSTATE 25001 (`CREATE INDEX CONCURRENTLY` and kin) or
 *     55P04 (an enum value added and used in one transaction). Postgres decides, not a guess: the file is re-run one
 *     statement at a time, autocommit. A bare file cannot roll back, so a failure remembers where it stopped (the
 *     statement, or the BEGIN of the file's own block it failed inside) and the retry resumes there.
 *     `ALTER TYPE … ADD VALUE` on its own is NOT bare: Postgres 12+ allows it in a transaction, and the replay applies
 *     all of this corpus's ADD VALUE files transactionally on every pull request.
 *   · The engine is given NO probe (`ApplyPort.isStillMissing`), which it defines as the safe default: every deferred
 *     file is retried after every successful apply. The replay may skip retries because it can throw a database away
 *     and rebuild; a branch cannot be rebuilt, so it pays the full drain (a few minutes) and never trades order.
 *   · A transient failure (lock timeout, deadlock, serialisation, cancel) is retried IN PLACE, never deferred — a
 *     deferral would move the file. A lost connection stops the run; the ledger holds every file applied, so the
 *     next run resumes where this one stopped.
 *
 * THE LEDGER is `supabase_migrations.schema_migrations`, created if missing with the Supabase CLI's own statements
 * (`version`, `statements`, `name`). Every applied file writes its row in the same transaction as its SQL. A file in
 * `ALLOWED_SKIP` that never applies is recorded too — production's ledger holds it, and the release rehearsal
 * (apps/web/tests/rehearsal/apply-migrations.mts) records it the same way — and is listed as skipped.
 *
 * No I/O here beyond the `SqlClient` handed in. Unit-tested in apps/web/lib/staging-apply-migrations.test.ts; the
 * real corpus runs through `applyPendingMigrations` over PGlite in
 * apps/web/tests/db/the-staging-migration-apply-matches-the-replay.db.test.ts.
 */
import {
  ALLOWED_SKIP,
  EXPECTED_OUT_OF_ORDER,
  OWNER_EMAIL,
  OWNER_FILE,
  OWNER_UUID,
  replayInFilenameOrder,
  versionOf,
  type OutOfOrderApplication,
} from '../../apps/web/tests/db/migration-order';
import { PRODUCTION_SUPABASE_REF, sqlLiteral, stagingTarget, supabaseRefOf } from './seed-core';

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 1 · THE TARGET
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ApplyTarget = { ok: true; ref: string | null; local: boolean } | { ok: false; why: string };

/**
 * ⛔ May this script write migrations to `dbUrl`? Only when:
 *   · the URL does not contain production's ref ANYWHERE (checked on the raw text, before any parsing);
 *   · `STAGING` is exactly `1`, and the URL names a Supabase project that is not production, or this machine
 *     (`stagingTarget`, the same rule the seed and the catalogue copy obey);
 *   · it is not the transaction pooler (port 6543): a migration run needs one session from start to finish.
 */
export function applyTarget(input: { staging: string | undefined; dbUrl: string }): ApplyTarget {
  const raw = input.dbUrl.trim();
  if (!raw) return { ok: false, why: 'STAGING_DB_URL is not set' };
  if (raw.toLowerCase().includes(PRODUCTION_SUPABASE_REF)) {
    return { ok: false, why: `the database URL contains PRODUCTION's ref (${PRODUCTION_SUPABASE_REF}) — this script never writes there` };
  }
  const t = stagingTarget({ staging: input.staging, dbUrl: raw });
  if (!t.ok) return t;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, why: 'the database URL is not a URL' };
  }
  if (/\.pooler\.supabase\.com$/i.test(u.hostname) && u.port === '6543') {
    return { ok: false, why: 'that is the TRANSACTION pooler (port 6543) — use the session pooler (port 5432) or the direct connection' };
  }
  return { ok: true, ref: t.ref ?? supabaseRefOf(raw), local: t.local };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 2 · THE LEDGER — the Supabase CLI's own statements (pkg/migration/history.go)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const LEDGER = 'supabase_migrations.schema_migrations';

export const LEDGER_DDL = [
  'CREATE SCHEMA IF NOT EXISTS supabase_migrations',
  `CREATE TABLE IF NOT EXISTS ${LEDGER} (version text NOT NULL PRIMARY KEY)`,
  `ALTER TABLE ${LEDGER} ADD COLUMN IF NOT EXISTS statements text[]`,
  `ALTER TABLE ${LEDGER} ADD COLUMN IF NOT EXISTS name text`,
].join(';\n');

/** Read-only: is there a ledger, and what does it hold? Two statements, both reads. */
export const LEDGER_EXISTS_SQL = `SELECT to_regclass('${LEDGER}') IS NOT NULL AS present`;
export const LEDGER_READ_SQL = `SELECT version, coalesce(name, '') AS name FROM ${LEDGER} ORDER BY version`;

/** `20260530010000_iteration_0006_v2_1_amendment_2.sql` → `iteration_0006_v2_1_amendment_2` (the CLI's rule). */
export function migrationName(file: string): string {
  const m = /^([0-9]+)_(.*)\.sql$/.exec(file);
  return m ? m[2]! : file.replace(/\.sql$/, '');
}

function textArrayLiteral(items: readonly string[]): string {
  return items.length === 0 ? `'{}'::text[]` : `ARRAY[${items.map(sqlLiteral).join(', ')}]::text[]`;
}

/** The ledger row for one file. A plain INSERT, as the CLI writes it: a second row for one version is an error. */
export function ledgerInsertSql(file: string, statements: readonly string[]): string {
  return (
    `INSERT INTO ${LEDGER} (version, name, statements) ` +
    `VALUES (${sqlLiteral(versionOf(file))}, ${sqlLiteral(migrationName(file))}, ${textArrayLiteral(statements)})`
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 3 · THE OWNER PRECONDITION — the same one the replay and the rehearsal seed (migration-order.ts `OWNER_*`)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A stand-in owner sign-in, so `OWNER_FILE` (which RAISEs without one) applies as it did in production. Idempotent. */
export const OWNER_PRECONDITION_SQL = `
DO $owner$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'instance_id') THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (${sqlLiteral(OWNER_UUID)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${sqlLiteral(OWNER_EMAIL)})
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO auth.users (id, email) VALUES (${sqlLiteral(OWNER_UUID)}, ${sqlLiteral(OWNER_EMAIL)}) ON CONFLICT DO NOTHING;
  END IF;
END
$owner$`;

/** Run just before `OWNER_FILE`, in its transaction: re-insert him so the real trigger provisions his profile row. */
export const OWNER_REINSERT_SQL = `DELETE FROM auth.users WHERE email = ${sqlLiteral(OWNER_EMAIL)};\n${OWNER_PRECONDITION_SQL}`;

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 4 · STATEMENTS — for the ledger's `statements` column and for a bare run
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const IDENT = /[A-Za-z0-9_$\u0080-￿]/;

/**
 * Split SQL into top-level statements on `;`, never inside a comment (`--`, nested block comments), a string
 * ('', E'' with backslash escapes), a quoted identifier, or a dollar-quoted body ($$ … $$, $tag$ … $tag$).
 * Comment-only pieces are dropped. ⚠ SQL-standard `BEGIN ATOMIC … END` bodies are not recognised (this corpus has
 * none); a bare run of such a file would fail loudly at the split, never silently.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let start = 0;
  let hasCode = false;
  let i = 0;
  const n = sql.length;
  const push = (end: number) => {
    if (hasCode) out.push(sql.slice(start, end).trim());
    start = end + 1;
    hasCode = false;
  };
  while (i < n) {
    const c = sql[i]!;
    const next = sql[i + 1];
    if (c === '-' && next === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (c === '/' && next === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') (depth++, (i += 2));
        else if (sql[i] === '*' && sql[i + 1] === '/') (depth--, (i += 2));
        else i++;
      }
      continue;
    }
    if (c === ';') {
      push(i);
      i++;
      continue;
    }
    if (!/\s/.test(c)) hasCode = true;
    const prevIsIdent = i > 0 && IDENT.test(sql[i - 1]!);
    if (c === "'") {
      const escapes = i > 0 && /[eE]/.test(sql[i - 1]!) && !(i > 1 && IDENT.test(sql[i - 2]!));
      i++;
      while (i < n) {
        if (escapes && sql[i] === '\\') i += 2;
        else if (sql[i] === "'" && sql[i + 1] === "'") i += 2;
        else if (sql[i] === "'") break;
        else i++;
      }
      i++;
      continue;
    }
    if (c === '"') {
      i++;
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') i += 2;
        else if (sql[i] === '"') break;
        else i++;
      }
      i++;
      continue;
    }
    if (c === '$' && !prevIsIdent) {
      const tag = /^\$(?:[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/.exec(sql.slice(i, i + 64));
      if (tag) {
        const close = sql.indexOf(tag[0], i + tag[0].length);
        i = close === -1 ? n : close + tag[0].length;
        continue;
      }
    }
    i++;
  }
  push(n);
  return out;
}

/** The first keyword of a statement, past any leading comments. */
export function leadingKeyword(stmt: string): string {
  const s = stmt.replace(/^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '');
  return (/^[A-Za-z]+/.exec(s)?.[0] ?? '').toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 5 · THE PLAN — what the ledger already holds, what is left, what to expect
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type LedgerRow = { version: string; name: string };

export type MigrationPlan = {
  total: number;
  /** Files whose version the ledger already holds — never touched again. */
  alreadyApplied: string[];
  /** Files to apply, in version order (the engine decides the real order). */
  pending: string[];
  /** Ledger versions with no file in this checkout (the branch is ahead of it, or a file was renamed). */
  ledgerOnly: string[];
  /** Ledger version matches a file but the recorded name differs. */
  nameMismatch: Array<{ file: string; ledgerName: string }>;
  /** Pending files the replay lands out of order, and where (EXPECTED_OUT_OF_ORDER). */
  expectedOutOfOrder: Array<{ file: string; landsAfter: string }>;
  /** Pending files that may never apply from a fresh database, and why (ALLOWED_SKIP). */
  mayBeSkipped: Array<{ file: string; reason: string }>;
  /** Whether the run will seed the stand-in owner sign-in first. */
  ownerPrecondition: boolean;
};

export function planMigrations(files: readonly string[], ledger: readonly LedgerRow[]): MigrationPlan {
  const sorted = [...files].filter((f) => f.endsWith('.sql')).sort();
  const held = new Map(ledger.map((r) => [r.version, r.name] as const));
  const byVersion = new Map(sorted.map((f) => [versionOf(f), f] as const));
  const alreadyApplied = sorted.filter((f) => held.has(versionOf(f)));
  const pending = sorted.filter((f) => !held.has(versionOf(f)));
  const pendingSet = new Set(pending);
  return {
    total: sorted.length,
    alreadyApplied,
    pending,
    ledgerOnly: [...held.keys()].filter((v) => !byVersion.has(v)).sort(),
    nameMismatch: alreadyApplied
      .filter((f) => held.get(versionOf(f)) !== '' && held.get(versionOf(f)) !== migrationName(f))
      .map((f) => ({ file: f, ledgerName: held.get(versionOf(f))! })),
    expectedOutOfOrder: Object.entries(EXPECTED_OUT_OF_ORDER)
      .filter(([f]) => pendingSet.has(f))
      .map(([file, landsAfter]) => ({ file, landsAfter })),
    mayBeSkipped: [...ALLOWED_SKIP].filter(([f]) => pendingSet.has(f)).map(([file, reason]) => ({ file, reason })),
    ownerPrecondition: pending.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 6 · THE RUN
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The one thing the run needs from a database: a query. With no params it is a simple (multi-statement) query. */
export type SqlClient = {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

/** Session settings for the run: migrations may be slow, and nothing else holds locks on a fresh branch. */
export const SESSION_SQL = `SET statement_timeout = 0;\nSET lock_timeout = '60s';\nSET idle_in_transaction_session_timeout = 0`;

/** Postgres refuses the file inside a transaction block → run it bare. */
export const NEEDS_BARE: ReadonlySet<string> = new Set(['25001', '55P04']);
/** Worth one more try in place: lock_not_available, deadlock, serialisation, query_canceled. */
export const TRANSIENT: ReadonlySet<string> = new Set(['55P03', '40P01', '40001', '57014']);
const IN_PLACE_TRIES = 3;

/** The SQLSTATE of a database error, or null for anything that is not one (a dropped connection, a bug). */
export function sqlStateOf(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : null;
}

function firstLine(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.split('\n')[0] ?? msg;
}

/** Thrown out of the run when it must stop rather than defer (a lost connection, a transient error that stayed). */
export class StopRun extends Error {
  constructor(
    readonly file: string,
    readonly error: unknown,
  ) {
    super(`stopped at ${file}: ${firstLine(error)}`);
  }
}

export type ApplyEvent =
  | { kind: 'applied'; file: string; count: number; of: number; bare: boolean }
  | { kind: 'deferred'; file: string; error: string }
  | { kind: 'bare'; file: string; code: string }
  | { kind: 'retry-in-place'; file: string; code: string; attempt: number };

export type ApplyReport = {
  plan: MigrationPlan;
  /** Every file this run applied, in the order it applied them. */
  applied: string[];
  /** The subset that ran bare (statement by statement). */
  bare: string[];
  /** Files that never applied and are NOT in ALLOWED_SKIP, with the last error. Empty is the only clean result. */
  stillFailing: Array<{ file: string; error: string }>;
  /** ALLOWED_SKIP files that never applied — recorded in the ledger, as production's ledger holds them. */
  skipped: Array<{ file: string; reason: string; error: string }>;
  /** Every out-of-order landing the engine made. */
  outOfOrder: OutOfOrderApplication[];
  /** Landings that differ from the replay's pinned list (EXPECTED_OUT_OF_ORDER) — a real branch diverged. */
  unexpectedOutOfOrder: OutOfOrderApplication[];
  /** pg_cron jobs on the database after the run (null when there is no cron schema). */
  cron: { total: number; active: number } | null;
};

export type ApplyRunInput = {
  client: SqlClient;
  /** Every migration filename in the checkout. */
  files: readonly string[];
  readFile(file: string): string;
  onEvent?(e: ApplyEvent): void;
  /** Pause between in-place retries (tests pass 0). */
  retryDelayMs?: number;
};

async function readLedger(client: SqlClient): Promise<LedgerRow[]> {
  const present = (await client.query(LEDGER_EXISTS_SQL)).rows[0]?.present === true;
  if (!present) return [];
  return (await client.query(LEDGER_READ_SQL)).rows.map((r) => ({ version: String(r.version), name: String(r.name ?? '') }));
}

/** Read the ledger and plan, inside a READ ONLY transaction — what `--dry-run` runs. Writes nothing. */
export async function readPlan(client: SqlClient, files: readonly string[]): Promise<{ plan: MigrationPlan; ownerPresent: boolean | null }> {
  await client.query('BEGIN TRANSACTION READ ONLY');
  try {
    const ledger = await readLedger(client);
    let ownerPresent: boolean | null = null;
    if ((await client.query(`SELECT to_regclass('auth.users') IS NOT NULL AS present`)).rows[0]?.present === true) {
      ownerPresent =
        (await client.query('SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower($1)) AS present', [OWNER_EMAIL]))
          .rows[0]?.present === true;
    }
    return { plan: planMigrations(files, ledger), ownerPresent };
  } finally {
    await client.query('ROLLBACK');
  }
}

/**
 * Apply every migration the ledger does not hold, through the replay's ordering engine. Throws `StopRun` when it
 * must stop (the ledger keeps what was applied; run again to resume).
 */
export async function applyPendingMigrations(input: ApplyRunInput): Promise<ApplyReport> {
  const { client, readFile, onEvent } = input;
  const delay = input.retryDelayMs ?? 2000;

  await client.query(SESSION_SQL);
  await client.query(LEDGER_DDL);
  const plan = planMigrations(input.files, await readLedger(client));
  const empty: ApplyReport = { plan, applied: [], bare: [], stillFailing: [], skipped: [], outOfOrder: [], unexpectedOutOfOrder: [], cron: null };
  if (plan.pending.length === 0) return { ...empty, cron: await readCron(client) };
  if (plan.ownerPrecondition) await client.query(OWNER_PRECONDITION_SQL);

  const applied: string[] = [];
  const bare: string[] = [];
  const reported = new Set<string>();
  const statementsCache = new Map<string, string[]>();
  /** Bare files that stopped part-way: the statement to resume at. */
  const resumeAt = new Map<string, number>();
  let stop: StopRun | null = null;

  const statementsOf = (f: string): string[] => {
    let s = statementsCache.get(f);
    if (!s) statementsCache.set(f, (s = splitStatements(readFile(f))));
    return s;
  };
  const done = (f: string, wasBare: boolean) => {
    applied.push(f);
    if (wasBare) bare.push(f);
    onEvent?.({ kind: 'applied', file: f, count: applied.length, of: plan.pending.length, bare: wasBare });
  };

  async function runBare(f: string, from: number): Promise<void> {
    const prefix = f === OWNER_FILE ? splitStatements(OWNER_REINSERT_SQL) : [];
    const own = statementsOf(f);
    const all = [...prefix, ...own];
    let blockStart: number | null = null;
    for (let i = from; i < all.length; i++) {
      const kw = leadingKeyword(all[i]!);
      if (kw === 'begin' || kw === 'start') blockStart = i;
      try {
        await client.query(all[i]!);
      } catch (e) {
        resumeAt.set(f, blockStart ?? i);
        if (sqlStateOf(e) === null) stop = new StopRun(f, e);
        throw e;
      }
      if (kw === 'commit' || kw === 'end' || kw === 'rollback' || kw === 'abort') blockStart = null;
    }
    await client.query(ledgerInsertSql(f, own));
    resumeAt.delete(f);
    done(f, true);
  }

  async function apply(f: string): Promise<void> {
    const from = resumeAt.get(f);
    if (from !== undefined) return runBare(f, from);
    const body = readFile(f);
    const sql = `${f === OWNER_FILE ? `${OWNER_REINSERT_SQL};\n` : ''}${body}\n;\n${ledgerInsertSql(f, statementsOf(f))};`;
    for (let attempt = 1; ; attempt++) {
      try {
        await client.query(sql);
        done(f, false);
        return;
      } catch (e) {
        const code = sqlStateOf(e);
        if (code === null) {
          stop = new StopRun(f, e);
          throw e;
        }
        if (NEEDS_BARE.has(code)) {
          await client.query('ROLLBACK');
          onEvent?.({ kind: 'bare', file: f, code });
          return runBare(f, 0);
        }
        if (TRANSIENT.has(code)) {
          if (attempt >= IN_PLACE_TRIES) {
            stop = new StopRun(f, e);
            throw e;
          }
          await client.query('ROLLBACK');
          onEvent?.({ kind: 'retry-in-place', file: f, code, attempt });
          if (delay > 0) await new Promise((r) => setTimeout(r, delay * attempt));
          continue;
        }
        if (!reported.has(f)) {
          reported.add(f);
          onEvent?.({ kind: 'deferred', file: f, error: firstLine(e) });
        }
        throw e;
      }
    }
  }

  const order = await replayInFilenameOrder(plan.pending, {
    apply,
    rollback: async () => {
      if (stop) throw stop;
      await client.query('ROLLBACK');
    },
    // ⛔ No `isStillMissing`, on purpose: see the header. Every deferred file is retried after every success.
  });

  const skipped: ApplyReport['skipped'] = [];
  for (const [f, reason] of ALLOWED_SKIP) {
    const error = order.deferred.get(f);
    if (error === undefined) continue;
    order.deferred.delete(f);
    // A bare skip that committed part of itself is NOT recorded: that is a real failure, not a known skip.
    if (resumeAt.has(f)) {
      order.deferred.set(f, error);
      continue;
    }
    await client.query(ledgerInsertSql(f, statementsOf(f)));
    skipped.push({ file: f, reason, error: error.split('\n')[0] ?? error });
  }

  const unexpectedOutOfOrder = order.outOfOrder.filter(
    (o) => o.viaFinalPass || EXPECTED_OUT_OF_ORDER[o.file] !== o.landedAfter,
  );
  return {
    plan,
    applied,
    bare,
    stillFailing: [...order.deferred].map(([file, error]) => ({ file, error: error.split('\n')[0] ?? error })),
    skipped,
    outOfOrder: order.outOfOrder,
    unexpectedOutOfOrder,
    cron: await readCron(client),
  };
}

async function readCron(client: SqlClient): Promise<ApplyReport['cron']> {
  const has = (await client.query(`SELECT to_regclass('cron.job') IS NOT NULL AS present`)).rows[0]?.present === true;
  if (!has) return null;
  const r = (await client.query('SELECT count(*)::int AS total, count(*) FILTER (WHERE active)::int AS active FROM cron.job')).rows[0];
  return { total: Number(r?.total ?? 0), active: Number(r?.active ?? 0) };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 7 · WHAT IT PRINTS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function formatPlan(plan: MigrationPlan, ownerPresent: boolean | null): string {
  const lines = [
    `  migration files in this checkout   ${plan.total}`,
    `  already in the branch's ledger      ${plan.alreadyApplied.length}${plan.alreadyApplied.length ? `  (last: ${plan.alreadyApplied.at(-1)})` : ''}`,
    `  to apply                            ${plan.pending.length}${plan.pending.length ? `  (${plan.pending[0]} … ${plan.pending.at(-1)})` : ''}`,
  ];
  if (plan.expectedOutOfOrder.length) {
    lines.push('  expected out of order (the replay lands each one right after the file that unblocks it):');
    for (const o of plan.expectedOutOfOrder) lines.push(`    ${o.file}\n      → after ${o.landsAfter}`);
  }
  if (plan.mayBeSkipped.length) {
    lines.push('  may be skipped (ALLOWED_SKIP: cannot apply from a fresh database; recorded in the ledger if so):');
    for (const s of plan.mayBeSkipped) lines.push(`    ${s.file}\n      ${s.reason}`);
  }
  if (plan.ownerPrecondition) {
    lines.push(
      `  owner precondition: a stand-in owner sign-in goes into auth.users first (${ownerPresent === true ? 'already there' : ownerPresent === false ? 'not there yet' : 'auth.users not found'}), as in the replay`,
    );
  }
  if (plan.ledgerOnly.length) lines.push(`  ⚠ in the ledger but not in this checkout: ${plan.ledgerOnly.join(', ')}`);
  for (const m of plan.nameMismatch) lines.push(`  ⚠ ${m.file}: the ledger calls it "${m.ledgerName}"`);
  return lines.join('\n');
}

export function formatReport(r: ApplyReport): string {
  const lines = [`  applied now        ${r.applied.length} of ${r.plan.pending.length} pending (${r.plan.alreadyApplied.length} were already in the ledger)`];
  if (r.bare.length) lines.push(`  ran bare           ${r.bare.join(', ')}`);
  lines.push(`  out of order       ${r.outOfOrder.length ? '' : 'none'}`);
  for (const o of r.outOfOrder) {
    lines.push(`    ${o.file}\n      → after ${o.landedAfter}${o.viaFinalPass ? '  🚨 AFTER THE WHOLE CORPUS' : ''}  (${o.reason})`);
  }
  lines.push(`  skipped (known)    ${r.skipped.length ? '' : 'none'}`);
  for (const s of r.skipped) lines.push(`    ${s.file}\n      ${s.reason}\n      last error: ${s.error}`);
  lines.push(`  still failing      ${r.stillFailing.length ? '' : 'none'}`);
  for (const s of r.stillFailing) lines.push(`    ${s.file}\n      ${s.error}`);
  if (r.unexpectedOutOfOrder.length) {
    lines.push(`  ⚠ landed somewhere the replay does not (check what these write): ${r.unexpectedOutOfOrder.map((o) => o.file).join(', ')}`);
  }
  if (r.cron) lines.push(`  pg_cron jobs       ${r.cron.total} (active ${r.cron.active}) — seed.ts seals them off before it writes a row`);
  return lines.join('\n');
}

/** 0 = clean · 1 = files still failing · 3 = applied, but something landed where the replay does not. */
export function exitCodeFor(r: ApplyReport): number {
  if (r.stillFailing.length > 0) return 1;
  if (r.unexpectedOutOfOrder.length > 0) return 3;
  return 0;
}
