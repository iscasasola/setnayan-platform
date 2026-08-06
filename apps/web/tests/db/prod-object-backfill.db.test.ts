/**
 * SIX FUNCTIONS AND TWO TRIGGERS THAT PRODUCTION HAD AND THE REPOSITORY DID NOT.
 *
 * ── WHAT WENT WRONG ────────────────────────────────────────────────────────
 * Every data-layer guard in this repo is built the same way: replay
 * supabase/migrations into an in-process PGlite, then read the resulting
 * catalog. The exposure freeze, the anon-RPC surface, the schema-drift check
 * and the FK-behaviour file all share that one foundation — which means an
 * object applied to production BY HAND is invisible to all of them at once, and
 * invisible in a way that looks exactly like "clean".
 *
 * A `pg_proc` / `pg_trigger` diff against prod on 2026-08-06 found six such
 * functions. Four are SECURITY DEFINER and anon-EXECUTE, so the anon-RPC
 * surface — a file whose whole job is to enumerate that exact set — has been
 * under-reporting since each was applied.
 *
 * ── THE ONE THAT MATTERED ──────────────────────────────────────────────────
 * `notify_chat_message_webhook()` fires on EVERY chat message and posted the
 * whole row to an HTTP endpoint with a 64-hex-character credential typed
 * straight into the function body. `pg_proc.prosrc` is world-readable inside
 * the database. Migration 20271115531329 replaces the body with a Supabase
 * Vault read (the pattern 20270930270000 already established) and this file
 * holds the guard that keeps the literal from coming back — plus the
 * fail-closed behaviour test that says what happens when the Vault row is
 * missing: NOTHING is sent, rather than a chat message leaving the database
 * with no credential attached.
 *
 * ── WHY THE ASSERTIONS ARE CATALOG READS, NOT FILE GREPS ────────────────────
 * A grep over supabase/migrations proves a migration MENTIONS a name. It does
 * not prove the object exists after a real replay, which is the property every
 * downstream guard actually depends on. These read the replayed catalog.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/**
 * The six functions that existed ONLY in production until 20271115531329.
 * Names are spelled out rather than derived, because the point of the file is
 * that a derived list is exactly what missed them.
 */
const BACK_FILLED_FUNCTIONS = [
  'confirm_guest_delivery',
  'get_vendor_mood_board',
  'list_vendor_delivery_bookings',
  'notify_chat_message_webhook',
  'rls_auto_enable',
  'undo_guest_delivery',
] as const;

/** Fake, test-only value. Never a real credential — see the header. */
const FAKE_VAULT_SECRET = 'test-secret-not-a-real-credential';

const F = {
  couple: '',
  vendorUser: '',
  vendorId: '',
  eventId: '',
  threadId: '',
};

async function seedVault(name: string, secret: string): Promise<void> {
  await db.query(
    `INSERT INTO vault.secrets (name, secret) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret`,
    [name, secret],
  );
}

async function clearVault(): Promise<void> {
  await db.exec(`DELETE FROM vault.secrets`);
}

async function httpCalls(): Promise<Array<{ url: string; headers: Record<string, string> }>> {
  const r = await db.query<{ url: string; headers: Record<string, string> }>(
    `SELECT url, headers FROM net._http_calls ORDER BY id`,
  );
  return r.rows;
}

async function postMessage(body: string): Promise<void> {
  await db.query(
    `INSERT INTO public.chat_messages
       (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
     VALUES ($1, $2, $3, $4, 'couple', $5)`,
    [F.threadId, F.eventId, F.vendorId, F.couple, body],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('backfill-couple@drift.test', jsonb_build_object('account_type', 'customer'::text))
     RETURNING id`,
  );
  F.couple = u.rows[0]!.id;

  const vu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('backfill-vendor@drift.test', jsonb_build_object('account_type', 'vendor'::text))
     RETURNING id`,
  );
  F.vendorUser = vu.rows[0]!.id;

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Backfill Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [F.vendorUser],
  );
  F.vendorId = vp.rows[0]!.vendor_profile_id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Backfill Drift Event', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );

  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [F.eventId, F.vendorId, F.couple],
  );
  F.threadId = th.rows[0]!.thread_id;
});

after(async () => {
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the replay is real — migrations applied and the catalog is populated', async () => {
  assert.ok(
    replay.applied > 1000,
    `only ${replay.applied} migrations applied — the replay is broken, so every assertion below would pass for the wrong reason`,
  );
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_proc p
       JOIN pg_namespace n2 ON n2.oid = p.pronamespace AND n2.nspname = 'public'`,
  );
  assert.ok((r.rows[0]?.n ?? 0) > 300, 'suspiciously few public functions in the replay');
});

/* ── 1 · THE OBJECTS EXIST AFTER A REAL REPLAY ────────────────────────────── */

test('all six prod-only functions now exist in the replayed schema', async () => {
  const r = await db.query<{ proname: string }>(
    `SELECT DISTINCT p.proname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname = ANY($1::text[])
      ORDER BY 1`,
    [[...BACK_FILLED_FUNCTIONS]],
  );
  const found = r.rows.map((x) => x.proname);
  const missing = BACK_FILLED_FUNCTIONS.filter((f) => !found.includes(f));
  assert.deepEqual(
    missing,
    [],
    `these live in production but no migration creates them: ${missing.join(', ')}. ` +
      `Anything the replay cannot see is invisible to the exposure freeze, the anon-RPC ` +
      `surface and the schema-drift check simultaneously.`,
  );
});

test('the chat webhook ROW trigger is wired AFTER INSERT on chat_messages', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_triggerdef(t.oid) AS def
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE NOT t.tgisinternal AND t.tgname = 'chat_messages_notify_webhook'`,
  );
  assert.equal(r.rows.length, 1, 'trigger chat_messages_notify_webhook is missing');
  const def = r.rows[0]!.def;
  assert.match(def, /AFTER INSERT ON public\.chat_messages/, `unexpected timing: ${def}`);
  assert.match(def, /FOR EACH ROW/, `unexpected level: ${def}`);
  assert.match(def, /notify_chat_message_webhook\(\)/, `unexpected function: ${def}`);
});

test('the ensure_rls EVENT trigger is wired and enabled', async () => {
  const r = await db.query<{ evtevent: string; evtenabled: string; proname: string }>(
    `SELECT e.evtevent, e.evtenabled, p.proname
       FROM pg_event_trigger e JOIN pg_proc p ON p.oid = e.evtfoid
      WHERE e.evtname = 'ensure_rls'`,
  );
  assert.equal(r.rows.length, 1, 'event trigger ensure_rls is missing');
  assert.equal(r.rows[0]!.evtevent, 'ddl_command_end');
  assert.equal(r.rows[0]!.evtenabled, 'O', 'ensure_rls exists but is disabled');
  assert.equal(r.rows[0]!.proname, 'rls_auto_enable');
});

test('NEUTRALISATION: ensure_rls is live, not inert — a fresh public table gets RLS', async () => {
  // Without this the previous test proves only that a row exists in a catalog.
  // The property that matters is that the trigger RUNS. Note what this does NOT
  // claim: RLS on is not RLS correct, and the grants still ship open.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`CREATE TABLE public.ensure_rls_liveness_probe (id int)`);
    const r = await db.query<{ on: boolean }>(
      `SELECT relrowsecurity AS "on" FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE c.relname = 'ensure_rls_liveness_probe'`,
    );
    assert.equal(
      r.rows[0]?.on,
      true,
      'a table created in public did NOT get RLS enabled — the ensure_rls event trigger is not firing, ' +
        'so back-filling it captured a name and not the behaviour',
    );
  } finally {
    await db.exec(`ROLLBACK`);
  }
});

/* ── 2 · THE CREDENTIAL GUARD ─────────────────────────────────────────────── */

/** Quoted literals of 32+ hex characters inside any `public` function body. */
const HEX_LITERAL_SCAN = `
  SELECT p.proname, m[1] AS hit
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    CROSS JOIN LATERAL regexp_matches(p.prosrc, '''([A-Fa-f0-9]{32,})''', 'g') AS m
   ORDER BY 1
`;

test('🚨 no function body in `public` embeds a 32+ hex-character literal', async () => {
  // That is the exact shape of the credential found inside
  // notify_chat_message_webhook. Measured against the whole replayed corpus
  // (1051 migrations, 390+ functions) this pattern matches NOTHING legitimate —
  // the Crockford alphabet in generate_public_id, the taper version string and
  // the all-zero sentinel UUID all fall outside it — so it costs no false
  // positives and it is the cheapest tripwire that would have caught this.
  //
  // A secret belongs in Supabase Vault (see migration 20270930270000), read at
  // call time, degrading fail-closed when the row is absent.
  const r = await db.query<{ proname: string; hit: string }>(HEX_LITERAL_SCAN);
  const offenders = r.rows.map((x) => `${x.proname} (${x.hit.length} hex chars)`);
  assert.deepEqual(
    offenders,
    [],
    `secret-shaped literal(s) hard-coded in a function body: ${offenders.join(', ')}.\n` +
      `pg_proc.prosrc is world-readable inside the database. Move the value into Vault ` +
      `(vault.decrypted_secrets, read by name) and fail closed when it is missing — never ` +
      `send the request with an empty credential.`,
  );
});

test('NEUTRALISATION: the hex-literal scan really does go red', async () => {
  // A guard nobody has watched fail is not a guard. Plant one and check.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.hex_literal_scan_probe() RETURNS text
      LANGUAGE sql IMMUTABLE AS $probe$
        SELECT 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'::text
      $probe$;
    `);
    const r = await db.query<{ proname: string }>(HEX_LITERAL_SCAN);
    assert.deepEqual(
      r.rows.map((x) => x.proname),
      ['hex_literal_scan_probe'],
      'the scan did not detect a planted 40-hex literal — it is asserting nothing',
    );
  } finally {
    await db.exec(`ROLLBACK`);
  }
});

test('the chat webhook reads its secret from Vault and inlines no header value', async () => {
  const r = await db.query<{ src: string }>(
    `SELECT p.prosrc AS src FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname = 'notify_chat_message_webhook'`,
  );
  const src = r.rows[0]?.src ?? '';
  assert.match(
    src,
    /vault\.decrypted_secrets/,
    'the webhook no longer reads Vault — where is its credential coming from?',
  );
  assert.doesNotMatch(
    src,
    /'x-webhook-secret'\s*,\s*'/,
    "the x-webhook-secret header value is a literal again; it must be a variable read from Vault",
  );
  assert.match(
    src,
    /SET|search_path|RETURN NULL/,
    'sanity: the body did not parse as expected',
  );
});

/* ── 3 · FAIL-CLOSED BEHAVIOUR, EXECUTED ──────────────────────────────────── */

test('vault EMPTY: a chat message fires NO webhook call at all', async () => {
  await clearVault();
  await db.exec(`DELETE FROM net._http_calls`);

  await postMessage('Fail-closed path: no secret configured.');

  const calls = await httpCalls();
  assert.deepEqual(
    calls,
    [],
    'a message row was posted to the network with no credential. The endpoint answers 401, ' +
      'so this is message text leaving the database in exchange for nothing.',
  );
});

test('vault SET: the call goes out with the header taken from Vault', async () => {
  await clearVault();
  await seedVault('notify_webhook_secret', FAKE_VAULT_SECRET);
  await db.exec(`DELETE FROM net._http_calls`);

  await postMessage('Configured path: secret present.');

  const calls = await httpCalls();
  assert.equal(calls.length, 1, 'exactly one webhook call expected');
  assert.equal(calls[0]!.headers['x-webhook-secret'], FAKE_VAULT_SECRET);
  assert.equal(
    calls[0]!.url,
    'https://www.setnayan.com/api/notify',
    'default URL should be the canonical host',
  );
});

test('vault URL override is honoured', async () => {
  await clearVault();
  await seedVault('notify_webhook_secret', FAKE_VAULT_SECRET);
  await seedVault('notify_webhook_url', 'https://example.invalid/api/notify');
  await db.exec(`DELETE FROM net._http_calls`);

  await postMessage('Configured path with an override URL.');

  const calls = await httpCalls();
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'https://example.invalid/api/notify');

  await clearVault();
});

test('a BLANK vault secret is treated as unset, not as a credential', async () => {
  await clearVault();
  await seedVault('notify_webhook_secret', '   ');
  await db.exec(`DELETE FROM net._http_calls`);

  await postMessage('Blank secret must not be sent.');

  assert.deepEqual(
    await httpCalls(),
    [],
    'a whitespace-only Vault value was sent as the credential — that is the fail-OPEN shape',
  );
  await clearVault();
});
