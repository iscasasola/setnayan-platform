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
import {
  ALLOWED_SKIP,
  MIGRATIONS_DIR,
  OWNER_EMAIL,
  OWNER_FILE,
  OWNER_UUID,
  replayInFilenameOrder,
  settleOrder,
  versionOf,
  type MissingObject,
  type OutOfOrderApplication,
  type ReplayOrder,
} from './migration-order';

/*
  The ordering engine, the skip list and the owner precondition moved to
  ./migration-order.ts (2026-11-25) so a real Postgres can be driven by the same
  rule without loading PGlite. Re-exported here, so no importer moved.
*/
export {
  ALLOWED_SKIP,
  EXPECTED_OUT_OF_ORDER,
  MIGRATIONS_DIR,
  parseMissingObject,
  replayInFilenameOrder,
  settleOrder,
  versionOf,
  type ApplyPort,
  type MissingObject,
  type OutOfOrderApplication,
  type ReplayOrder,
  type ReplayOrderOptions,
  type SettleBuild,
} from './migration-order';

/*
  📏 max_stack_depth 6MB (2026-11-02, measured). PGlite (WebAssembly) does not hand back all of its stack after an
  ERROR — the replay raises ~1,600 of them on purpose (deferred files, and every skip `auditSkips` re-attempts), and
  the room left shrinks with each one. At the stock 2MB the AUDITED replay ran out exactly when the corpus grew by one
  file: the next two migrations failed with "stack depth limit exceeded" — and a one-line placeholder migration in
  their place reproduced it, so it was the COUNT, not any file's SQL. Measured: a runaway recursion still ends the same
  way at 2MB and at 6MB (PGlite stops either way), so this guards nothing less; it only stops an error budget from
  reading as a broken migration. Held by replay-order-is-honest.db.test.ts ("every skip the drain took …"), which fails
  at 2MB on today's corpus.
*/
export const BOOTSTRAP = `
SET max_stack_depth = '6MB';
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
VALUES ('${OWNER_UUID}', '${OWNER_EMAIL}')
ON CONFLICT DO NOTHING;
`;

export function preprocess(sql: string): string {
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
  /**
   * Every file that had to be applied away from its filename position, with
   * where it landed. EMPTY is the ideal; a growing list is a real finding, not
   * paperwork. `replay-order-is-honest.db.test.ts` pins this.
   */
  outOfOrder: OutOfOrderApplication[];
  /** Retries the drain PROVED were pointless and skipped. Zero means the fast
   *  path is inert — a silent regression to the slow drain, so a test pins it. */
  probeSkips: number;
  /** Retries skipped because the failure named nothing probeable. */
  blindSkips: number;
};

/** Ask the live database whether a named object is still absent. */
async function isStillMissingIn(db: PGlite, obj: MissingObject): Promise<boolean> {
  try {
    if (obj.kind === 'relation') {
      const r = await db.query<{ gone: boolean }>(`SELECT to_regclass($1) IS NULL AS gone`, [
        obj.name,
      ]);
      return r.rows[0]?.gone ?? false;
    }
    // A missing RELATION also means a missing column, and to_regclass(NULL-ish)
    // simply makes the EXISTS false — no special case needed.
    const r = await db.query<{ gone: boolean }>(
      `SELECT NOT EXISTS (
         SELECT 1 FROM pg_attribute
          WHERE attrelid = to_regclass($1) AND attname = $2
            AND NOT attisdropped AND attnum > 0
       ) AS gone`,
      [obj.relation, obj.name],
    );
    return r.rows[0]?.gone ?? false;
  } catch {
    // Unreadable name, aborted session, anything: do the work.
    return false;
  }
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
  /**
   * Re-attempt every retry the drain's probe gate skipped, and fail loudly if
   * one of them applies. Roughly restores the pre-gate cost, so it is for
   * `replay-order-is-honest.db.test.ts` to prove the gate sound — not for
   * ordinary runs.
   */
  auditSkips?: boolean;
  /**
   * 🚪 Keep `platform_settings.bookings_open` exactly as the migrations leave it — CLOSED, the launch default
   * (owner 2026-11-02, 20271302310560_bookings_closed_switch.sql). Omit for every ordinary run: see the note at
   * the end of `createReplayedDb` for why the replay opens bookings by default.
   */
  bookingsAsMigrated?: boolean;
};

/** Replay every migration into a fresh in-memory PGlite. ~6 s on a laptop. */
export async function createReplayedDb(opts: ReplayOptions = {}): Promise<ReplayResult> {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => !opts.only || opts.only.has(versionOf(f)))
    .sort();

  async function buildOnce(
    forceEager: ReadonlySet<string>,
  ): Promise<{ db: PGlite; order: ReplayOrder }> {
    const db = await PGlite.create({ extensions: { pgcrypto } });
    await db.exec(`CREATE SCHEMA IF NOT EXISTS extensions;`);
    await db.exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`);
    await db.exec(BOOTSTRAP);

    async function applyOne(f: string): Promise<void> {
      const sql = preprocess(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
      if (f === OWNER_FILE) {
        // Re-insert the owner AFTER on_auth_user_created exists so the REAL
        // trigger provisions the public.users profile row, exactly like prod.
        await db.exec(`
          DELETE FROM auth.users WHERE email = '${OWNER_EMAIL}';
          INSERT INTO auth.users (id, email) VALUES ('${OWNER_UUID}', '${OWNER_EMAIL}');
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
    const order = await replayInFilenameOrder(
      files,
      {
        apply: applyOne,
        rollback: async () => {
          await db.exec('ROLLBACK').catch(() => {});
        },
        isStillMissing: (obj) => isStillMissingIn(db, obj),
      },
      { forceEager, auditSkips: opts.auditSkips },
    );
    return { db, order };
  }

  /*
    ⚠ THE ONE PLACE THE FAST PATH COULD COST ORDERING, AND THE UNDO FOR IT.

    The drain skips a retry outright when the file's failure named nothing it
    could probe — a CHECK violation, a RAISE. Both files that do this today
    NEVER apply at all (they are in ALLOWED_SKIP), so they cannot overwrite
    anything, and skipping them is what buys back the whole cost. But "today"
    is not a guarantee: a future migration could fail that way and then become
    applyable mid-corpus, and the final pass would put it in LAST — the exact
    2026-08-31 defect.

    🔑 SO IT IS NOT LEFT TO A TEST TO NOTICE. If any file lands via the final
    pass, this THROWS THE DATABASE AWAY and replays from scratch with that file
    forced eager, so what is returned was built in the corrected order. A
    report would have been read after the fact, by someone, maybe; every other
    db test in the same run would already have used the reordered database.
  */
  const settled = await settleOrder<PGlite>({
    build: async (forceEager) => {
      const { db: h, order } = await buildOnce(forceEager);
      return { order, handle: h };
    },
    discard: (h) => h.close(),
  });

  const db = settled.handle;
  const { applied, deferred, outOfOrder } = settled.order;

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

  /*
    🚪 BOOKINGS ARE OPENED HERE, FOR EVERY TEST BUT THE ONE ABOUT THE SWITCH (2026-11-02).

    The migrations leave `platform_settings.bookings_open` NULL — closed, the launch default — and the trigger
    `event_vendors_require_bookings_open` then refuses every marketplace row moving into a booked status. Roughly
    ninety db tests book a supplier to test what booking DOES (fees, holds, handshakes, capacity); none of them is
    about whether bookings are open, and every one would fail on the switch instead of on its own subject.

    So the replay opens bookings — the behaviour those tests were written against — and the switch itself is
    proven on a replay built with `{ bookingsAsMigrated: true }` (`bookings-closed-switch.db.test.ts`), which also
    asserts the as-migrated value really is closed. ⚠ This is a TEST default, never evidence of production's
    value: production keeps whatever the admin last set on /admin/booking-fees.
    Guarded on the column, so an `only` replay that predates the switch is untouched.
  */
  if (!opts.bookingsAsMigrated) {
    await db.exec(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'platform_settings' AND column_name = 'bookings_open'
        ) THEN
          UPDATE public.platform_settings SET bookings_open = TRUE WHERE id = 1;
        END IF;
      END $$;
    `);
  }

  // NOTE: there is deliberately NO blanket `GRANT ALL ON ALL TABLES` here.
  // Supabase's platform default-privileges are declared in BOOTSTRAP via
  // ALTER DEFAULT PRIVILEGES, so tables are stock-granted at CREATE time and a
  // migration's REVOKE survives — matching prod. Re-granting here would erase
  // every lockdown the migrations performed and make the exposure-surface
  // freeze (exposure-freeze.db.test.ts) blind to exactly the class of bug it
  // exists to catch.

  return {
    db,
    applied: applied + skipped.length,
    total: files.length,
    skipped,
    outOfOrder,
    probeSkips: settled.order.probeSkips,
    blindSkips: settled.order.blindSkips,
  };
}

/** Impersonate a user for auth.uid()-gated RPCs (NULL uuid = anonymous). */
export async function setAuthUid(db: PGlite, uid: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
}
