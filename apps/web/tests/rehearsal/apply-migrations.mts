/**
 * RELEASE REHEARSAL — build the throw-away database from `supabase/migrations`.
 *
 * Run by `.github/workflows/release-rehearsal.yml` against the LOCAL Supabase
 * stack that workflow starts (real Postgres 17 + GoTrue + PostgREST in Docker
 * on the runner). It never runs anywhere else: `assertLocalUrl` (local-only.ts) refuses any host
 * that is not loopback.
 *
 * ── WHY NOT JUST `supabase db reset` ─────────────────────────────────────────
 * This corpus cannot be applied to an EMPTY database in plain filename order.
 * Production converged over time (each file applied once, when it was written),
 * and a handful of files are back-numbered relative to objects they touch —
 * `tests/db/replay-migrations.ts` documents each one. `supabase db reset` and a
 * from-empty `supabase db push` both stop at the first such file.
 *
 * So the build is two phases, and each uses the thing the repo already has:
 *
 *   PHASE 1 — THE BASELINE ("what the live site has"). The repo's own ordering
 *     engine, `replayInFilenameOrder` (the one every `*.db.test.ts` uses over
 *     PGlite), drives real Postgres through `psql`. Same engine, same
 *     ALLOWED_SKIP list, same owner precondition — only the port differs. Every
 *     file it applies is written to `supabase_migrations.schema_migrations`,
 *     the ledger `supabase db push` reads.
 *
 *   PHASE 2 — THE RELEASE ("what this upload adds"). The workflow then runs the
 *     REAL `supabase db push --include-all --yes` against that database — the
 *     exact command `deploy-prod.yml` runs against production. It applies
 *     whatever the ledger does not hold, in the pipeline's own order.
 *
 * With `BASELINE_LIST` set (a file of migration filenames present at the LIVE
 * commit), phase 1 applies only those and phase 2 applies the release's new
 * migrations the way production will. Without it, phase 1 applies everything
 * and phase 2 must report "up to date" — which still proves the ledger and the
 * files agree.
 *
 * ⚠ WHAT THIS IS NOT. The baseline is a REPLAY of the files, not a copy of
 * production. Anything production holds that no migration file wrote (a
 * hand-applied change, data) is not here. The four ALLOWED_SKIP files never
 * apply to an empty database; they are recorded in the ledger as applied —
 * because production's ledger has them — and listed in the summary.
 *
 * Usage (from apps/web):
 *   REHEARSAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     pnpm exec tsx tests/rehearsal/apply-migrations.mts
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_SKIP,
  replayInFilenameOrder,
  versionOf,
  type MissingObject,
} from '../db/replay-migrations';
import { assertLocalUrl } from './local-only';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../../../../supabase/migrations');
const OUT_DIR = process.env.REHEARSAL_OUT ?? path.resolve(HERE, '../../rehearsal-out');

/** Same precondition the PGlite replay seeds: the owner signed in once before
 *  migrations ran, and 20260705000000 provisions him through the real trigger. */
const OWNER_UUID = '11111111-1111-4111-8111-111111111111';
const OWNER_EMAIL = 'iscasasolaii@gmail.com';
const OWNER_FILE = '20260705000000_provision_owner_vendor_and_remove_prefilled.sql';

let PG_ENV: NodeJS.ProcessEnv = process.env;

/** ⛔ Refuses a non-local database BEFORE the first psql is spawned. */
function connect(): void {
  const url = assertLocalUrl(process.env.REHEARSAL_DB_URL ?? '', 'the rehearsal database');
  PG_ENV = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username || 'postgres'),
    PGPASSWORD: decodeURIComponent(url.password || ''),
    PGDATABASE: url.pathname.replace(/^\//, '') || 'postgres',
    PGCONNECT_TIMEOUT: '10',
  };
}

type PsqlResult = { ok: boolean; stdout: string; error: string };

function psql(args: string[], user?: string): PsqlResult {
  const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], {
    env: user ? { ...PG_ENV, PGUSER: user } : PG_ENV,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw new Error(`psql could not be started: ${r.error.message}`);
  if (r.status === 0) return { ok: true, stdout: r.stdout ?? '', error: '' };
  // psql prefixes `psql:<file>:<line>: ERROR:  <message>`. The ordering engine
  // matches on the bare first line of the message, so hand it exactly that.
  const m = /ERROR:\s+(.*)/.exec(r.stderr ?? '');
  return { ok: false, stdout: r.stdout ?? '', error: (m?.[1] ?? r.stderr ?? 'psql failed').trim() };
}

function must(args: string[], what: string, user?: string): string {
  const r = psql(args, user);
  if (!r.ok) throw new Error(`${what} failed: ${r.error}`);
  return r.stdout;
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * ⛔ NOTHING LEAVES THE DATABASE.
 *
 * The migrations schedule pg_cron jobs and install triggers that call
 * `net.http_post` at production addresses (`www.setnayan.com/api/notify`, …).
 * On a real Postgres with real pg_cron and pg_net those would actually FIRE —
 * from a rehearsal, at the live site. So before a single migration runs:
 *   · every pg_cron job is forced inactive the moment it is written;
 *   · every pg_net request is swallowed before it reaches the send queue, and
 *     counted (`rehearsal.swallowed_http`) so the summary can say how many.
 * Done as the stack's superuser because `cron.job` and `net.http_request_queue`
 * are not `postgres`'s to put triggers on.
 */
function sealTheDatabase(): void {
  must(
    [
      '-c',
      `
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      CREATE EXTENSION IF NOT EXISTS pg_net;
      CREATE SCHEMA IF NOT EXISTS rehearsal;
      CREATE TABLE IF NOT EXISTS rehearsal.swallowed_http (
        id bigserial PRIMARY KEY, url text, at timestamptz NOT NULL DEFAULT now()
      );
      CREATE OR REPLACE FUNCTION rehearsal.swallow_http() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
      BEGIN
        INSERT INTO rehearsal.swallowed_http (url) VALUES (NEW.url);
        RETURN NULL;
      END $fn$;
      DROP TRIGGER IF EXISTS rehearsal_swallow_http ON net.http_request_queue;
      CREATE TRIGGER rehearsal_swallow_http BEFORE INSERT ON net.http_request_queue
        FOR EACH ROW EXECUTE FUNCTION rehearsal.swallow_http();
      CREATE OR REPLACE FUNCTION rehearsal.cron_stays_off() RETURNS trigger
      LANGUAGE plpgsql AS $fn$
      BEGIN
        NEW.active := false;
        RETURN NEW;
      END $fn$;
      DROP TRIGGER IF EXISTS rehearsal_cron_stays_off ON cron.job;
      CREATE TRIGGER rehearsal_cron_stays_off BEFORE INSERT OR UPDATE ON cron.job
        FOR EACH ROW EXECUTE FUNCTION rehearsal.cron_stays_off();
      GRANT USAGE ON SCHEMA rehearsal TO postgres;
      GRANT SELECT ON rehearsal.swallowed_http TO postgres;
      `,
    ],
    'sealing the database (pg_cron off, pg_net swallowed)',
    'supabase_admin',
  );
}

/**
 * 🔑 PRODUCTION'S DEFAULT PRIVILEGES, DECLARED — the same three lines the
 * PGlite replay's BOOTSTRAP declares, for the reason written there.
 *
 * In production every table, sequence and function `postgres` creates in
 * `public` is granted to anon / authenticated / service_role AT CREATE TIME
 * (verified against prod 2026-07-26, see tests/db/replay-migrations.ts). The
 * migrations are written on top of that: dozens of them REVOKE and then check,
 * as a post-condition, that the other roles still hold what they held.
 *
 * The stack `supabase start` builds does not carry those defaults for
 * `postgres` (measured on the first rehearsal run, 2026-10-08: 22 files failed
 * their own post-conditions — "service_role lost SELECT on vendor_profiles" —
 * on a database where service_role had never been granted it). So they are
 * declared here, before the first migration, exactly as the repo's own replay
 * does. What the stack had beforehand is printed, so this is never a guess.
 */
function declareProductionDefaultPrivileges(): void {
  const before = psql([
    '-At',
    '-c',
    `SELECT defaclrole::regrole || ' / ' || coalesce(defaclnamespace::regnamespace::text, '(all schemas)')
            || ' / ' || defaclobjtype || ' / ' || defaclacl::text
       FROM pg_default_acl ORDER BY 1`,
  ]);
  console.log('[rehearsal] default privileges the local stack came with:');
  console.log(before.ok ? before.stdout.trim().replace(/^/gm, '[rehearsal]   ') || '[rehearsal]   (none)' : `[rehearsal]   unreadable: ${before.error}`);
  must(
    [
      '-c',
      `
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
      `,
    ],
    "declaring production's default privileges",
  );
}

function prepareLedgerAndOwner(): void {
  must(
    [
      '-c',
      `
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text NOT NULL PRIMARY KEY, statements text[], name text
      );
      INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (${lit(OWNER_UUID)}, '00000000-0000-0000-0000-000000000000', 'authenticated',
              'authenticated', ${lit(OWNER_EMAIL)})
      ON CONFLICT DO NOTHING;
      `,
    ],
    'preparing the migration ledger and the owner precondition',
  );
}

function ledgerInsert(file: string): string {
  const version = versionOf(file);
  const name = file.slice(version.length + 1).replace(/\.sql$/, '');
  return (
    `INSERT INTO supabase_migrations.schema_migrations (version, name) ` +
    `VALUES (${lit(version)}, ${lit(name)}) ON CONFLICT DO NOTHING;`
  );
}

function applyOne(file: string): void {
  const args: string[] = ['-1'];
  if (file === OWNER_FILE) {
    // Re-insert the owner AFTER on_auth_user_created exists so the REAL trigger
    // provisions his profile row — exactly what the PGlite replay does.
    args.push(
      '-c',
      `DELETE FROM auth.users WHERE email = ${lit(OWNER_EMAIL)};
       INSERT INTO auth.users (id, instance_id, aud, role, email)
       VALUES (${lit(OWNER_UUID)}, '00000000-0000-0000-0000-000000000000', 'authenticated',
               'authenticated', ${lit(OWNER_EMAIL)});`,
    );
  }
  args.push('-f', path.join(MIGRATIONS_DIR, file), '-c', ledgerInsert(file));
  const r = psql(args);
  if (!r.ok) throw new Error(r.error);
}

function isStillMissing(obj: MissingObject): boolean {
  const sql =
    obj.kind === 'relation'
      ? `SELECT to_regclass(${lit(obj.name)}) IS NULL`
      : `SELECT NOT EXISTS (SELECT 1 FROM pg_attribute
           WHERE attrelid = to_regclass(${lit(obj.relation)}) AND attname = ${lit(obj.name)}
             AND NOT attisdropped AND attnum > 0)`;
  const r = psql(['-At', '-c', sql]);
  // Unreadable name, anything odd: do the work (same rule as the PGlite port).
  return r.ok && r.stdout.trim() === 't';
}

async function main(): Promise<void> {
  connect();
  const started = Date.now();
  const all = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // BASELINE_LIST: filenames that exist at the LIVE commit. Only files present
  // in BOTH are the baseline; the rest are the release, left for `db push`.
  let baseline = all;
  const listPath = process.env.BASELINE_LIST ?? '';
  if (listPath && fs.existsSync(listPath)) {
    const live = new Set(
      fs
        .readFileSync(listPath, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.endsWith('.sql')),
    );
    if (live.size === 0) throw new Error(`BASELINE_LIST ${listPath} names no migration files.`);
    baseline = all.filter((f) => live.has(f));
  }
  const release = all.filter((f) => !baseline.includes(f));

  console.log(
    `[rehearsal] ${all.length} migration files · baseline ${baseline.length} · this release adds ${release.length}`,
  );

  sealTheDatabase();
  declareProductionDefaultPrivileges();
  prepareLedgerAndOwner();

  let done = 0;
  const order = await replayInFilenameOrder(baseline, {
    apply: async (f) => {
      applyOne(f);
      done++;
      if (done % 200 === 0) console.log(`[rehearsal]   applied ${done}/${baseline.length}`);
    },
    // psql -1 already rolled the failed file back; nothing is left open.
    rollback: async () => {},
    isStillMissing: async (obj) => isStillMissing(obj),
  });

  const skipped: Array<{ file: string; reason: string }> = [];
  for (const [f, reason] of ALLOWED_SKIP) {
    if (order.deferred.has(f)) {
      order.deferred.delete(f);
      skipped.push({ file: f, reason });
      // Production's ledger holds these; without the row `db push` would try
      // them on an empty-built database and stop the rehearsal on a file the
      // repo already knows cannot apply from empty.
      must(['-c', ledgerInsert(f)], `recording skipped ${f} in the ledger`);
    }
  }

  const late = order.outOfOrder.filter((o) => o.viaFinalPass);
  const cronActive = must(['-At', '-c', `SELECT count(*) FROM cron.job WHERE active`], 'counting cron jobs').trim();
  const cronTotal = must(['-At', '-c', `SELECT count(*) FROM cron.job`], 'counting cron jobs').trim();

  const report = {
    total: all.length,
    baseline: baseline.length,
    applied: order.applied,
    release,
    skipped,
    outOfOrder: order.outOfOrder.map((o) => ({
      file: o.file,
      landedAfter: o.landedAfter,
      reason: o.reason,
      viaFinalPass: o.viaFinalPass,
    })),
    unapplied: [...order.deferred].map(([file, message]) => ({
      file,
      reason: message.split('\n')[0] ?? message,
    })),
    cronJobs: { total: Number(cronTotal), active: Number(cronActive) },
    seconds: Math.round((Date.now() - started) / 1000),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'migrations.json'), JSON.stringify(report, null, 2));

  console.log(
    `[rehearsal] baseline built in ${report.seconds}s — applied ${report.applied}, ` +
      `skipped ${skipped.length} (known), out of order ${report.outOfOrder.length}, ` +
      `cron jobs ${report.cronJobs.total} (active ${report.cronJobs.active})`,
  );

  if (report.unapplied.length > 0) {
    const detail = report.unapplied.map((u) => `  ${u.file}\n    ${u.reason}`).join('\n');
    throw new Error(`migrations did not apply to the rehearsal database:\n${detail}`);
  }
  if (late.length > 0) {
    throw new Error(
      `these files only applied after the WHOLE corpus, so the database was built in an order ` +
        `production never had: ${late.map((o) => o.file).join(', ')}`,
    );
  }
  if (report.cronJobs.active !== 0) {
    throw new Error(
      `${report.cronJobs.active} pg_cron job(s) are ACTIVE on the rehearsal database — the seal ` +
        `did not hold, and an active job can call the live site. Stopping.`,
    );
  }
}

main().catch((e: unknown) => {
  console.error(`::error title=Rehearsal migrations::${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
