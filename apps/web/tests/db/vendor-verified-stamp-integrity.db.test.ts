/**
 * `vendor_profiles_verified_requires_stamp` — the integrity guarantee behind the
 * public "Verified" badge (test:db, migrations replayed).
 *
 * ── WHAT WENT WRONG ─────────────────────────────────────────────────────────
 * Production held a `vendor_profiles` row at verification_state = 'verified'
 * with NULL last_verified_at, NULL next_renewal_due_at and no
 * vendor_tier_history row: a shop wearing the badge that tells a couple "a human
 * checked this business", which no human had checked and which recorded no date.
 *
 * No shipped APP path can produce it — both admin writers stamp all three fields
 * in a single UPDATE and bump updated_at, and the bad row's updated_at is
 * byte-identical to its created_at. The reachable shapes are the ones that
 * bypass the app: apps/web/scripts/seed-test-accounts.sql (documented as
 * runnable against prod via --db-url) and migration 20270331400000:41-44.
 *
 * Because the offending writers are a SEED SCRIPT and a MIGRATION, no
 * application-layer fix can reach them. Migration 20271017100000 adds an
 * engine-enforced CHECK constraint, which binds every writer including
 * service_role and hand-run psql.
 *
 * ── WHAT THESE TESTS PIN ────────────────────────────────────────────────────
 * The migration's own DO-block asserts only STRUCTURE (a probe write there would
 * touch a real production row). The BEHAVIOUR is proved here, against real
 * replayed SQL in a throwaway PGlite database:
 *   1. the bad shape is REJECTED — on INSERT and on UPDATE;
 *   2. every LEGITIMATE shape still succeeds — in particular the exact
 *      single-statement pattern both admin approval paths use, which is the
 *      thing that would break if the constraint were too strict;
 *   3. the constraint is NOT VALID, so it ships safely while the known bad row
 *      still exists — and it still bites on new writes.
 *
 * Run: `pnpm test:db`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const CONSTRAINT = 'vendor_profiles_verified_requires_stamp';

/** A vendor account + its auto-provisioned profile, created privileged. */
async function newVendor(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [email],
  );
  const uid = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [uid],
  );
  if (existing.rows.length > 0) return existing.rows[0]!.vendor_profile_id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, 'Stamp Test Vendor', 'Manila', ARRAY['photography']::text[])
     RETURNING vendor_profile_id`,
    [uid],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function expectRejected(fn: () => Promise<unknown>, what: string): Promise<void> {
  let threw: unknown = null;
  try {
    await fn();
  } catch (e) {
    threw = e;
  }
  assert.ok(threw, `${what} — expected the constraint to REJECT this write, but it succeeded`);
  assert.match(
    String((threw as { message?: string })?.message ?? threw),
    new RegExp(CONSTRAINT),
    `${what} — rejected, but not by ${CONSTRAINT}`,
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

/* ── 1. THE BAD SHAPE IS REJECTED ────────────────────────────────────────── */

test('⭐ UPDATE to verified with a NULL last_verified_at is REJECTED', async () => {
  const vpid = await newVendor('stamp-upd@test.local');
  await expectRejected(
    () =>
      db.query(
        `UPDATE public.vendor_profiles
            SET verification_state = 'verified'::public.vendor_verification_state
          WHERE vendor_profile_id = $1`,
        [vpid],
      ),
    'the exact shape of seed-test-accounts.sql / migration 20270331400000',
  );
});

test('⭐ INSERT of a verified row with a NULL last_verified_at is REJECTED', async () => {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('stamp-ins@test.local', jsonb_build_object('account_type','couple')) RETURNING id`,
  );
  await expectRejected(
    () =>
      db.query(
        `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, services, verification_state)
         VALUES ($1, 'Straight To Verified', 'Cebu', ARRAY['photography']::text[],
                 'verified'::public.vendor_verification_state)`,
        [u.rows[0]!.id],
      ),
    'a hand-inserted pre-verified row',
  );
});

test('⭐ clearing last_verified_at on an ALREADY-verified shop is REJECTED', async () => {
  const vpid = await newVendor('stamp-clear@test.local');
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified'::public.vendor_verification_state,
            last_verified_at   = NOW()
      WHERE vendor_profile_id = $1`,
    [vpid],
  );
  await expectRejected(
    () =>
      db.query(
        `UPDATE public.vendor_profiles SET last_verified_at = NULL
          WHERE vendor_profile_id = $1`,
        [vpid],
      ),
    'the badge cannot be kept while the date is erased',
  );
});

/* ── 2. EVERY LEGITIMATE SHAPE STILL WORKS ───────────────────────────────── */

test('the admin approval pattern (state + stamps in ONE statement) SUCCEEDS', async () => {
  // Byte-for-byte the shape of app/admin/verify/actions.ts:149-151 and :361-362.
  // If the constraint were too strict, THIS is what would break — so it is the
  // load-bearing safety proof, not a formality.
  const vpid = await newVendor('stamp-admin@test.local');
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state  = 'verified'::public.vendor_verification_state,
            last_verified_at    = NOW(),
            next_renewal_due_at = NOW() + INTERVAL '1 year',
            public_visibility   = 'verified'::public.vendor_public_visibility,
            updated_at          = NOW()
      WHERE vendor_profile_id = $1`,
    [vpid],
  );
  const row = await db.query<{ verification_state: string; last_verified_at: string | null }>(
    `SELECT verification_state, last_verified_at FROM public.vendor_profiles
      WHERE vendor_profile_id = $1`,
    [vpid],
  );
  assert.equal(row.rows[0]!.verification_state, 'verified');
  assert.ok(row.rows[0]!.last_verified_at, 'the approval must persist its stamp');
});

test('next_renewal_due_at is deliberately NOT required', async () => {
  // The constraint pins the statement of FACT (this was checked, on this date),
  // not the derived scheduling value — so renewal policy can change freely.
  const vpid = await newVendor('stamp-norenew@test.local');
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified'::public.vendor_verification_state,
            last_verified_at   = NOW()
      WHERE vendor_profile_id = $1`,
    [vpid],
  );
  const row = await db.query<{ next_renewal_due_at: string | null }>(
    `SELECT next_renewal_due_at FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vpid],
  );
  assert.equal(row.rows[0]!.next_renewal_due_at, null);
});

test('every NON-verified state is untouched by the constraint', async () => {
  // The constraint must not become a general "you need a timestamp" rule — an
  // unverified/pending/demoted/rejected shop legitimately has no verification
  // date, and the vendor submit path (P0 fix) writes exactly 'pending_review'.
  for (const state of ['unverified', 'pending_review', 'demoted', 'rejected']) {
    const vpid = await newVendor(`stamp-${state}@test.local`);
    await db.query(
      `UPDATE public.vendor_profiles
          SET verification_state = $2::public.vendor_verification_state
        WHERE vendor_profile_id = $1`,
      [vpid, state],
    );
    const row = await db.query<{ verification_state: string }>(
      `SELECT verification_state FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
      [vpid],
    );
    assert.equal(row.rows[0]!.verification_state, state, `${state} must be writable`);
  }
});

test('a re-verification keeps working (last_verified_at already set)', async () => {
  const vpid = await newVendor('stamp-reverify@test.local');
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified'::public.vendor_verification_state,
            last_verified_at   = NOW() - INTERVAL '1 year'
      WHERE vendor_profile_id = $1`,
    [vpid],
  );
  // Demote, then re-approve — the annual-renewal round trip.
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'demoted'::public.vendor_verification_state
      WHERE vendor_profile_id = $1`,
    [vpid],
  );
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified'::public.vendor_verification_state,
            last_verified_at   = NOW()
      WHERE vendor_profile_id = $1`,
    [vpid],
  );
  const row = await db.query<{ verification_state: string }>(
    `SELECT verification_state FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vpid],
  );
  assert.equal(row.rows[0]!.verification_state, 'verified');
});

/* ── 3. SHAPE OF THE CONSTRAINT ITSELF ───────────────────────────────────── */

test('the constraint exists, is a CHECK, and is NOT VALID', async () => {
  const row = await db.query<{ contype: string; convalidated: boolean; def: string }>(
    `SELECT contype::text, convalidated, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'public.vendor_profiles'::regclass AND conname = $1`,
    [CONSTRAINT],
  );
  assert.equal(row.rows.length, 1, 'the constraint must exist after migrations replay');
  assert.equal(row.rows[0]!.contype, 'c', 'must be a CHECK constraint');
  assert.match(row.rows[0]!.def, /last_verified_at/);
  // NOT VALID is what lets this ship while the one known bad prod row survives.
  // If someone later "tidies" it to a validating ADD CONSTRAINT, the deploy
  // would abort on prod — so the flag is pinned deliberately.
  assert.equal(
    row.rows[0]!.convalidated,
    false,
    'must be NOT VALID until the owner resolves the known bad prod row',
  );
});

test('the seed script no longer writes the bad shape', async () => {
  // The most likely origin of the prod row. A grep-level guard: the seed sets
  // verification_state = 'verified', so it must stamp last_verified_at too, or
  // it will now fail loudly against any database carrying the constraint.
  const { readFileSync } = await import('node:fs');
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const seed = readFileSync(resolve(here, '../../scripts/seed-test-accounts.sql'), 'utf8');

  assert.match(seed, /verification_state\s*=\s*'verified'/, 'precondition: seed still verifies');
  assert.match(seed, /last_verified_at\s*=\s*NOW\(\)/, 'the seed must stamp last_verified_at');
  assert.doesNotMatch(
    seed,
    /public_visibility\s*=\s*'coming_soon'/,
    "the seed must not write the RETIRED 'coming_soon' visibility",
  );
});
