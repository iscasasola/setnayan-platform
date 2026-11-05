/**
 * 🎟⭐ A GUEST'S OPTIONAL REVIEW AFTER "RECEIVED" — asserted against the DATABASE (migration 20271319343516; DECISION_LOG
 * 2026-09-25 "AFTER A GUEST RECEIVES A SUPPLIER'S ITEM, AN OPTIONAL REVIEW CAN POP UP ON THEIR EVENT HUB").
 *
 *   1 · only a guest with a RECEIVED claim for that service may review it (a supplier claim, or the souvenir row a
 *       supplier's scanner wrote) — anyone else is refused;
 *   2 · ONE per guest per service: a second answer changes nothing; a skip is an answer too (never asked twice);
 *   3 · the write is the service role's alone — a signed-in person (the supplier included) cannot call it, and
 *       nobody but Setnayan admin can read the reviews: the supplier never sees who wrote one;
 *   4 · admin moderates pending → published | hidden.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

const F = {
  eventId: '',
  otherEventId: '',
  booth: '',
  boothVp: '',
  boothCov: 0,
  boothCov2: 0,
  souvenir: '',
  souvenirCov: 0,
  unbooked: '',
  unbookedCov: 0,
  couple: '',
  stranger: '',
  tokens: [] as string[],
  guestIds: [] as string[],
  otherToken: '',
};

type Answer = { outcome: string; number?: number | null; claimed?: number | null; total?: number | null };

async function scan(uid: string, cov: number, token: string, method = 'supplier_qr'): Promise<Answer> {
  await asUser(uid);
  const r = await db.query<{ a: Answer }>(`SELECT public.supplier_scan_claim($1, $2, $3, $4) AS a`, [
    F.eventId,
    cov,
    token,
    method,
  ]);
  return r.rows[0]!.a;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.booth = await mkUser('booth@scan.test');
  F.souvenir = await mkUser('souvenir@scan.test');
  F.unbooked = await mkUser('unbooked@scan.test');
  F.couple = await mkUser('couple@scan.test');
  F.stranger = await mkUser('stranger@scan.test');

  const mkEvent = async (name: string) =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ($1,'wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  F.eventId = await mkEvent('Sample Wedding');
  F.otherEventId = await mkEvent('Another Wedding');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);

  const profile = async (uid: string, name: string, cat: string): Promise<string> =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1,$2,'Manila',ARRAY[$3]::text[],'verified', NOW()) RETURNING vendor_profile_id`,
        [uid, name, cat],
      )
    ).rows[0]!.vendor_profile_id;
  const coverage = async (vp: string, canonical: string): Promise<number> =>
    Number(
      (
        await db.query<{ id: string }>(
          `INSERT INTO public.vendor_coverages (vendor_profile_id, canonical_service) VALUES ($1,$2) RETURNING id`,
          [vp, canonical],
        )
      ).rows[0]!.id,
    );
  F.boothVp = await profile(F.booth, 'Sample Booth', 'photo_booth');
  F.boothCov = await coverage(F.boothVp, 'photo_booth');
  F.boothCov2 = await coverage(F.boothVp, 'mirror_booth');
  const souvenirVp = await profile(F.souvenir, 'Sample Souvenirs', 'souvenirs_giveaways');
  F.souvenirCov = await coverage(souvenirVp, 'souvenirs_giveaways');
  const unbookedVp = await profile(F.unbooked, 'Sample Unbooked', 'photo_booth');
  F.unbookedCov = await coverage(unbookedVp, 'photo_booth');

  // The booth's booking names ONE service card, filed under photo_booth — mirror_booth was not booked.
  const card = (
    await db.query<{ vendor_service_id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, is_active, primary_photo_r2_key, coverage_id)
       VALUES ($1,'photo_booth',10000,FALSE,'samples/booth.jpg',$2) RETURNING vendor_service_id`,
      [F.boothVp, F.boothCov],
    )
  ).rows[0]!.vendor_service_id;
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, requested_service_ids)
     VALUES ($1,'photobooth','Sample Booth','contracted',10000,$2,ARRAY[$3]::uuid[])`,
    [F.eventId, F.boothVp, card],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1,'gifts_and_giveaways','Sample Souvenirs','deposit_paid',5000,$2)`,
    [F.eventId, souvenirVp],
  );
  // The unbooked shop is only being considered.
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1,'photobooth','Sample Unbooked','considering',10000,$2)`,
    [F.eventId, unbookedVp],
  );

  for (let i = 0; i < 4; i++) {
    const g = (
      await db.query<{ guest_id: string; qr_token: string }>(
        `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
         VALUES ($1,$2,'Sample','bride','friends','attending') RETURNING guest_id, qr_token`,
        [F.eventId, `Guest${i}`],
      )
    ).rows[0]!;
    F.guestIds.push(g.guest_id);
    F.tokens.push(g.qr_token);
  }
  F.otherToken = (
    await db.query<{ qr_token: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1,'Elsewhere','Sample','bride','friends') RETURNING qr_token`,
      [F.otherEventId],
    )
  ).rows[0]!.qr_token;

  // Each shop switches its scanner on — as the shop, through its own RLS.
  for (const [uid, cov] of [
    [F.booth, F.boothCov],
    [F.booth, F.boothCov2],
    [F.souvenir, F.souvenirCov],
    [F.unbooked, F.unbookedCov],
  ] as const) {
    await asUser(uid);
    await db.query(`INSERT INTO public.supplier_scan_settings (coverage_id, enabled, mode) VALUES ($1, TRUE, 'once')`, [cov]);
  }
  await asOwner();
});

after(async () => {
  await replay?.db.close();
});

const admin = { id: '' };
async function submit(guest: string, cov: number, stars: number | null, line: string | null): Promise<string> {
  await asOwner();
  await db.exec(`SET ROLE service_role`);
  try {
    return (await db.query<{ r: string }>(`SELECT public.supplier_scan_review_submit($1,$2,$3,$4,$5) AS r`, [F.eventId, guest, cov, stars, line])).rows[0]!.r;
  } finally {
    await db.exec(`RESET ROLE`);
  }
}

test('1 · only a guest with a RECEIVED claim for the service may review it', async () => {
  await scan(F.booth, F.boothCov, F.tokens[0]!);
  await scan(F.souvenir, F.souvenirCov, F.tokens[1]!);
  assert.equal(await submit(F.guestIds[0]!, F.boothCov, 5, 'Loved the props!'), 'saved');
  assert.equal(await submit(F.guestIds[1]!, F.souvenirCov, 4, null), 'saved', 'the souvenir row a supplier wrote counts');
  await assert.rejects(submit(F.guestIds[2]!, F.boothCov, 5, 'never went'), /no_received_claim/);
  await assert.rejects(submit(F.guestIds[0]!, F.souvenirCov, 5, null), /no_received_claim/, 'a different service');
  await assert.rejects(submit(F.guestIds[0]!, F.boothCov, 6, null), /bad_stars|already/);
});

test('2 · one per guest per service; a skip is an answer too', async () => {
  assert.equal(await submit(F.guestIds[0]!, F.boothCov, 1, 'changed my mind'), 'already');
  await scan(F.booth, F.boothCov, F.tokens[3]!);
  assert.equal(await submit(F.guestIds[3]!, F.boothCov, null, 'ignored'), 'saved');
  assert.equal(await submit(F.guestIds[3]!, F.boothCov, 5, null), 'already', 'a skip is never asked again');
  await asOwner();
  const rows = await db.query<{ guest_id: string; stars: number | null; line: string | null; skipped: boolean }>(
    `SELECT guest_id, stars, line, skipped FROM public.supplier_scan_reviews WHERE coverage_id = $1 ORDER BY created_at`,
    [F.boothCov],
  );
  assert.deepEqual(rows.rows.map((r) => [r.stars, r.line, r.skipped]), [
    [5, 'Loved the props!', false],
    [null, null, true],
  ]);
});

test('3 · the write is the service role’s alone, and only admin reads', async () => {
  await asUser(F.booth);
  await assert.rejects(
    db.query(`SELECT public.supplier_scan_review_submit($1,$2,$3,5,NULL)`, [F.eventId, F.guestIds[0], F.boothCov]),
    /permission denied/,
  );
  const seen = await db.query(`SELECT * FROM public.supplier_scan_reviews`);
  assert.equal(seen.rows.length, 0, 'the supplier read a review row');
  await asUser(F.couple);
  assert.equal((await db.query(`SELECT * FROM public.supplier_scan_reviews`)).rows.length, 0, 'the couple read a review row');
});

test('4 · admin moderates pending → published | hidden', async () => {
  await asOwner();
  admin.id = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('admin@scan.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  // As the table owner (the guard that refuses self-promotion admits the owner), the way the admin test seeds one.
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [admin.id]);
  await asUser(admin.id);
  assert.equal((await db.query<{ a: boolean }>(`SELECT public.is_admin() AS a`)).rows[0]!.a, true, 'the seeded admin is not an admin');
  const pending = await db.query(`SELECT 1 FROM public.supplier_scan_reviews WHERE state = 'pending'`);
  assert.equal(pending.rows.length, 3, 'admin reads every review, the skip included');
  const r = await db.query(`UPDATE public.supplier_scan_reviews SET state = 'published', moderated_at = NOW() WHERE stars = 5 RETURNING 1`);
  assert.equal(r.rows.length, 1);
});
