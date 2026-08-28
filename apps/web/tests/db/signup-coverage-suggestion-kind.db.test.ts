/**
 * SIGNUP-SUGGESTION DOSSIERS ARE A DISTINCT KIND, AND RLS DID NOT MOVE.
 *
 * C5 (2026-08-28) reuses `vendor_web_dossiers` for a THIRD purpose (a free,
 * Setnayan-initiated read, tagged `kind = 'signup_suggestion'`) alongside the
 * two it already held (admin verification runs, a vendor's own paid/free
 * runs — both `kind = 'lookup'`, the column's default). This test runs the
 * migration rather than reading it back:
 *
 *   1 · the CHECK constraint refuses any value outside the two allowed ones
 *   2 · an INSERT that names no `kind` (every pre-existing writer's shape)
 *       still lands on the default, `'lookup'` — nothing upstream breaks
 *   3 · a vendor, even the ROW'S OWN vendor, still cannot read or write this
 *       table directly — the table stays admin-only, exactly as before
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function setAuthRole(role: string | null) {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string) {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset() {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function seedVendor(userId: string | null): Promise<string> {
  // A vendor AUTH account is auto-provisioned a bare vendor_profiles row by
  // handle_new_vendor_user() the moment it exists (see
  // vendor-business-slug-mint.db.test.ts) — so for a real userId, find that
  // row and name it rather than inserting a second, colliding one under the
  // vendor_profiles_user_id_key UNIQUE constraint.
  if (userId) {
    const existing = await db.query<{ vendor_profile_id: string }>(
      `SELECT vendor_profile_id FROM vendor_profiles WHERE user_id = $1`,
      [userId],
    );
    if (existing.rows[0]) {
      await db.query(`UPDATE vendor_profiles SET business_name = 'Aurora Blooms' WHERE vendor_profile_id = $1`, [
        existing.rows[0].vendor_profile_id,
      ]);
      return existing.rows[0].vendor_profile_id;
    }
  }
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO vendor_profiles (business_name, user_id) VALUES ('Aurora Blooms', $1)
     RETURNING vendor_profile_id`,
    [userId],
  );
  return r.rows[0]!.vendor_profile_id;
}

test('the migration added kind + suggestion_dismissed_at, kind defaults to lookup', async () => {
  const cols = await db.query<{ column_name: string; column_default: string | null }>(
    `SELECT column_name, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='vendor_web_dossiers'
        AND column_name IN ('kind','suggestion_dismissed_at')`,
  );
  const byName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r.column_default]));
  assert.ok(byName.kind, 'kind column missing');
  assert.match(byName.kind!, /'lookup'/);
  assert.ok('suggestion_dismissed_at' in byName, 'suggestion_dismissed_at column missing');
});

test('the CHECK constraint refuses any kind outside lookup/signup_suggestion', async () => {
  const vendorId = await seedVendor(null);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO vendor_web_dossiers (vendor_profile_id, kind) VALUES ($1, 'anything_else')`,
        [vendorId],
      ),
    /vendor_web_dossiers_kind_check/,
  );
});

test('an insert naming no kind (every pre-existing writer) still lands on lookup', async () => {
  const vendorId = await seedVendor(null);
  const row = await db.query<{ kind: string }>(
    `INSERT INTO vendor_web_dossiers (vendor_profile_id, status) VALUES ($1, 'running')
     RETURNING kind`,
    [vendorId],
  );
  assert.equal(row.rows[0]!.kind, 'lookup');
});

test('a signup_suggestion row can be inserted and resolved', async () => {
  const vendorId = await seedVendor(null);
  const row = await db.query<{ id: number }>(
    `INSERT INTO vendor_web_dossiers
       (vendor_profile_id, status, kind, requested_by, dossier)
     VALUES ($1, 'complete', 'signup_suggestion', NULL, '{"detected_services":["Florist"]}'::jsonb)
     RETURNING id`,
    [vendorId],
  );
  const dossierId = row.rows[0]!.id;
  await db.query(
    `UPDATE vendor_web_dossiers SET suggestion_dismissed_at = now() WHERE id = $1`,
    [dossierId],
  );
  const after = await db.query<{ suggestion_dismissed_at: string | null }>(
    `SELECT suggestion_dismissed_at FROM vendor_web_dossiers WHERE id = $1`,
    [dossierId],
  );
  assert.ok(after.rows[0]!.suggestion_dismissed_at);
});

test('RLS did not move: even the row\'s OWN vendor cannot read or write vendor_web_dossiers', async () => {
  const uid = await createUser('shop-owner@example.com');
  const vendorId = await seedVendor(uid);
  await db.query(
    `INSERT INTO vendor_web_dossiers (vendor_profile_id, status, kind)
     VALUES ($1, 'complete', 'signup_suggestion')`,
    [vendorId],
  );

  try {
    await asUser(uid);
    const readBack = await db.query(
      `SELECT id FROM vendor_web_dossiers WHERE vendor_profile_id = $1`,
      [vendorId],
    );
    assert.equal(readBack.rows.length, 0, 'a vendor must not be able to SELECT its own dossier');

    // RLS filters via USING, so a denied UPDATE is not a throw — it is a
    // no-op that matches zero rows (an RLS denial and an empty read are the
    // same value here). Assert the count, then assert the row is unchanged.
    const upd = await db.query(
      `UPDATE vendor_web_dossiers SET suggestion_dismissed_at = now()
         WHERE vendor_profile_id = $1`,
      [vendorId],
    );
    assert.equal(
      (upd as unknown as { affectedRows?: number }).affectedRows ?? 0,
      0,
      'a vendor must not be able to UPDATE its own dossier',
    );
  } finally {
    await reset();
  }

  // Confirm the row is genuinely untouched — reset() dropped back to the
  // superuser/service context, which bypasses RLS.
  const stillNull = await db.query<{ suggestion_dismissed_at: string | null }>(
    `SELECT suggestion_dismissed_at FROM vendor_web_dossiers WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  assert.equal(stillNull.rows[0]!.suggestion_dismissed_at, null);
});
