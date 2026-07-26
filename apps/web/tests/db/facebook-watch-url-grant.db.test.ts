/**
 * events.panood_watch_url_facebook — the column-GRANT proof (test:db, every
 * migration replayed into PGlite).
 *
 * ── THE TRAP THIS EXISTS FOR ────────────────────────────────────────────────
 * Migration 20271005100000 REVOKEd table-level UPDATE/INSERT on public.events
 * from authenticated + anon and granted back a COMPUTED allow-list — "every
 * column MINUS the deny-set" — snapshotted at APPLY TIME. Any column added
 * afterwards is therefore NOT granted: a host's save is rejected with 42501 and
 * the feature is silently dead. Fail-closed, so nothing leaks; invisible, so
 * nothing screams. 20271006100000 carries the prescribed
 * `GRANT UPDATE (col), INSERT (col) … TO authenticated` and this file proves it.
 *
 * ── WHY THE `before` BLOCK REBUILDS THE PRIVILEGE STATE ─────────────────────
 * Re-executing 20271005100000 on its own does NOT restore prod: it recomputes
 * its allow-list from the LIVE catalog, which by then already contains
 * panood_watch_url_facebook, so it would grant the very column under test and
 * the migration's own GRANT would go untested.
 *
 * So we reproduce the real ORDERING with the REAL migration files, never a
 * reconstruction: drop the column → re-run 20271005100000 (UPDATE/INSERT
 * snapshot taken WITHOUT it, exactly as on the day it ran) → run 20271006100000
 * (re-adds the column and carries its UPDATE/INSERT grant) → re-run
 * 20271007100000 (the SELECT allow-list, which in prod ran AFTER the column
 * existed and therefore covers it).
 *
 * That last step is not optional. 20271006100000 grants UPDATE and INSERT only;
 * SELECT on the column comes from 20271007100000. Verified against prod
 * 2026-07-26: `has_column_privilege('authenticated', 'public.events',
 * 'panood_watch_url_facebook', 'SELECT')` is TRUE there. It used to be possible
 * to omit this step because replay-migrations.ts ended with a blanket
 * `GRANT ALL ON ALL TABLES ... TO anon, authenticated`, which silently undid
 * every REVOKE the migrations performed. That blanket grant is gone (Supabase's
 * real behaviour is ALTER DEFAULT PRIVILEGES at CREATE time, now declared in the
 * harness bootstrap), so the read-back below needs the genuine SELECT grant.
 *
 * ── WHY IT IS NOT VACUOUS ───────────────────────────────────────────────────
 *   • A META test asserts current_user is literally 'authenticated' and cannot
 *     bypass RLS, so a denial is never just an owner session behaving oddly.
 *   • A TRAP PROBE — a throwaway column added after the snapshot and deliberately
 *     NOT granted — is asserted UNWRITABLE. That is what makes the success of
 *     panood_watch_url_facebook attributable to its GRANT rather than to the
 *     harness having handed everything out again.
 *   • A DIFFERENTIAL control: every statement asserted to fail as anon is re-run
 *     as service_role and asserted to SUCCEED.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { MIGRATIONS_DIR, createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

const PRIVILEGE_MIGRATION = '20271005100000_events_column_update_privileges.sql';
const FACEBOOK_MIGRATION = '20271006100000_events_facebook_watch_url.sql';
/** SELECT allow-list — ran AFTER the column existed in prod, so it covers it. */
const SELECT_PRIVILEGE_MIGRATION = '20271007100000_events_column_select_privileges.sql';

/** A column added after the privilege snapshot that is deliberately NOT granted. */
const TRAP_PROBE = 'facebook_grant_trap_probe';

const FB_URL = 'https://www.facebook.com/watch/?v=1234567890123456';

let replay: ReplayResult;
let db: PGlite;

let hostUid: string;
let eventId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function asHost(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, hostUid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('anon');
  await db.exec(`SET ROLE anon`);
}

async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

/** Run a statement, returning the error message (or null when it succeeded). */
async function tryQuery(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

async function storedFacebookUrl(): Promise<string | null> {
  const r = await db.query<{ v: string | null }>(
    `SELECT panood_watch_url_facebook AS v FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  return r.rows[0]?.v ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  // Reproduce the prod ordering (see the header). The column is dropped so the
  // privilege migration's allow-list is computed WITHOUT it, exactly as it was
  // on the day it ran.
  await db.exec(`ALTER TABLE public.events DROP COLUMN IF EXISTS panood_watch_url_facebook;`);
  await db.exec(readFileSync(join(MIGRATIONS_DIR, PRIVILEGE_MIGRATION), 'utf8'));

  // The control: a column that lands after the snapshot with no GRANT of its own.
  await db.exec(`ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ${TRAP_PROBE} TEXT;`);

  // …and now the migration under test.
  await db.exec(readFileSync(join(MIGRATIONS_DIR, FACEBOOK_MIGRATION), 'utf8'));

  // Finally the SELECT allow-list, which in prod ran after the column existed.
  // Without it the host can WRITE the column but not read it back, and this
  // suite's read-back would fail on a permission error rather than on content.
  // (The TRAP_PROBE only ever asserts UPDATE, so re-granting SELECT broadly
  // here does not weaken the control.)
  await db.exec(readFileSync(join(MIGRATIONS_DIR, SELECT_PRIVILEGE_MIGRATION), 'utf8'));

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('fbwatch-host@example.com') RETURNING id`,
  );
  hostUid = u.rows[0]!.id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Dual Stream Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [eventId, hostUid],
  );
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

// ── 0. Meta ─────────────────────────────────────────────────────────────────

test('META: the impersonated session is really `authenticated`, not the owner', async () => {
  await asHost();
  const r = await db.query<{ cu: string; bypass: boolean; owner: string }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.events'::regclass) AS owner`,
  );
  const row = r.rows[0]!;
  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every assertion below is vacuous');
  assert.equal(row.bypass, false, 'the authenticated role can BYPASSRLS — the suite is meaningless');
  assert.notEqual(row.owner, 'authenticated', 'authenticated owns public.events — grants would not apply');
  await reset();
});

test('META: the trap is really reproduced — an un-granted new column is unwritable', async () => {
  // If this passes, the harness state matches prod: columns added after
  // 20271005100000 are NOT writable unless a migration grants them. That is what
  // makes the next test's success attributable to the GRANT and nothing else.
  await asHost();
  const priv = await db.query<{ u: boolean }>(
    `SELECT has_column_privilege('authenticated','public.events',$1,'UPDATE') AS u`,
    [TRAP_PROBE],
  );
  assert.equal(
    priv.rows[0]!.u,
    false,
    'the probe column is writable — the blanket GRANT ALL was not undone, so this whole suite proves nothing',
  );

  const err = await tryQuery(
    `UPDATE public.events SET ${TRAP_PROBE} = 'x' WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(err, 'an un-granted column was writable by a host');
  assert.match(err as string, /permission denied/i);
  await reset();
});

// ── 1. The grant itself ─────────────────────────────────────────────────────

test('a HOST can actually write panood_watch_url_facebook (the #3715 grant trap is handled)', async () => {
  await asHost();

  const priv = await db.query<{ u: boolean; i: boolean }>(
    `SELECT has_column_privilege('authenticated','public.events','panood_watch_url_facebook','UPDATE') AS u,
            has_column_privilege('authenticated','public.events','panood_watch_url_facebook','INSERT') AS i`,
  );
  assert.equal(priv.rows[0]!.u, true, 'authenticated has no UPDATE grant — the host save is a silent no-op');
  assert.equal(priv.rows[0]!.i, true, 'authenticated has no INSERT grant — a create-with-value path would 42501');

  const err = await tryQuery(
    `UPDATE public.events SET panood_watch_url_facebook = $2 WHERE event_id = $1`,
    [eventId, FB_URL],
  );
  assert.equal(err, null, `the host's Facebook watch-link save was rejected: ${err}`);
  assert.equal(await storedFacebookUrl(), FB_URL, 'the write was accepted but nothing landed');
  await reset();
});

test('the YouTube column is untouched — the existing single-stream save still works', async () => {
  await asHost();
  const err = await tryQuery(
    `UPDATE public.events SET panood_watch_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(err, null, `the YouTube watch-url save regressed: ${err}`);
  await reset();
});

// ── 2. anon stays shut ──────────────────────────────────────────────────────

test('anon CANNOT write the new column (and service_role still can)', async () => {
  // Read the baseline as the owner: the events SELECT policy is TO authenticated,
  // so reading under SET ROLE anon would return no row and compare null-to-null.
  await reset();
  const baseline = await storedFacebookUrl();
  assert.equal(baseline, FB_URL, 'precondition: the host write from the previous test should still be stored');

  await asAnon();
  const privileged = await db.query<{ u: boolean }>(
    `SELECT has_column_privilege('anon','public.events','panood_watch_url_facebook','UPDATE') AS u`,
  );
  assert.equal(privileged.rows[0]!.u, false, 'anon holds UPDATE on the new column');

  const anonErr = await tryQuery(
    `UPDATE public.events SET panood_watch_url_facebook = 'https://fb.watch/anonforged/'
      WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(anonErr, 'the public anon key could write a Facebook link onto a wedding page');
  assert.match(anonErr as string, /permission denied/i);

  await reset();
  assert.equal(await storedFacebookUrl(), baseline, 'the anon write changed the stored value');

  // DIFFERENTIAL — the identical statement must succeed as service_role, so the
  // denial above is the GRANT and not a typo'd column or a missing row.
  await asService();
  const svcErr = await tryQuery(
    `UPDATE public.events SET panood_watch_url_facebook = $2 WHERE event_id = $1`,
    [eventId, FB_URL],
  );
  assert.equal(svcErr, null, `service_role also failed (${svcErr}) — the denial above proves nothing`);
  await reset();
});
