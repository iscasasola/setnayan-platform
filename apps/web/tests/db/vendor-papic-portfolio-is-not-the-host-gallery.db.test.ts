/**
 * A SUPPLIER'S PRIVATE PORTFOLIO ALBUM IS PRIVATE — the host never reads it,
 * a session never writes it, and the couple's own event-vendor booking does
 * not leak a second supplier's album (G3, following G2's credit ledger).
 *
 * `vendor_papic_portfolio_photos` is deliberately a THIRD table: distinct from
 * `papic_photos` (the host gallery, which this test proves stays untouched by
 * an import) and from `vendor_papic_captures` (the vendor's on-the-day lane,
 * which the host CAN see with consent — this album never is). The strongest
 * proof RLS can give that "the host's readers return none of it" is that the
 * host's OWN session, granted every privilege a reader could have, still
 * cannot select a row — mirrors vendor-papic-credits-are-the-suppliers.db.test.ts
 * exactly, adapted for photos instead of a credit total.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let coupleId: string;
let vendorUserA: string;
let vendorUserB: string;
let vendorA: string;
let vendorB: string;
let eventId: string;

async function newUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function newVendor(userId: string, name: string): Promise<string> {
  // on_auth_user_created auto-seeds an UNVERIFIED vendor_profiles row for an
  // account_type=vendor user — a real 'contracted' booking (event_vendors)
  // rejects an unverified marketplace_vendor_id, so the existing branch must
  // verify it too, not only rename it.
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) {
    await db.query(
      `UPDATE public.vendor_profiles
         SET business_name = $2, verification_state = 'verified', last_verified_at = NOW()
       WHERE vendor_profile_id = $1`,
      [existing.rows[0].vendor_profile_id, name],
    );
    return existing.rows[0].vendor_profile_id;
  }
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function importPhoto(vendorProfileId: string, forEventId: string, key: string): Promise<string> {
  const r = await db.query<{ photo_id: string }>(
    `INSERT INTO public.vendor_papic_portfolio_photos
       (vendor_profile_id, event_id, r2_object_key, credits_spent, nsfw_checked)
     VALUES ($1, $2, $3, 1, TRUE) RETURNING photo_id`,
    [vendorProfileId, forEventId, key],
  );
  return r.rows[0]!.photo_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);

  coupleId = await newUser('couple-vpp@test.test', 'customer');
  vendorUserA = await newUser('vendor-a-vpp@test.test', 'vendor');
  vendorUserB = await newUser('vendor-b-vpp@test.test', 'vendor');
  vendorA = await newVendor(vendorUserA, 'Portfolio Studio A');
  vendorB = await newVendor(vendorUserB, 'Portfolio Studio B');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Vendor portfolio event', 'celebration') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, coupleId],
  );
  // Vendor A is BOOKED — the shape current_vendor_booked_event_ids() requires
  // for the insert policy (status IN contracted/deposit_paid/delivered/complete).
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Portfolio Studio A', 'contracted', $2)`,
    [eventId, vendorA],
  );
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the new album table (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('🚨 the host gallery is untouched by a portfolio import — nothing crosses over', async () => {
  const photoRow = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.papic_photos WHERE event_id = $1`,
    [eventId],
  );
  const before_ = Number(photoRow.rows[0]!.n);

  await importPhoto(vendorA, eventId, `r2://setnayan-media/papic/vendor-${vendorA}/portfolio/${eventId}/x1.jpg`);

  const after_ = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.papic_photos WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(Number(after_.rows[0]!.n), before_, 'a portfolio import must never write a papic_photos row');
});

test('storage prefix is its own lane — never the host gallery, never the on-the-day capture lane', async () => {
  const photoId = await importPhoto(
    vendorA,
    eventId,
    `r2://setnayan-media/papic/vendor-${vendorA}/portfolio/${eventId}/x2.jpg`,
  );
  const r = await db.query<{ r2_object_key: string }>(
    `SELECT r2_object_key FROM public.vendor_papic_portfolio_photos WHERE photo_id = $1`,
    [photoId],
  );
  const key = r.rows[0]!.r2_object_key;
  assert.match(key, /\/portfolio\//, 'the album prefix must say "portfolio", distinguishing it from a capture');
  assert.doesNotMatch(key, /\/event-.*\/cap-/, 'must not reuse the on-the-day capture key shape');
  assert.doesNotMatch(key, /papic\/guest\//, 'must not reuse the host/guest gallery prefix');
});

test('append-only-positive: a ₱0-credit row and a negative one are both refused', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_papic_portfolio_photos
         (vendor_profile_id, event_id, r2_object_key, credits_spent) VALUES ($1, $2, 'x', 0)`,
      [vendorA, eventId],
    ),
    /vendor_papic_portfolio_photos_credits_positive/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_papic_portfolio_photos
         (vendor_profile_id, event_id, r2_object_key, credits_spent) VALUES ($1, $2, 'x', -1)`,
      [vendorA, eventId],
    ),
    /vendor_papic_portfolio_photos_credits_positive/,
  );
});

test('RLS: a supplier reads only their OWN album; the host reads none of it', async () => {
  await importPhoto(vendorA, eventId, `r2://setnayan-media/papic/vendor-${vendorA}/portfolio/${eventId}/x3.jpg`);

  const countAs = async (uid: string): Promise<number> => {
    await setAuthUid(db, uid);
    const r = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.vendor_papic_portfolio_photos WHERE event_id = $1`,
      [eventId],
    );
    return Number(r.rows[0]!.n);
  };

  await db.exec(`SET ROLE authenticated`);
  try {
    assert.ok(
      (await countAs(vendorUserA)) > 0,
      'supplier A cannot see their own portfolio — an album nobody can read',
    );
    assert.equal(
      await countAs(vendorUserB),
      0,
      'supplier B (not booked, unrelated shop) can read supplier A’s private album',
    );
    assert.equal(
      await countAs(coupleId),
      0,
      'the host/couple can read a supplier’s PRIVATE portfolio — this is the property the surface promises',
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }
});

test('a BOOKED supplier can import into their OWN album from their own session (the route’s insert)', async () => {
  // Unlike the credit ledger (service-role only), an import IS a session write
  // — the same posture as vendor_papic_captures_vendor_insert. The credit
  // balance check happens in the route, not in RLS; this test is scoped to
  // the boundary RLS actually enforces: booked event + own profile.
  await setAuthUid(db, vendorUserA);
  await db.exec(`SET ROLE authenticated`);
  try {
    const insert = await db
      .query(
        `INSERT INTO public.vendor_papic_portfolio_photos
           (vendor_profile_id, event_id, r2_object_key, credits_spent) VALUES ($1, $2, 'x', 1)`,
        [vendorA, eventId],
      )
      .then(() => 'inserted')
      .catch((e: Error) => e.message);
    assert.equal(insert, 'inserted', 'a booked supplier must be able to import into their own album');

    // But they may NOT rewrite their own NSFW screen result — the background
    // screen runs on the service-role admin client precisely so this stays
    // impossible from a session, same posture as the credit ledger.
    const rewrite = await db
      .query(
        `UPDATE public.vendor_papic_portfolio_photos SET nsfw_checked = FALSE, hidden_at = NULL
          WHERE vendor_profile_id = $1`,
        [vendorA],
      )
      .then((r) => `updated ${r.affectedRows ?? 0}`)
      .catch((e: Error) => e.message);
    assert.notEqual(rewrite, 'updated 1', 'a supplier rewrote their own screening result from a session');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }
});

test('an unbooked vendor cannot insert into their own album for someone else’s event', async () => {
  await setAuthUid(db, vendorUserB);
  await db.exec(`SET ROLE authenticated`);
  try {
    const insert = await db
      .query(
        `INSERT INTO public.vendor_papic_portfolio_photos
           (vendor_profile_id, event_id, r2_object_key, credits_spent) VALUES ($1, $2, 'x', 1)`,
        [vendorB, eventId],
      )
      .then(() => 'inserted')
      .catch((e: Error) => e.message);
    assert.notEqual(insert, 'inserted', 'vendor B is not booked on this event and must be refused');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }
});

test('anon holds no grant on the album at all', async () => {
  const r = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'vendor_papic_portfolio_photos'
        AND grantee = 'anon'`,
  );
  assert.deepEqual(r.rows, [], `anon can ${r.rows.map((x) => x.privilege_type).join(', ')} the portfolio album`);

  const auth = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'vendor_papic_portfolio_photos'
        AND grantee = 'authenticated'`,
  );
  const writes = auth.rows
    .map((x) => x.privilege_type)
    .filter((p) => p !== 'SELECT' && p !== 'INSERT')
    .sort();
  assert.deepEqual(writes, [], `authenticated can ${writes.join(', ')} the portfolio album beyond insert`);
});
