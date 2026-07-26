/**
 * SEC-2 — guests must not be able to SELECT the secrets on the events row.
 * End-to-end (test:db, every migration replayed into PGlite).
 *
 * THE HOLE THIS CLOSES: `public.current_event_ids()` (20260512000000:178) is
 * `SELECT event_id FROM event_members WHERE user_id = auth.uid()` — no
 * member_type filter. `event_member_can_read` (20260512000000:242) is
 * `FOR SELECT TO authenticated USING (event_id IN current_event_ids())`, and RLS
 * is ROW-level, so a plain wedding GUEST (member_type='guest', seeded by
 * app/join/[eventId]) reads the ENTIRE events row — including `master_qr_token`
 * (the crew-pairing credential) and the Google Drive OAuth token. Migration
 * 20270920030000 fixed that pattern on seven other tables but left events on it.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * A DB test that talks to Postgres as the table OWNER bypasses both RLS and
 * column grants, so every "denied" assertion passes for the wrong reason. This
 * repo has been bitten by that twice. Four defences:
 *
 *   1. `META: the impersonated session is really un-privileged` asserts
 *      current_user is literally 'authenticated', that the role has no
 *      BYPASSRLS, and that it does not own public.events. It runs FIRST.
 *   2. A POSITIVE CONTROL: the same guest, in the same session, successfully
 *      SELECTs the guest-visible slice. If the role/JWT wiring were broken,
 *      everything would fail and the denials would be meaningless.
 *   3. A DIFFERENTIAL CONTROL: every statement asserted to fail as
 *      `authenticated` is re-run as `service_role` and asserted to SUCCEED.
 *      That makes a denial attributable to the GRANT rather than to a typo'd
 *      column, a missing row, or an RLS row filter.
 *   4. An RLS CONTROL: the test proves the guest's membership really does open
 *      the row (they read display_name off it), so "no rows" can never be
 *      mistaken for "column denied".
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { MIGRATIONS_DIR, createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import {
  GUEST_READABLE_SAMPLE,
  LOCKED_SELECT_COLUMNS,
  NOT_DENIED_FOR_SELECT,
  SELECT_MIGRATION_FILE,
} from '../../lib/security/events-column-select-privileges';

let replay: ReplayResult;
let db: PGlite;

let hostUid: string;
let guestUid: string;
let coordinatorUid: string;
let strangerUid: string;
let eventId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

/** Impersonate a signed-in user: uid claim + role claim + SET ROLE. */
async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
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

async function rowCount(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query(sql, params);
  return r.rows.length;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  // ── HARNESS ARTIFACT, not a prod behaviour ────────────────────────────────
  // replay-migrations.ts runs `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,
  // authenticated, service_role` AFTER the replay loop, to emulate the Supabase
  // default-privileges that normally fire at CREATE TABLE time. That blanket
  // grant re-adds the table-level SELECT this migration just revoked, so without
  // re-applying we would be testing the pre-fix schema.
  //
  // In prod nothing does this: Supabase default privileges attach when a table is
  // created (events was created in 20260512000000) and `supabase db push` issues
  // no post-hoc GRANT.
  //
  // We re-execute the REAL migration file (never a reconstruction of it), so what
  // is proven below is the shipped SQL applied to the fully-replayed production
  // schema. The migration is idempotent: REVOKE then GRANT.
  await db.exec(readFileSync(join(MIGRATIONS_DIR, SELECT_MIGRATION_FILE), 'utf8'));

  const mk = async (email: string): Promise<string> => {
    const u = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
      [email],
    );
    return u.rows[0]!.id;
  };
  hostUid = await mk('sec2-host@example.com');
  guestUid = await mk('sec2-guest@example.com');
  coordinatorUid = await mk('sec2-coordinator@example.com');
  strangerUid = await mk('sec2-stranger@example.com');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, venue_name)
     VALUES ('SEC-2 Event', 'birthday', 'Manila Hotel') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  // A real Drive OAuth token on the row — the thing the guest must not reach.
  await db.query(
    `UPDATE public.events
        SET photo_delivery_oauth_token_encrypted = 'enc:the-couples-drive-refresh-token',
            photo_delivery_oauth_expires_at = now() + interval '1 hour'
      WHERE event_id = $1`,
    [eventId],
  );

  for (const [uid, type] of [
    [hostUid, 'couple'],
    [guestUid, 'guest'],
    [coordinatorUid, 'coordinator'],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [eventId, uid, type],
    );
  }
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

// ── 0. Meta: the session must genuinely be un-privileged ────────────────────

test('META: the impersonated session is really `authenticated`, not the owner', async () => {
  await asUser(guestUid);
  const r = await db.query<{ cu: string; bypass: boolean; owner: string }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.events'::regclass) AS owner`,
  );
  const row = r.rows[0]!;
  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every denial below would be vacuous');
  assert.equal(row.bypass, false, 'the authenticated role can BYPASSRLS — the whole suite would be meaningless');
  assert.notEqual(row.owner, 'authenticated', 'authenticated owns public.events — grants would not apply to it');

  // RLS must actually be ON, or the row filter below proves nothing either.
  const rls = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.events'::regclass`,
  );
  assert.equal(rls.rows[0]!.on, true, 'RLS is disabled on public.events');
  await reset();
});

test('META: the leak this fixes is real — the guest IS admitted by the row policy', async () => {
  // current_event_ids() has no member_type filter, so the guest is a "member".
  // If this ever stops being true the column grant is belt-only, and the test
  // that a guest cannot read the token would pass for the wrong reason.
  await asUser(guestUid);
  const admitted = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.current_event_ids() AS t(id) WHERE t.id = $1`,
    [eventId],
  );
  assert.equal(
    admitted.rows[0]!.n,
    1,
    'current_event_ids() no longer admits a plain guest — re-read this test: the denial below may now be a row filter, not the grant',
  );
  await reset();
});

test('META: the catalog agrees with the deny-set (the revoke actually landed)', async () => {
  for (const col of LOCKED_SELECT_COLUMNS) {
    const r = await db.query<{ a: boolean; n: boolean; s: boolean }>(
      `SELECT has_column_privilege('authenticated','public.events',$1,'SELECT') AS a,
              has_column_privilege('anon','public.events',$1,'SELECT') AS n,
              has_column_privilege('service_role','public.events',$1,'SELECT') AS s`,
      [col],
    );
    assert.equal(r.rows[0]!.a, false, `authenticated still holds SELECT on ${col}`);
    assert.equal(r.rows[0]!.n, false, `anon still holds SELECT on ${col}`);
    assert.equal(r.rows[0]!.s, true, `service_role LOST SELECT on ${col} — the app's only read path is broken`);
  }
});

// ── 1. Positive control — the guest experience still works ──────────────────

test('a GUEST can still read the event fields the guest surfaces need', async () => {
  await asUser(guestUid);

  // Exactly the slice app/_components/account-switcher/get-switcher-data.ts and
  // lib/events.ts fetchUserEvents read. A single denied column fails the whole
  // statement, so this is a real end-to-end assertion, not a privilege lookup.
  const cols = GUEST_READABLE_SAMPLE.join(', ');
  const err = await tryQuery(`SELECT ${cols} FROM public.events WHERE event_id = $1`, [eventId]);
  assert.equal(err, null, `the guest-visible slice was rejected: ${err}`);

  const r = await db.query<{ display_name: string; venue_name: string }>(
    `SELECT display_name, venue_name FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows.length, 1, 'the guest can no longer see the event row at all — switcher/library would go blank');
  assert.equal(r.rows[0]!.display_name, 'SEC-2 Event');
  assert.equal(r.rows[0]!.venue_name, 'Manila Hotel');
  await reset();
});

test('a GUEST can still read the event through the PostgREST embed shape', async () => {
  // lib/events.ts fetchUserEvents is `event_members → events:event_id (…)`.
  // PostgREST resolves an embed as a join, so the events side is still gated by
  // events' own RLS *and* column privileges. Same join, same roles.
  await asUser(guestUid);
  const r = await db.query<{ member_type: string; display_name: string }>(
    `SELECT em.member_type, e.display_name, e.event_date, e.monogram_text, e.concierge_status
       FROM public.event_members em
       JOIN public.events e ON e.event_id = em.event_id
      WHERE em.user_id = $1`,
    [guestUid],
  );
  assert.equal(r.rows.length, 1, 'the guest embed returned nothing — the switcher list would be empty');
  assert.equal(r.rows[0]!.member_type, 'guest');
  assert.equal(r.rows[0]!.display_name, 'SEC-2 Event');
  await reset();
});

// ── 2. The lock — with a differential control on every denial ───────────────

test('a GUEST CANNOT read any denied column (and service_role still can)', async () => {
  const failures: string[] = [];

  for (const col of LOCKED_SELECT_COLUMNS) {
    const stmt = `SELECT ${col} FROM public.events WHERE event_id = $1`;

    await asUser(guestUid);
    const guestErr = await tryQuery(stmt, [eventId]);
    if (guestErr === null) {
      failures.push(`${col}: GUEST SELECT SUCCEEDED — the credential is still readable`);
      continue;
    }
    if (!/permission denied/i.test(guestErr)) {
      failures.push(`${col}: rejected, but not by privileges → ${guestErr}`);
      continue;
    }

    // DIFFERENTIAL: the identical statement must work as service_role. Without
    // this a denial could mean the column name is a typo or the row is missing.
    await asService();
    const svcErr = await tryQuery(stmt, [eventId]);
    if (svcErr !== null) {
      failures.push(`${col}: service_role ALSO failed (${svcErr}) — the denial above proves nothing`);
    }
  }

  await reset();
  assert.deepEqual(failures, [], `guest-read failures:\n  ${failures.join('\n  ')}`);
});

test('the guest cannot reach master_qr_token by any PostgREST-expressible route', async () => {
  const attacks: Array<[string, string]> = [
    ['select=*', `SELECT * FROM public.events WHERE event_id = $1`],
    [
      'select=master_qr_token',
      `SELECT master_qr_token FROM public.events WHERE event_id = $1`,
    ],
    [
      'blind-search filter (?master_qr_token=like.a*)',
      `SELECT event_id FROM public.events WHERE event_id = $1 AND master_qr_token LIKE 'a%'`,
    ],
    [
      'order oracle (?order=master_qr_token)',
      `SELECT event_id FROM public.events WHERE event_id = $1 ORDER BY master_qr_token`,
    ],
    [
      'aggregate leak (?select=master_qr_token.max())',
      `SELECT max(master_qr_token) FROM public.events WHERE event_id = $1`,
    ],
    [
      'embed from a child table (?select=*,events(master_qr_token))',
      `SELECT e.master_qr_token FROM public.event_members em
         JOIN public.events e ON e.event_id = em.event_id WHERE em.user_id = $1`,
    ],
  ];

  const failures: string[] = [];
  for (const [label, sql] of attacks) {
    await asUser(guestUid);
    const param = label.startsWith('embed') ? guestUid : eventId;
    const err = await tryQuery(sql, [param]);
    if (err === null) {
      failures.push(`${label}: SUCCEEDED`);
      continue;
    }
    if (!/permission denied/i.test(err)) {
      failures.push(`${label}: rejected, but not by privileges → ${err}`);
    }
  }
  await reset();
  assert.deepEqual(failures, [], `token-exfiltration routes still open:\n  ${failures.join('\n  ')}`);
});

test('the Drive OAuth token is unreachable even though the guest can see the row', async () => {
  await asUser(guestUid);
  // The row IS visible (RLS admits the guest) — proving the denial below is the
  // column grant and not a row filter.
  assert.equal(
    await rowCount(`SELECT event_id FROM public.events WHERE event_id = $1`, [eventId]),
    1,
    'row filter, not column grant — this test would prove the wrong thing',
  );

  const err = await tryQuery(
    `SELECT photo_delivery_oauth_token_encrypted FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(err, 'a guest read the Drive OAuth token');
  assert.match(err as string, /permission denied/i);

  await asService();
  const svc = await db.query<{ t: string }>(
    `SELECT photo_delivery_oauth_token_encrypted AS t FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(svc.rows[0]!.t, 'enc:the-couples-drive-refresh-token', 'service_role lost the Drive token read');
  await reset();
});

// ── 3. The other principals ─────────────────────────────────────────────────

test('the COUPLE keeps full access to everything except the credentials', async () => {
  await asUser(hostUid);

  // Everything a host surface reads with the authenticated client — including
  // the private-but-host-read columns this fix deliberately does NOT close.
  const hostCols = NOT_DENIED_FOR_SELECT.map((c) => c.column).join(', ');
  const readErr = await tryQuery(
    `SELECT ${hostCols}, display_name, event_date, slug, master_qr_token_rotated_at
       FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(readErr, null, `a host read broke: ${readErr}`);

  // Writes are untouched by this migration — including the master QR rotation,
  // which UPDATEs the token and RETURNs only the rotated_at stamp (exactly what
  // app/dashboard/[eventId]/event-qr/actions.ts:54 does).
  const rotate = await tryQuery(
    `UPDATE public.events
        SET master_qr_token = 'ffffffffffffffffffffffffffffffff',
            master_qr_token_rotated_at = now()
      WHERE event_id = $1
      RETURNING event_id, master_qr_token_rotated_at`,
    [eventId],
  );
  assert.equal(rotate, null, `the host QR-rotate action broke: ${rotate}`);

  // …but the host still cannot READ the token back. That is intentional: the
  // Event QR page reads it through the service-role client.
  const readBack = await tryQuery(
    `SELECT master_qr_token FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(readBack, 'the host can still SELECT master_qr_token as `authenticated`');
  assert.match(readBack as string, /permission denied/i);
  await reset();
});

test('a COORDINATOR keeps their event-context read and loses the credentials', async () => {
  await asUser(coordinatorUid);
  const ok = await tryQuery(
    `SELECT display_name, event_date, venue_name, venue_address FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(ok, null, `coordinator lost their event-context read: ${ok}`);
  assert.equal(
    await rowCount(`SELECT event_id FROM public.events WHERE event_id = $1`, [eventId]),
    1,
    'coordinator can no longer see the event row',
  );

  const denied = await tryQuery(
    `SELECT master_qr_token FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(denied, 'a coordinator read master_qr_token');
  assert.match(denied as string, /permission denied/i);
  await reset();
});

test('a STRANGER sees no rows at all (RLS unchanged)', async () => {
  await asUser(strangerUid);
  assert.equal(
    await rowCount(`SELECT event_id FROM public.events WHERE event_id = $1`, [eventId]),
    0,
    'a non-member read the event row — RLS regressed',
  );
  await reset();
});

test('ANON reads nothing and holds no credential column', async () => {
  await asAnon();
  // No permissive SELECT policy on events names `anon`, so the row filter is
  // total. Belt: anon also lost the column grant (asserted in the META test).
  assert.equal(
    await rowCount(`SELECT event_id FROM public.events WHERE event_id = $1`, [eventId]),
    0,
    'anon read an event row — a permissive anon SELECT policy appeared',
  );
  const err = await tryQuery(`SELECT master_qr_token FROM public.events`);
  assert.ok(err, 'anon holds SELECT on master_qr_token');
  assert.match(err as string, /permission denied/i);
  await reset();
});

test('ADMIN is unaffected — it never read events as `authenticated`', async () => {
  // There is no is_admin() arm in ANY SELECT policy on public.events (verified
  // against the replayed catalog below), so every admin-console read already
  // goes through the service-role client. Assert both halves.
  const arms = await db.query<{ policyname: string; qual: string }>(
    `SELECT policyname, coalesce(qual,'') AS qual FROM pg_policies
      WHERE schemaname='public' AND tablename='events' AND cmd='SELECT'`,
  );
  assert.ok(arms.rows.length >= 1, 'no SELECT policies on events at all');
  for (const row of arms.rows) {
    assert.ok(
      !/is_admin/.test(row.qual),
      `${row.policyname} gained an is_admin() arm — admins would now read events as \`authenticated\` and lose the credentials`,
    );
  }

  await asService();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows[0]!.n, 1, 'service_role (the admin console client) cannot read events');
  await reset();
});

// ── 4. Rot guards ───────────────────────────────────────────────────────────

test('every events column is either granted to authenticated or deliberately denied', async () => {
  // The allow-list is a snapshot taken at apply time. A column added to
  // public.events after this migration is NOT granted — fail-closed, but it
  // breaks a host read with 42501. This is the guard that names the fix.
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='events' ORDER BY ordinal_position`,
  );
  const orphans: string[] = [];
  for (const { column_name } of cols.rows) {
    if (LOCKED_SELECT_COLUMNS.includes(column_name)) continue;
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated','public.events',$1,'SELECT') AS ok`,
      [column_name],
    );
    if (!r.rows[0]!.ok) orphans.push(column_name);
  }
  assert.deepEqual(
    orphans,
    [],
    `these events columns are neither SELECT-granted nor deliberately denied — add to the ADD COLUMN migration:\n` +
      `  GRANT SELECT (${orphans.join(', ')}) ON public.events TO authenticated, anon;`,
  );
});

test('no view or SECURITY DEFINER function re-exposes a denied column', async () => {
  // A view with security_invoker=false runs as its owner and would bypass the
  // grant entirely; a SECURITY DEFINER function would do the same.
  const views = await db.query<{ relname: string; cols: string }>(
    `SELECT c.relname,
            (SELECT string_agg(column_name, ',') FROM information_schema.columns
              WHERE table_schema='public' AND table_name=c.relname) AS cols
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('v','m')
        AND pg_get_viewdef(c.oid) ~* '\\mevents\\M'`,
  );
  for (const v of views.rows) {
    for (const col of LOCKED_SELECT_COLUMNS) {
      assert.ok(
        !(v.cols ?? '').split(',').includes(col),
        `view ${v.relname} projects ${col} — a definer view bypasses the column grant`,
      );
    }
  }

  const fns = await db.query<{ proname: string }>(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.prosecdef
        AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
             OR has_function_privilege('anon', p.oid, 'EXECUTE'))
        AND pg_get_functiondef(p.oid) ~* '(master_qr_token|photo_delivery_oauth)'`,
  );
  assert.deepEqual(
    fns.rows.map((r) => r.proname),
    [],
    'a SECURITY DEFINER function reachable by authenticated/anon touches a denied column — it bypasses the grant',
  );
});

test('events is not in the realtime publication (a broadcast would ship the whole row)', async () => {
  const r = await db.query(
    `SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='events'`,
  );
  assert.equal(
    r.rows.length,
    0,
    'events joined supabase_realtime — Realtime payloads are not filtered by column grants; re-audit before shipping',
  );
});
