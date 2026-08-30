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
 *     net.http_post records the call into net._http_calls; nothing executes /
 *     leaves the process). The http_post stub matches real pg_net's parameter
 *     list and order, so a migration that passes timeout_milliseconds resolves.
 *   • supabase_vault: vault.secrets + a vault.decrypted_secrets view whose
 *     "decryption" is the identity function. Present because DB objects read
 *     their credentials from Vault rather than embedding them; NOTHING here
 *     holds a real secret, and tests seed their own rows.
 *   • pgvector: unavailable in this PGlite build — exactly one migration
 *     (20260518500000) declares two embedding columns as extensions.vector(384);
 *     they are shimmed to text (inert storage, not used by any tested path)
 *
 * Replay order: filename order, with a failure retried EAGERLY — after every
 * later file that succeeds, before advancing — so a back-numbered file lands
 * at the earliest index at which it can apply and never after the whole
 * corpus. That distinction is not cosmetic: retrying to a fixpoint at the END
 * let a 2026-05-30 seed overwrite the 2026-08-27 owner price sheet in every
 * database built from migrations. See `replayInFilenameOrder` for the
 * measurement and for the two designs that were rejected. Every out-of-order
 * landing is reported in `ReplayResult.outOfOrder`.
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
-- Parameter LIST and ORDER match real pg_net 0.20 — (url, body, params, headers,
-- timeout_milliseconds) — not a convenient subset. The stub used to be
-- (url, headers, body), which was invisible while every caller lived inside a
-- cron.schedule() string that the replay never executes. It stopped being
-- invisible when notify_chat_message_webhook() was back-filled from prod
-- (20271115531329): that one runs on a real INSERT, passes
-- timeout_milliseconds, and got "function net.http_post(...) does not exist" —
-- a failure that says nothing about the code under test. A shim that accepts
-- fewer arguments than the thing it stands in for is a shim that fabricates
-- errors, so match the real signature.
CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
)
RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
  INSERT INTO net._http_calls (url, headers, body) VALUES (url, headers, body) RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

-- Supabase Vault. Migration 20270930270000 established Vault as the place a
-- secret lives when a database object needs one (never the function body), and
-- 20271115531329's chat webhook reads it on every message INSERT — so the
-- replay needs somewhere for that read to land. decrypted_secrets is a view
-- over secrets in the real extension too; here the "decryption" is identity,
-- which is all a test needs and is why nothing in this file may ever hold a
-- real secret. Tests seed a row to exercise the configured path and leave the
-- table EMPTY to exercise the fail-closed path.
CREATE SCHEMA IF NOT EXISTS vault;
CREATE TABLE IF NOT EXISTS vault.secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE,
  description text NOT NULL DEFAULT '',
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE VIEW vault.decrypted_secrets AS
  SELECT s.id, s.name, s.description, s.secret,
         s.secret AS decrypted_secret,
         s.created_at, s.updated_at
    FROM vault.secrets s;

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

-- Supabase's platform DEFAULT PRIVILEGES: every table/sequence created in
-- schema public is granted to the API roles AT CREATE TIME. This MUST be a
-- default privilege and not a blanket GRANT afterwards — a trailing
-- "GRANT ALL ON ALL TABLES ... TO anon" silently UNDOES every REVOKE a
-- migration performed. That is not hypothetical: it is exactly how the
-- 20271005100000 / 20271007100000 events column lockdown (master_qr_token and
-- the OAuth token revoked from anon + authenticated) vanished in replay while
-- being live in prod. Declaring it here reproduces prod's real privilege
-- state: stock-granted by default, minus whatever migrations took back.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ...and the same for FUNCTIONS, which matters MORE than it looks. Supabase
-- grants EXECUTE to anon + authenticated EXPLICITLY at CREATE time. Postgres'
-- own built-in default instead grants EXECUTE to PUBLIC. The two look
-- identical until a migration writes:
--
--     REVOKE ALL ON FUNCTION f(...) FROM PUBLIC;
--
-- On stock Postgres that fully locks the function. On Supabase it is a NO-OP
-- against anon and authenticated, because their grants are their own ACL
-- entries and are not part of PUBLIC. Verified against prod 2026-07-26:
-- purge_expired_chat, claim_unlock_vendor_event, redeem_vendor_token_voucher,
-- admin_override_publish_review and vendor_set_booth_studio_content all use
-- that idiom and are ALL still anon-EXECUTE in prod
-- (proacl {postgres=X,anon=X,authenticated=X,service_role=X}), while the
-- functions written as REVOKE ... FROM PUBLIC, anon, authenticated are
-- correctly locked to service_role.
--
-- Without this line the replay under-reports the callable-RPC surface by 17
-- functions — and they are the dangerous ones. Declaring it here makes the
-- exposure baseline tell the truth AND makes the freeze catch the next
-- migration that reaches for the ineffective idiom.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

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

/**
 * A migration that could NOT apply at its own position in filename order, and
 * the point at which it finally did. `landedAfterIndex` is the EARLIEST index
 * at which the file succeeded, so every migration numbered above
 * `landedAfter` still runs AFTER it — which is the whole property that keeps
 * an old seed from overwriting a newer reprice. See `replayInFilenameOrder`.
 */
export type OutOfOrderApplication = {
  /** The back-numbered migration. */
  file: string;
  /** Its own index in filename order (0-based). */
  index: number;
  /** The file after whose successful apply it finally went in. */
  landedAfter: string;
  /** That file's index. */
  landedAfterIndex: number;
  /** First line of the error it raised at its own position. */
  reason: string;
};

export type ReplayResult = {
  db: PGlite;
  applied: number;
  total: number;
  skipped: Array<{ file: string; reason: string }>;
  /**
   * Every file that had to be applied away from its filename position, with
   * where it landed. EMPTY is the ideal; a growing list is a real finding, not
   * paperwork. `replay-order-is-honest.db.test.ts` pins this.
   */
  outOfOrder: OutOfOrderApplication[];
};

/**
 * The seam the ordering engine writes through. Split out from PGlite so the
 * ordering rule can be tested with a fake corpus in milliseconds — the real
 * corpus takes ~8 s and cannot express "an old file that overwrites a new one"
 * as a controlled experiment.
 */
export type ApplyPort = {
  apply(file: string): Promise<void>;
  /** Discard the transaction an aborted apply left open. */
  rollback(): Promise<void>;
};

export type ReplayOrder = {
  applied: number;
  /** Files that never applied at all, → the last error each raised. */
  deferred: Map<string, string>;
  outOfOrder: OutOfOrderApplication[];
};

/**
 * ⚠ THE ORDERING RULE, AND THE DEFECT IT REPLACED — measured 2026-08-31.
 *
 * This corpus is not strictly linear: a handful of files are back-numbered
 * relative to objects they touch (prod converged via repeated `db push` over
 * time, applying each file ONCE when it was authored). A replay from an empty
 * database therefore has to do something when a file fails on its own turn.
 *
 * 🚨 WHAT IT USED TO DO: collect every failure, then retry the collection to a
 * fixpoint AFTER the whole corpus had run. That put the back-numbered files
 * LAST — so the OLDEST file won. Seven files took that path on a normal run,
 * all cascading from ONE root: `20260530010000` (index 116) needs
 * `vendor_billing_catalog`, which `20260631000000` (index 187) creates. It was
 * therefore replayed after index 1269 — and it carries
 *
 *     UPDATE vendor_billing_catalog SET price_php = 2499 WHERE sku_code = 'pro_vendor_monthly';
 *     UPDATE vendor_billing_catalog SET price_php = 24999 WHERE sku_code = 'pro_vendor_annual';
 *
 * which overwrote the 2026-08-27 owner price sheet (`20271171000513`, index
 * 1212) in EVERY database built from migrations. Both of the rows that file
 * writes, and only those two, disagreed with the price sheet's own
 * postcondition — re-running the price sheet against the finished replay
 * raised its own guard, `a rung the owner left alone has moved`. Production
 * never had this: it applied each migration once, in authored order, and never
 * re-ran a 2026-05-30 seed after a 2026-08-27 reprice.
 *
 * ✅ WHAT IT DOES NOW: drain the deferred set EAGERLY — after every successful
 * apply, retry the deferred files to a local fixpoint before advancing. A
 * back-numbered file therefore lands at the earliest index at which it can
 * succeed (`20260530010000` now goes in right after `20260631000000`), so
 * every higher-numbered migration still runs after it and the LAST writer to a
 * row is the highest-numbered one — the same last-writer-wins prod has.
 *
 * 🔑 WHY NOT THE OTHER TWO OPTIONS.
 *   · "After the fixpoint, re-apply the later files a deferred file could have
 *     clobbered" — migrations are not idempotent. Re-running `20271171000513`
 *     against the finished replay does not repair it, it RAISES; and "could
 *     have clobbered" is not knowable without executing the file.
 *   · "Fail loudly instead of reordering at all" — that reds 1,924 db tests on
 *     arrival for a corpus that genuinely is back-numbered, and a guard that
 *     is red on arrival gets deleted. Loudness is kept where it is affordable:
 *     every out-of-order landing is REPORTED in `ReplayResult.outOfOrder` and
 *     pinned by a test, so the next one is seen instead of absorbed.
 *
 * ⛔ A FAILED APPLY ROLLS BACK AND CHANGES NOTHING, so the drain only runs
 * after a SUCCESS, and there is no final fixpoint pass — a file that fails on
 * the last index cannot succeed on a re-attempt against an unchanged database.
 */
export async function replayInFilenameOrder(
  files: readonly string[],
  port: ApplyPort,
): Promise<ReplayOrder> {
  const ordered = [...files].sort();
  const indexOf = new Map(ordered.map((f, i) => [f, i] as const));
  const deferred = new Map<string, string>();
  const firstFailure = new Map<string, string>();
  const outOfOrder: OutOfOrderApplication[] = [];
  let applied = 0;

  async function attempt(f: string): Promise<boolean> {
    try {
      await port.apply(f);
      applied++;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!firstFailure.has(f)) firstFailure.set(f, msg.split('\n')[0] ?? msg);
      deferred.set(f, msg);
      await port.rollback();
      return false;
    }
  }

  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i]!;
    const ok = await attempt(f);
    if (!ok || deferred.size === 0) continue;
    // Drain to a LOCAL fixpoint before advancing to i + 1.
    for (;;) {
      let progressed = false;
      for (const d of [...deferred.keys()].sort()) {
        if (!(await attempt(d))) continue;
        deferred.delete(d);
        outOfOrder.push({
          file: d,
          index: indexOf.get(d) ?? -1,
          landedAfter: f,
          landedAfterIndex: i,
          reason: firstFailure.get(d) ?? '',
        });
        progressed = true;
      }
      if (!progressed) break;
    }
  }

  return { applied, deferred, outOfOrder };
}

export type ReplayOptions = {
  /**
   * Replay ONLY the migrations whose version (the leading numeric field of the
   * filename) is in this set. Omit to replay everything — the default, and what
   * every existing caller wants.
   *
   * Added for the schema-drift check, which replays exactly the migrations
   * production's ledger says it has applied. Without that filter, a migration
   * added in an open pull request — correctly absent from prod — would show up
   * as drift on every schema PR, and a guard that cries wolf on every schema PR
   * is a guard that gets deleted.
   */
  only?: ReadonlySet<string>;
};

/** The leading numeric field of a migration filename, e.g. `20271011120000`. */
export function versionOf(filename: string): string {
  return filename.split('_')[0] ?? '';
}

/** Replay every migration into a fresh in-memory PGlite. ~6 s on a laptop. */
export async function createReplayedDb(opts: ReplayOptions = {}): Promise<ReplayResult> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(`CREATE SCHEMA IF NOT EXISTS extensions;`);
  await db.exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`);
  await db.exec(BOOTSTRAP);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => !opts.only || opts.only.has(versionOf(f)))
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

  // Ordering lives in replayInFilenameOrder — see its docblock for why a
  // deferred file is retried EAGERLY and not after the whole corpus.
  const { applied, deferred, outOfOrder } = await replayInFilenameOrder(files, {
    apply: applyOne,
    rollback: async () => {
      await db.exec('ROLLBACK').catch(() => {});
    },
  });

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

  // NOTE: there is deliberately NO blanket `GRANT ALL ON ALL TABLES` here.
  // Supabase's platform default-privileges are declared in BOOTSTRAP via
  // ALTER DEFAULT PRIVILEGES, so tables are stock-granted at CREATE time and a
  // migration's REVOKE survives — matching prod. Re-granting here would erase
  // every lockdown the migrations performed and make the exposure-surface
  // freeze (exposure-freeze.db.test.ts) blind to exactly the class of bug it
  // exists to catch.

  return { db, applied: applied + skipped.length, total: files.length, skipped, outOfOrder };
}

/** Impersonate a user for auth.uid()-gated RPCs (NULL uuid = anonymous). */
export async function setAuthUid(db: PGlite, uid: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
}
