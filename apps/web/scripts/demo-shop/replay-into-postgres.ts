/**
 * Replay every migration into a LOCAL, THROWAWAY Postgres — the database the demo-shop screenshots are taken against.
 *
 * Reuses the db-test harness (`tests/db/replay-migrations.ts`): its Supabase shims (`BOOTSTRAP`), its preprocess and
 * its ordering engine (`replayInFilenameOrder`), so the schema here is the schema every `*.db.test.ts` proves. The
 * only difference is the engine: a real Postgres the app can reach over PostgREST, instead of an in-process PGlite.
 *
 * 🛑 LOCAL ONLY. Refuses any host that is not localhost / a unix socket. It never reads SUPABASE_DB_URL and never
 * talks to production — it drops and recreates the database it is pointed at.
 *
 *   PGHOST=/tmp PGPORT=54329 pnpm -F @setnayan/web exec tsx scripts/demo-shop/replay-into-postgres.ts
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  BOOTSTRAP,
  MIGRATIONS_DIR,
  ALLOWED_SKIP,
  preprocess,
  replayInFilenameOrder,
} from '../../tests/db/replay-migrations';

const HOST = process.env.PGHOST ?? '/tmp';
const PORT = process.env.PGPORT ?? '54329';
const DB = process.env.PGDATABASE ?? 'setnayan_demo';
const OWNER_UUID = '11111111-1111-4111-8111-111111111111';

if (!(HOST.startsWith('/') || HOST === 'localhost' || HOST === '127.0.0.1')) {
  throw new Error(`replay-into-postgres: refusing non-local PGHOST "${HOST}". This script drops the database it targets.`);
}

function psql(args: string[], input?: string, db = DB): { ok: boolean; out: string; err: string } {
  const r = spawnSync('psql', ['-h', HOST, '-p', PORT, '-U', 'postgres', '-d', db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, out: r.stdout ?? '', err: r.stderr ?? '' };
}

function must(r: { ok: boolean; err: string }, what: string): void {
  if (!r.ok) throw new Error(`${what} failed:\n${r.err}`);
}

/** Postgres error first line, without psql's "psql:<file>:<n>: ERROR:  " prefix. */
function firstError(err: string): string {
  const line = err.split('\n').find((l) => l.includes('ERROR:')) ?? err.split('\n')[0] ?? '';
  return line.replace(/^.*ERROR:\s+/, '').trim();
}

async function main(): Promise<void> {
  must(psql(['-c', `DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`], undefined, 'postgres'), 'drop database');
  must(psql(['-c', `CREATE DATABASE ${DB}`], undefined, 'postgres'), 'create database');
  // Supabase's API login role. PostgREST connects as it and switches to anon / authenticated / service_role per JWT.
  must(
    psql(
      ['-c', `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator LOGIN NOINHERIT; END IF; END $$;`],
      undefined,
      'postgres',
    ),
    'authenticator role',
  );
  must(psql(['-c', 'CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;']), 'extensions');
  // PGlite runs as a superuser with no `SET max_stack_depth` limit worth lifting here; drop that one line.
  must(psql(['-f', '-'], BOOTSTRAP.replace("SET max_stack_depth = '6MB';", '')), 'bootstrap');
  // PostgREST v12 puts the JWT in `request.jwt.claims` (JSON) only; the harness's auth.uid() reads the older
  // per-claim GUC. Read both, so RLS sees the same user the app signed in.
  must(
    psql(['-f', '-'], `
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''),
                  NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$fn$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
                  NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon')
$fn$;
GRANT anon, authenticated, service_role TO authenticator;
`),
    'auth shims',
  );

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const started = Date.now();
  let n = 0;
  const order = await replayInFilenameOrder(files, {
    async apply(f) {
      let sql = preprocess(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
      if (f === '20260705000000_provision_owner_vendor_and_remove_prefilled.sql') {
        sql = `DELETE FROM auth.users WHERE email = 'iscasasolaii@gmail.com';
INSERT INTO auth.users (id, email) VALUES ('${OWNER_UUID}', 'iscasasolaii@gmail.com');
${sql}`;
      }
      const r = psql(['-1', '-f', '-'], `${sql}\n;INSERT INTO public._replay_migrations (fname) VALUES ('${f}') ON CONFLICT DO NOTHING;`);
      if (!r.ok) throw new Error(firstError(r.err));
      n += 1;
      if (n % 200 === 0) process.stdout.write(`  ${n}/${files.length} applied (${Math.round((Date.now() - started) / 1000)}s)\n`);
    },
    async rollback() {
      /* psql -1 already rolled the failed file back */
    },
  });

  for (const f of ALLOWED_SKIP.keys()) order.deferred.delete(f);
  console.log(`applied ${order.applied}/${files.length} in ${Math.round((Date.now() - started) / 1000)}s · out of order ${order.outOfOrder.length}`);
  if (order.deferred.size > 0) {
    for (const [f, m] of order.deferred) console.log(`  ✗ ${f}\n      ${m.split('\n')[0]}`);
    process.exitCode = 1;
  }
  // PostgREST reads the schema cache once at boot and on this signal.
  psql(['-c', "NOTIFY pgrst, 'reload schema'"]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
