/**
 * events column-level UPDATE/INSERT privileges — end-to-end (test:db, every
 * migration replayed into PGlite).
 *
 * THE HOLE THIS LOCKS: `couple_can_update_event` (20260512000000:254) is
 * `FOR UPDATE TO authenticated USING (event_id IN current_couple_event_ids())`.
 * Postgres RLS is ROW-level, never COLUMN-level, and until migration
 * 20271005100000 there was no column-scoped GRANT on public.events — so a host
 * could PATCH ANY column of their own event through PostgREST with the public
 * anon key, bypassing every server action. `authenticated_can_create_event`
 * (WITH CHECK (TRUE)) exposed the same surface at INSERT time.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * A DB test that talks to Postgres as the table OWNER bypasses both RLS and
 * column grants, so every "denied" assertion passes for the wrong reason. This
 * file defends against that three ways:
 *
 *   1. `proves the session is really un-privileged` asserts current_user is
 *      literally 'authenticated' and that the role cannot bypass RLS — it runs
 *      FIRST, so an owner-session regression fails loudly instead of silently
 *      greening the suite.
 *   2. A POSITIVE CONTROL: the same host, in the same session, successfully
 *      UPDATEs a host-editable column. If the role/JWT wiring were broken,
 *      everything would fail and the denials would be meaningless.
 *   3. A DIFFERENTIAL CONTROL: every statement asserted to fail as
 *      `authenticated` is then re-run as `service_role` and asserted to
 *      SUCCEED. That is what makes a denial attributable to the GRANT rather
 *      than to a typo'd column, a missing row, or a CHECK constraint.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { MIGRATIONS_DIR, createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { HOST_EDITABLE_SAMPLE, LOCKED_COLUMNS } from '../../lib/security/events-column-privileges';

const MIGRATION_FILE = '20271005100000_events_column_update_privileges.sql';

let replay: ReplayResult;
let db: PGlite;

let hostUid: string;
let eventId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

/** Impersonate the event's own host: uid claim + role claim + SET ROLE. */
async function asHost(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, hostUid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
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

/** A literal safe for each locked column's type — enough to form a real UPDATE. */
const SAMPLE_VALUE: Record<string, string> = {
  kwento_free_grandfathered: 'TRUE',
  setnayan_ai_active: 'TRUE',
  setnayan_ai_active_until: `'2099-01-01'::timestamptz`,
  setnayan_ai_intro_used: 'FALSE',
  papic_cost_cap_php: '1',
  papic_ltd_cap_php: '1',
  papic_unli_cap_php: '1',
  papic_mini_cap_php: '1',
  adaptive_pricing_mode: `'final_only'`,
  guest_count_locked_at: 'now()',
  final_pax: '1',
  cleared_at: 'now()',
  cleared_by_user_id: 'gen_random_uuid()',
  is_sample: 'TRUE',
  showcase_featured_at: 'now()',
  showcase_feature_rank: '1',
  papic_face_mode: `'mode_a'`,
  bazi_birthdata_consent_at: 'now()',
  pool_gallery_open: 'TRUE',
  live_media_public: 'TRUE',
  photo_delivery_oauth_token_encrypted: `'stolen'`,
  photo_delivery_oauth_expires_at: 'now()',
  photo_delivery_provider: `'google_drive'`,
  photo_delivery_folder_id: `'x'`,
  photo_delivery_folder_name: `'x'`,
  photo_delivery_account_email: `'x@example.com'`,
  photo_delivery_status: `'idle'`,
  photo_delivery_progress_pct: '1',
  photo_delivery_started_at: 'now()',
  photo_delivery_completed_at: 'now()',
  photo_delivery_failed_count: '1',
  photo_delivery_sync_mode: `'manual_release'`,
  photos_released_at: 'now()',
  pakanta_song_r2_key: `'r2://setnayan-vendor-contracts/someone-elses.pdf'`,
  pakanta_song_status: `'ready'`,
  pakanta_song_filename: `'x.mp3'`,
  pakanta_song_delivered_at: 'now()',
  pakanta_song_adopted_as_site_music: 'TRUE',
  photo_wall_photos: `'[]'::jsonb`,
  community_id: 'NULL',
  live_studio_roam_manifest: `'[{"zone":"a"},{"zone":"b"}]'::jsonb`,
  id: '999999',
  event_id: 'gen_random_uuid()',
  public_id: `'S89E-HACKEDHACK'`,
  created_at: 'now()',
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  // ── HARNESS ARTIFACT, not a prod behaviour ────────────────────────────────
  // replay-migrations.ts runs `GRANT ALL ON ALL TABLES IN SCHEMA public TO
  // anon, authenticated, service_role` AFTER the replay loop, to emulate the
  // Supabase default-privileges that normally fire at CREATE TABLE time. That
  // blanket grant re-adds the table-level UPDATE this migration just revoked,
  // so without re-applying we would be testing the pre-fix schema.
  //
  // In prod nothing does this: Supabase default privileges attach when a table
  // is created (events was created in 20260512000000 and got its grant then),
  // and `supabase db push` issues no post-hoc GRANT. Verified against prod —
  // service_role holds its own direct grants, independent of authenticated.
  //
  // We re-execute the REAL migration file (never a reconstruction of it), so
  // what is proven below is the shipped SQL, applied to the fully-replayed
  // production schema. The migration is idempotent: REVOKE then GRANT.
  await db.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_FILE), 'utf8'));

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('colpriv-host@example.com') RETURNING id`,
  );
  hostUid = u.rows[0]!.id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Column Privilege Event', 'birthday') RETURNING event_id`,
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

// ── 0. Meta: the session must genuinely be un-privileged ────────────────────

test('META: the impersonated session is really `authenticated`, not the owner', async () => {
  await asHost();
  const r = await db.query<{ cu: string; bypass: boolean; owner: string }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.events'::regclass) AS owner`,
  );
  const row = r.rows[0]!;
  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every denial below would be vacuous');
  assert.equal(row.bypass, false, 'the authenticated role can BYPASSRLS — the whole suite would be meaningless');
  assert.notEqual(row.owner, 'authenticated', 'authenticated owns public.events — grants would not apply to it');
});

test('META: the catalog agrees with the deny-set (grant actually landed)', async () => {
  await asHost();
  for (const col of LOCKED_COLUMNS) {
    const r = await db.query<{ u: boolean; i: boolean }>(
      `SELECT has_column_privilege('authenticated','public.events',$1,'UPDATE') AS u,
              has_column_privilege('authenticated','public.events',$1,'INSERT') AS i`,
      [col],
    );
    assert.equal(r.rows[0]!.u, false, `authenticated still holds UPDATE on ${col}`);
    assert.equal(r.rows[0]!.i, false, `authenticated still holds INSERT on ${col}`);
  }
  // anon too — the anon role held the same blanket grant before the migration.
  for (const col of ['live_studio_roam_manifest', 'kwento_free_grandfathered', 'is_sample']) {
    const r = await db.query<{ u: boolean }>(
      `SELECT has_column_privilege('anon','public.events',$1,'UPDATE') AS u`,
      [col],
    );
    assert.equal(r.rows[0]!.u, false, `anon still holds UPDATE on ${col}`);
  }
});

// ── 1. Positive control — legitimate host edits still work ──────────────────

test('a host CAN still update every host-editable column', async () => {
  await asHost();
  for (const col of HOST_EDITABLE_SAMPLE) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated','public.events',$1,'UPDATE') AS ok`,
      [col],
    );
    assert.equal(r.rows[0]!.ok, true, `${col} lost its UPDATE grant — a real host edit is broken`);
  }
  // …and a real write really lands, through RLS, as the host.
  const err = await tryQuery(
    `UPDATE public.events
        SET display_name = 'Renamed By Host', venue_name = 'Manila Hotel', slug = 'colpriv-host-slug'
      WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(err, null, `legitimate host UPDATE was rejected: ${err}`);

  const check = await db.query<{ display_name: string }>(
    `SELECT display_name FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(check.rows[0]!.display_name, 'Renamed By Host');
});

// ── 2. The lock — every denied column, with a differential control ──────────

test('a host CANNOT update any locked column (and service_role still can)', async () => {
  const failures: string[] = [];

  for (const col of LOCKED_COLUMNS) {
    const value = SAMPLE_VALUE[col];
    assert.ok(value, `no sample value defined for locked column ${col}`);
    const stmt = `UPDATE public.events SET ${col} = ${value} WHERE event_id = $1`;

    await asHost();
    const hostErr = await tryQuery(stmt, [eventId]);
    if (hostErr === null) {
      failures.push(`${col}: host UPDATE SUCCEEDED (column is still writable)`);
      continue;
    }
    if (!/permission denied/i.test(hostErr)) {
      failures.push(`${col}: rejected, but not by privileges → ${hostErr}`);
      continue;
    }

    // DIFFERENTIAL: the identical statement must work as service_role. Without
    // this, a denial could just mean the statement itself was malformed.
    if (col === 'id' || col === 'event_id' || col === 'public_id') continue; // identity: skip the mutation
    await asService();
    const svcErr = await tryQuery(stmt, [eventId]);
    if (svcErr !== null) {
      failures.push(`${col}: service_role ALSO failed (${svcErr}) — the denial above proves nothing`);
    }
  }

  await reset();
  assert.deepEqual(failures, [], `column-privilege failures:\n  ${failures.join('\n  ')}`);
});

// ── 3. The Live Studio manifest hole, specifically ──────────────────────────

test('the Live Studio roam manifest is closed at the WRITE layer', async () => {
  await asHost();
  const err = await tryQuery(
    `UPDATE public.events
        SET live_studio_roam_manifest = '[{"z":1},{"z":2},{"z":3}]'::jsonb
      WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(err, 'a host could still publish a free multi-cam manifest');
  assert.match(err as string, /permission denied/i);

  // The provisioning path (service-role mirrorRoamManifest) is unaffected.
  await asService();
  const svc = await tryQuery(
    `UPDATE public.events SET live_studio_roam_manifest = '[{"z":1}]'::jsonb WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(svc, null, `service-role manifest write broke: ${svc}`);
  await reset();
});

// ── 4. The INSERT vector — an UPDATE-only fix is defeated by POSTing ────────

test('a host CANNOT create an event with a locked column pre-set', async () => {
  await asHost();
  for (const col of ['setnayan_ai_active', 'kwento_free_grandfathered', 'is_sample']) {
    const err = await tryQuery(
      `INSERT INTO public.events (display_name, event_type, ${col})
       VALUES ('Insert Vector', 'birthday', TRUE)`,
    );
    assert.ok(err, `a host INSERTed an event with ${col} pre-set — the INSERT self-grant vector is open`);
    assert.match(err as string, /permission denied/i, `${col}: ${err}`);
  }

  // A plain create (no locked columns named) must still be allowed.
  const ok = await tryQuery(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Plain Create', 'birthday')`,
  );
  assert.equal(ok, null, `an ordinary event INSERT was broken by the grant: ${ok}`);
  await reset();
});

// ── 5. master_qr_token cross-event collision ────────────────────────────────

test('master_qr_token is unique — a host cannot collide with another event', async () => {
  await reset();
  const victim = await db.query<{ event_id: string; master_qr_token: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Victim Event', 'birthday') RETURNING event_id, master_qr_token`,
  );
  const victimToken = victim.rows[0]!.master_qr_token;

  // The host may still ROTATE their own token (the column stays host-writable).
  await asHost();
  const rotate = await tryQuery(
    `UPDATE public.events SET master_qr_token = encode(gen_random_bytes(16),'hex') WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(rotate, null, `legitimate QR rotation broke: ${rotate}`);

  // …but may NOT point it at the victim's token.
  const collide = await tryQuery(`UPDATE public.events SET master_qr_token = $2 WHERE event_id = $1`, [
    eventId,
    victimToken,
  ]);
  assert.ok(collide, 'a host collided their master_qr_token with another event');
  assert.match(
    collide as string,
    /duplicate key|unique/i,
    `expected a unique-violation, got: ${collide}`,
  );
  await reset();
});
