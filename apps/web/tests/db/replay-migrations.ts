/**
 * Migration replay harness — boots the ENTIRE production schema (all
 * supabase/migrations, ~790 files) into an in-process PGlite (WASM Postgres,
 * PG 18) so DB-level machinery — SECURITY DEFINER RPCs, RLS policies,
 * triggers, CHECK constraints — can be exercised in tests with NO docker, NO
 * local supabase, NO network, and NO risk of touching prod.
 *
 * What is shimmed (ONLY what the Supabase runtime normally provides):
 *   • roles anon / authenticated / service_role
 *   • schema auth: a stub auth.users + auth.uid()/auth.role()/auth.jwt()
 *     reading the same request.jwt.claim.* GUCs Supabase uses — tests
 *     impersonate a user via setAuthUid(db, uuid)
 *   • schema storage: stub buckets/objects (bucket seeds + storage policies
 *     apply cleanly; object I/O is out of scope)
 *   • pg_cron / pg_net: bookkeeping stubs (cron.schedule records the job,
 *     net.http_post records the call; nothing executes / leaves the process)
 *   • pgvector: unavailable in this PGlite build — exactly one migration
 *     (20260518500000) declares two embedding columns as extensions.vector(384);
 *     they are shimmed to text (inert storage, not used by any tested path)
 *
 * Replay order: filename order, with failures retried until fixpoint — the
 * corpus is not strictly linear (a few files are back-numbered relative to
 * objects they touch; prod converged via repeated `db push` over time).
 * Two files are unapplyable on a FRESH database by construction and are
 * skipped with reasons (see ALLOWED_SKIP).
 *
 * SCREEN-NAME COLLISION (historical note): the 20260714000000 screen-name
 * generator minted ids per (city, canonical_service) but built the UNIQUE slug
 * from (city, display_label); two unmapped service keys share the 'Wedding
 * Vendor' fallback label and could collide, failing a real vendor INSERT in
 * prod. This was originally worked around here with a replay-only SQL patch.
 * That patch is GONE: migration 20270820111851_fix_screen_name_slug_collision_
 * namespace.sql is the real prod fix (mints in the slug's own (city, display)
 * namespace + bounded uniqueness retry), so the replay now runs the REAL
 * migrations end-to-end with no screen-name shim.
 */

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** apps/web/tests/db → repo root is four levels up. */
export const MIGRATIONS_DIR = path.resolve(HERE, '../../../../supabase/migrations');

const OWNER_UUID = '11111111-1111-4111-8111-111111111111';

export const ALLOWED_SKIP: ReadonlyMap<string, string> = new Map([
  [
    '20270405784887_seed_founder_vendor_demo_stats.sql',
    'demo-stats seed keyed to a prod-only founder vendor UUID (aborts by design when absent)',
  ],
  [
    '20270110320023_invitation_widgets_our_love_story.sql',
    'back-numbered file: re-adds a widget_type CHECK narrower than rows later-numbered (earlier-applied) migrations already inserted',
  ],
  [
    '20270712300100_subdomain_sku_event_and_vendor.sql',
    'catalog seed whose offering_type predates the final CHECK on vendor_billing_catalog (ordering artifact; resolves via retry on most runs)',
  ],
  [
    '20270723385655_keep_full_res_archive_sku.sql',
    'catalog seed whose billing_period predates the final CHECK on platform_retail_catalog_v2 (ordering artifact; resolves via retry on most runs)',
  ],
]);

const BOOTSTRAP = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS net;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  encrypted_password text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  confirmed_at timestamptz,
  banned_until timestamptz,
  deleted_at timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false,
  aud text DEFAULT 'authenticated',
  role text DEFAULT 'authenticated'
);

-- Same GUC-based identity seam Supabase's auth.uid() uses.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon')
$fn$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$fn$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  path_tokens text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1]
$fn$;

CREATE TABLE IF NOT EXISTS cron.job (
  jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schedule text, command text, jobname text UNIQUE, active boolean DEFAULT true
);
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  INSERT INTO cron.job (schedule, command, jobname) VALUES (schedule, command, job_name)
  ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
  RETURNING jobid INTO v_id;
  RETURN v_id;
END $fn$;
CREATE OR REPLACE FUNCTION cron.schedule(schedule text, command text)
RETURNS bigint LANGUAGE sql AS $fn$ SELECT cron.schedule(md5(command), schedule, command) $fn$;
CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE plpgsql AS $fn$
BEGIN DELETE FROM cron.job WHERE jobname = job_name; RETURN FOUND; END $fn$;

CREATE TABLE IF NOT EXISTS net._http_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url text, headers jsonb, body jsonb, called_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION net.http_post(url text, headers jsonb DEFAULT '{}'::jsonb, body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  INSERT INTO net._http_calls (url, headers, body) VALUES (url, headers, body) RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

-- Early migrations call gen_random_bytes() unqualified (prod had pgcrypto on
-- the search path); expose a public wrapper over extensions.gen_random_bytes.
CREATE OR REPLACE FUNCTION public.gen_random_bytes(n integer) RETURNS bytea
LANGUAGE sql VOLATILE AS $fn$ SELECT extensions.gen_random_bytes(n) $fn$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, auth, extensions, storage TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public._replay_migrations (fname text PRIMARY KEY, applied_at timestamptz DEFAULT now());

-- Owner precondition for 20260705000000: signed in once before migrations ran.
INSERT INTO auth.users (id, email)
VALUES ('${OWNER_UUID}', 'iscasasolaii@gmail.com')
ON CONFLICT DO NOTHING;
`;

function preprocess(sql: string): string {
  // pg_cron / pg_net don't exist in PGlite — the cron/net schemas are stubbed.
  sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS (pg_cron|pg_net)[^;]*;/gi, 'SELECT 1;');
  // pgvector unavailable — two inert embedding columns become text (see header).
  sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS vector[^;]*;/gi, 'SELECT 1;');
  sql = sql.replace(/extensions\.vector\(\d+\)/gi, 'text');
  return sql;
}

export type ReplayResult = {
  db: PGlite;
  applied: number;
  total: number;
  skipped: Array<{ file: string; reason: string }>;
};

/** Replay every migration into a fresh in-memory PGlite. ~10 s on a laptop. */
export async function createReplayedDb(): Promise<ReplayResult> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(`CREATE SCHEMA IF NOT EXISTS extensions;`);
  await db.exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`);
  await db.exec(BOOTSTRAP);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  async function applyOne(f: string): Promise<void> {
    const sql = preprocess(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
    if (f === '20260705000000_provision_owner_vendor_and_remove_prefilled.sql') {
      // Re-insert the owner AFTER on_auth_user_created exists so the REAL
      // trigger provisions the public.users profile row, exactly like prod.
      await db.exec(`
        DELETE FROM auth.users WHERE email = 'iscasasolaii@gmail.com';
        INSERT INTO auth.users (id, email) VALUES ('${OWNER_UUID}', 'iscasasolaii@gmail.com');
      `);
    }
    await db.exec(sql);
    await db.query(
      'INSERT INTO public._replay_migrations (fname) VALUES ($1) ON CONFLICT DO NOTHING',
      [f],
    );
  }

  const deferred = new Map<string, string>();
  let applied = 0;
  for (const f of files) {
    try {
      await applyOne(f);
      applied++;
    } catch (e) {
      await db.exec('ROLLBACK').catch(() => {});
      deferred.set(f, e instanceof Error ? e.message : String(e));
    }
  }

  // Retry to fixpoint — resolves the back-numbered files.
  let pass = 0;
  while (deferred.size > 0 && pass < 10) {
    pass++;
    let progressed = false;
    for (const f of [...deferred.keys()]) {
      try {
        await applyOne(f);
        deferred.delete(f);
        applied++;
        progressed = true;
      } catch (e) {
        await db.exec('ROLLBACK').catch(() => {});
        deferred.set(f, e instanceof Error ? e.message : String(e));
      }
    }
    if (!progressed) break;
  }

  const skipped: Array<{ file: string; reason: string }> = [];
  for (const [f, reason] of ALLOWED_SKIP) {
    if (deferred.has(f)) {
      deferred.delete(f);
      skipped.push({ file: f, reason });
    }
  }

  if (deferred.size > 0) {
    const detail = [...deferred].map(([f, m]) => `  ${f}\n    ${m.split('\n')[0]}`).join('\n');
    throw new Error(`migration replay failed — unapplied files:\n${detail}`);
  }

  // Supabase grants table/sequence privileges to the API roles via platform
  // default-privileges; mirror that so RLS (not a missing GRANT) is the gate,
  // exactly as in prod.
  await db.exec(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  `);

  return { db, applied: applied + skipped.length, total: files.length, skipped };
}

/** Impersonate a user for auth.uid()-gated RPCs (NULL uuid = anonymous). */
export async function setAuthUid(db: PGlite, uid: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
}
