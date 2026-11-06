/**
 * 🎟⭐ A GUEST'S OPTIONAL REVIEW AFTER "RECEIVED" — asserted against the DATABASE (DECISION_LOG 2026-09-25 "AFTER A GUEST
 * RECEIVES A SUPPLIER'S ITEM, AN OPTIONAL REVIEW CAN POP UP ON THEIR EVENT HUB"; owner ruling 2026-11-06: guest reviews
 * are ONE store, ONE writer and ONE "From guests" section — the scanner's pop-up is a second door into it).
 *
 *   1 · the ONE writer (`vendor_guest_review_submit`, migration 20271316933967) admits a guest whose scanner claim for
 *       THAT shop is RECEIVED — and refuses a guest the shop never served, or a shop that only received someone else;
 *   2 · ONE per guest per shop per event, whichever door wrote it; "Not now" is the scanner's own row
 *       (`supplier_scan_review_skips`, migration 20271323347634) — one per event · guest · shop, never a review;
 *   3 · both writes are the service role's alone — a signed-in person (the supplier included) can call neither, and
 *       nobody but Setnayan admin reads the skips;
 *   4 · the scanner adds NO second review store (the old `supplier_scan_reviews` and its writer do not exist).
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

/** The one writer, as the scanner action calls it (service role · no service card · no photo · shown by name). */
async function submit(guest: string, vendorProfileId: string, stars: number, line: string | null): Promise<string> {
  await asOwner();
  await db.exec(`SET ROLE service_role`);
  try {
    return (
      await db.query<{ r: string }>(`SELECT public.vendor_guest_review_submit($1,$2,$3,NULL,$4,$5,NULL,'name')::text AS r`, [
        F.eventId,
        guest,
        vendorProfileId,
        stars,
        line,
      ])
    ).rows[0]!.r;
  } finally {
    await db.exec(`RESET ROLE`);
  }
}

/** "Not now", as the scanner action writes it (service role; a repeat is a no-op). */
async function skip(guest: string, vendorProfileId: string): Promise<void> {
  await asOwner();
  await db.exec(`SET ROLE service_role`);
  try {
    await db.query(
      `INSERT INTO public.supplier_scan_review_skips (event_id, guest_id, vendor_profile_id) VALUES ($1,$2,$3)
       ON CONFLICT (event_id, guest_id, vendor_profile_id) DO NOTHING`,
      [F.eventId, guest, vendorProfileId],
    );
  } finally {
    await db.exec(`RESET ROLE`);
  }
}

const vpOf = async (uid: string): Promise<string> => {
  await asOwner();
  return (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid])).rows[0]!.v;
};

test('1 · the one writer admits a guest the shop’s scanner marked RECEIVED, and nobody else', async () => {
  const unbookedVp = await vpOf(F.unbooked);
  assert.equal((await scan(F.booth, F.boothCov, F.tokens[0]!)).outcome, 'claimed');
  const id = await submit(F.guestIds[0]!, F.boothVp, 5, 'Loved the props!');
  assert.match(id, /^[0-9a-f-]{36}$/, 'a received guest’s review was not written');
  await asOwner();
  const row = await db.query<{ door: string; shown_as: string; hidden_at: string | null }>(
    `SELECT door, shown_as, hidden_at FROM public.vendor_guest_reviews WHERE review_id = $1`,
    [id],
  );
  assert.deepEqual(row.rows[0], { door: 'scan', shown_as: 'name', hidden_at: null }, 'not the scan door, or not public at once');
  await assert.rejects(submit(F.guestIds[2]!, F.boothVp, 5, 'never went'), /not_at_event/, 'a guest the shop never served');
  await assert.rejects(submit(F.guestIds[0]!, unbookedVp, 5, null), /not_at_event/, 'a shop that never served this guest');
});

test('2 · one per guest per shop; "Not now" is the scanner’s own row, once', async () => {
  await assert.rejects(submit(F.guestIds[0]!, F.boothVp, 1, 'changed my mind'), /already_reviewed/);
  await scan(F.booth, F.boothCov, F.tokens[3]!);
  await skip(F.guestIds[3]!, F.boothVp);
  await skip(F.guestIds[3]!, F.boothVp);
  await asOwner();
  const skips = await db.query(`SELECT 1 FROM public.supplier_scan_review_skips WHERE guest_id = $1`, [F.guestIds[3]]);
  assert.equal(skips.rows.length, 1, 'a repeated Not now wrote twice');
  const reviews = await db.query(`SELECT 1 FROM public.vendor_guest_reviews WHERE guest_id = $1`, [F.guestIds[3]]);
  assert.equal(reviews.rows.length, 0, 'Not now wrote a review');
  await db.exec(`SET ROLE service_role`);
  try {
    await assert.rejects(
      db.query(`INSERT INTO public.supplier_scan_review_skips (event_id, guest_id, vendor_profile_id) VALUES ($1,$2,$3)`, [
        F.eventId,
        F.guestIds[3],
        F.boothVp,
      ]),
      /duplicate key|unique/,
      'the ledger allowed two Not nows for one guest and shop',
    );
  } finally {
    await db.exec(`RESET ROLE`);
  }
});

test('3 · both writes are the service role’s alone, and only admin reads the skips', async () => {
  await asUser(F.booth);
  await assert.rejects(
    db.query(`SELECT public.vendor_guest_review_submit($1,$2,$3,NULL,5,NULL,NULL,'name')`, [F.eventId, F.guestIds[1], F.boothVp]),
    /permission denied/,
  );
  await assert.rejects(
    db.query(`INSERT INTO public.supplier_scan_review_skips (event_id, guest_id, vendor_profile_id) VALUES ($1,$2,$3)`, [
      F.eventId,
      F.guestIds[1],
      F.boothVp,
    ]),
    /permission denied|row-level security/,
  );
  assert.equal((await db.query(`SELECT * FROM public.supplier_scan_review_skips`)).rows.length, 0, 'the supplier read a skip');
  await asUser(F.couple);
  assert.equal((await db.query(`SELECT * FROM public.supplier_scan_review_skips`)).rows.length, 0, 'the couple read a skip');

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
  assert.equal((await db.query(`SELECT 1 FROM public.supplier_scan_review_skips`)).rows.length, 1, 'admin cannot read the skips');
  await asOwner();
});

test('4 · the scanner adds no second review store', async () => {
  await asOwner();
  const t = await db.query<{ t: string | null; f: string | null }>(
    `SELECT to_regclass('public.supplier_scan_reviews')::text AS t,
            (SELECT p.proname::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'supplier_scan_review_submit' LIMIT 1) AS f`,
  );
  assert.deepEqual(t.rows[0], { t: null, f: null }, 'a second guest-review store came back');
});
