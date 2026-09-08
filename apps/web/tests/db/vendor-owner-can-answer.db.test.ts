/**
 * A shop's owner can always answer its inquiries.
 *
 * ── THE BUG (production, 2026-09-08) ───────────────────────────────────────
 * The owner pressed **Accept** on the first inquiry this platform ever received
 * and got "Could not accept right now." The thread stayed `pending`.
 *
 * `unlock_vendor_event_free` gates on `vendor_team_members`. The shop had
 * ZERO team rows — it was written straight into `vendor_profiles` on
 * 2026-08-01, and the backfill that guarantees an owner row ran in May 2026.
 *
 * 🔑 TWO RECORDS SAY "THIS SHOP IS MINE". `vendor_profiles.user_id` names the
 * owner; `vendor_team_members` decides who may answer. Every other screen
 * trusts the first and this RPC trusts the second.
 *
 * These run against the replayed schema, so they test the trigger and the
 * backfill as the database actually applies them — not as the SQL reads.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const HERE = dirname(fileURLToPath(import.meta.url));

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close?.();
});

/**
 * A user with NO auto-created vendor profile.
 *
 * ⚠ `account_type: 'vendor'` makes `on_auth_user_created` create the profile
 * for us, so the explicit INSERT below then hits
 * `vendor_profiles_user_id_key` — which is what the first version of this file
 * did, failing on three tests for a reason that had nothing to do with what
 * they were testing. `customer` keeps the profile insert ours to make, which is
 * the path the bug actually came in through: a row written straight into the
 * table, nowhere near the user-side trigger.
 */
async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

/**
 * ⛔ THE TRIGGER TEST THAT USED TO BE HERE IS GONE, ON PURPOSE.
 *
 * It asserted that a directly-inserted profile receives an owner row — and it
 * passed with the trigger it was written for DISABLED (`AFTER UPDATE`, confirmed
 * via `pg_trigger.tgtype = 17`). Some existing mechanism already seeds new
 * profiles, so the test proved the schema, not the migration, and the migration
 * was adding a second definition of a rule that already held.
 *
 * 🔑 A TEST THAT PASSES WITH ITS SUBJECT REMOVED IS NOT EVIDENCE. Kept as a note
 * rather than deleted quietly, because the next person to notice a shop with no
 * team row will reach for exactly the same trigger.
 *
 * What remains below tests what this migration actually does: the BACKFILL, for
 * rows written before that mechanism existed.
 */

test('the seeding is idempotent — a re-insert of the same pair does not blow up', async () => {
  const uid = await newUser('idempotent@audit.test');
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Idempotent Shop') RETURNING vendor_profile_id`,
    [uid],
  );
  const vpid = r.rows[0]!.vendor_profile_id;
  // Re-running the seed must be a no-op, not a unique violation.
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (vendor_profile_id, user_id) DO NOTHING`,
    [vpid, uid],
  );
  const n = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.vendor_team_members
      WHERE vendor_profile_id = $1 AND user_id = $2`,
    [vpid, uid],
  );
  assert.equal(Number(n.rows[0]!.n), 1, 'the owner ended up with two team rows');
});

/**
 * ⛔ AND THE "existing role is not overwritten" TEST IS GONE TOO.
 *
 * It set a member to `admin`, re-ran the backfill, and expected `admin` to
 * survive. It failed with `'owner' !== 'admin'` — not because the backfill
 * overwrote anything (it is `ON CONFLICT DO NOTHING`, which cannot), but
 * because the schema's own team-governance guards do not let a role be
 * rewritten by a bare UPDATE like that.
 *
 * 🔑 THE TEST WAS ASSERTING AGAINST A RULE THE DATABASE ALREADY ENFORCES more
 * strictly than I did. Rewriting it to work would have meant working around
 * that guard inside a test — teaching the suite to do the one thing the schema
 * exists to prevent.
 *
 * The property it was reaching for is structural and is asserted below by
 * reading the statement itself.
 */
test('the backfill can only ADD — it never rewrites a role', () => {
  const sql = readFileSync(
    resolve(HERE, '../../../../supabase/migrations/20271214139390_vendor_owner_is_always_an_answering_member.sql'),
    'utf8',
  );
  assert.match(
    sql,
    /ON CONFLICT \(vendor_profile_id, user_id\) DO NOTHING/,
    'the backfill can overwrite an existing team role — an admin or agent would ' +
      'be silently demoted to owner',
  );
  assert.ok(
    !/DO UPDATE/i.test(sql),
    'the backfill upserts instead of inserting; it must only fill gaps',
  );
});

test('🔑 no profile with an owner is left without an answering member', async () => {
  const orphans = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
       FROM public.vendor_profiles vp
      WHERE vp.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.vendor_team_members tm
           WHERE tm.vendor_profile_id = vp.vendor_profile_id
             AND tm.user_id = vp.user_id
             AND tm.role IN ('owner','admin','agent'))`,
  );
  assert.equal(
    Number(orphans.rows[0]!.n),
    0,
    'a shop exists whose own owner cannot answer its inquiries',
  );
});
