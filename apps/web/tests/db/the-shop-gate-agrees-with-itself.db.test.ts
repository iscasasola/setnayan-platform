/**
 * A service card is public exactly when its shop is — end-to-end (test:db).
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * Two columns decide whether a shop is public. `public_visibility` is the
 * authoritative one — the marketplace, `/v/[slug]` and
 * `vendor_profiles_public_read` all read it. `is_published` is the legacy
 * boolean that `lib/vendor-visibility.ts` documents as superseded, the explore
 * page says is "no longer queried here", and the admin accounts surface calls
 * **"the dead column"** in its own comment.
 *
 * `vendor_services_public_read` still gated every service card on the dead one.
 * Both production shops sit exactly where the two disagree: the real shop is
 * listed with its cards unreadable, the hidden fixture is the mirror image.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 *   1. META — the session is really `authenticated`, cannot bypass RLS, and is
 *      not the table owner. Runs first.
 *   2. POSITIVE CONTROL — a card on a properly verified shop IS readable. Every
 *      "cannot see it" assertion below is worthless without one case that can.
 *   3. FOUR-CORNER MATRIX — the two columns are tested in all four
 *      combinations, so a policy that reads the wrong one, or that accidentally
 *      reads neither, fails on a different corner than a policy that reads both.
 *   4. The inactive-card leg is asserted separately, because dropping it would
 *      still pass every visibility corner.
 *
 * 🪤 The four active fixtures carry a price AND a Setnayan Exclusive because the
 * publish gate (20271176775619) refuses a live card without them, and a
 * verified shop needs a `last_verified_at` stamp. Both were found by the
 * fixtures failing loudly — a seed describing a row the database cannot hold
 * proves nothing about the policy under test.
 *
 * ⛔ This file asserts BEHAVIOUR — real SELECTs under `SET ROLE` — never the
 * policy's text. `relrowsecurity` is vacuous in this replay and a policy's
 * source is not its effect.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** The four corners of (public_visibility, is_published), each with one active
 *  service card. Only the first should ever be publicly readable. */
const SHOPS = [
  { name: 'verified + published',     vis: 'verified', published: true,  visible: true },
  { name: 'verified + unpublished',   vis: 'verified', published: false, visible: true },
  { name: 'hidden + published',       vis: 'hidden',   published: true,  visible: false },
  { name: 'hidden + unpublished',     vis: 'hidden',   published: false, visible: false },
] as const;

async function asAuthenticated(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['authenticated']);
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['']);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  for (const s of SHOPS) {
    await db.query(
      // `last_verified_at` is not optional: a CHECK
      // (vendor_profiles_verified_requires_stamp) refuses a verified shop
      // without one. A fixture describing a row the database cannot hold
      // proves nothing — this one failed loudly rather than quietly.
      `WITH v AS (
         INSERT INTO public.vendor_profiles
           (business_name, public_visibility, verification_state, is_published, last_verified_at)
         VALUES ($1, $2::vendor_public_visibility, 'verified'::vendor_verification_state, $3, NOW())
         RETURNING vendor_profile_id
       )
       INSERT INTO public.vendor_services
         (vendor_profile_id, category, is_active, starting_price_php, exclusive_perk_text)
       SELECT vendor_profile_id, 'photographer', true, 25000, 'probe perk' FROM v`,
      [s.name, s.vis, s.published],
    );
  }
  // One INACTIVE card on the fully-public shop — the is_active leg's own case.
  // Deliberately priceless: the publish gate (20271176775619) judges the ACT of
  // publishing, so a draft may be incomplete — which is itself the reason this
  // row is a valid fixture and not an impossible one.
  await db.exec(`
    INSERT INTO public.vendor_services (vendor_profile_id, category, is_active)
    SELECT vendor_profile_id, 'videographer', false
    FROM public.vendor_profiles WHERE business_name = 'verified + published';
  `);
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

test('META: the session is really authenticated and cannot bypass RLS', async () => {
  await asAuthenticated();
  const r = await db.query<{ u: string; bypass: boolean }>(
    `SELECT current_user AS u,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`,
  );
  assert.equal(r.rows[0]?.u, 'authenticated');
  assert.equal(r.rows[0]?.bypass, false);
  await reset();
});

test('ANTI-VACUITY: all five cards really exist', async () => {
  await reset();
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_services`);
  assert.equal(r.rows[0]?.n, 5, 'four corner cards + one inactive');
});

test('a card is public exactly when its shop is — all four corners', async () => {
  await asAuthenticated();
  for (const s of SHOPS) {
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM public.vendor_services vs
         JOIN public.vendor_profiles vp USING (vendor_profile_id)
        WHERE vp.business_name = $1 AND vs.category = 'photographer'`,
      [s.name],
    );
    assert.equal(
      (r.rows[0]?.n ?? 0) > 0,
      s.visible,
      s.visible
        ? `${s.name}: the card must be readable — this is the corner the fix exists for`
        : `${s.name}: a card on a shop nobody can see must not be readable`,
    );
  }
  await reset();
});

test('POSITIVE CONTROL: the readable corner really returns a row', async () => {
  // Without this, "0 rows everywhere" would pass the matrix for the worst
  // possible reason — the policy admitting nobody at all.
  await asAuthenticated();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_services`,
  );
  assert.equal(r.rows[0]?.n, 2, 'exactly the two verified shops’ active cards');
  await reset();
});

test('the legacy published flag alone never makes a card public', async () => {
  // The precise regression: `hidden + published` is what the OLD policy
  // admitted and the new one must not.
  await asAuthenticated();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM public.vendor_services vs
       JOIN public.vendor_profiles vp USING (vendor_profile_id)
      WHERE vp.is_published = true AND vp.public_visibility <> 'verified'`,
  );
  assert.equal(r.rows[0]?.n, 0, 'the dead column must not be a public gate');
  await reset();
});

test('an inactive card stays private even on a fully public shop', async () => {
  await asAuthenticated();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_services WHERE category = 'videographer'`,
  );
  assert.equal(r.rows[0]?.n, 0, 'a hidden card is hidden regardless of its shop');
  await reset();
});
