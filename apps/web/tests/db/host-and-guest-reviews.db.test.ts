/**
 * ⭐👥 HOST REVIEWS AND GUEST REVIEWS ARE DIFFERENT (owner, 6 Nov 2026) — the database half.
 *
 * Migration 20271316933967 + the owner's answers that day:
 *   · a COORDINATOR does not write a host review (refused by the INSERT policy, not only by the server action);
 *   · a GUEST writes only through `vendor_guest_review_submit`, and only after the door checked them in;
 *   · a guest review NEVER moves the shop's stars (`vendor_trusted_review_stats` / `vendor_review_stats`);
 *   · a guest review is public at once, and a hidden one is gone from the public read.
 *
 * 🔑 Every refusal is asserted by the VALUE afterwards as well as the throw — an RLS denial and a no-op look alike.
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

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role','',false)`).catch(() => {});
  }
}

async function asServiceRole<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE service_role`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
  }
}

async function user(email: string) {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function seed(tag: string) {
  const vendorUserId = await user(`gr-vendor-${tag}@example.com`);
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Bloom & Co.', 'Manila', ARRAY['florist']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [vendorUserId],
  );
  const vendorProfileId = vp.rows[0]!.vendor_profile_id;
  const svc = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active)
     VALUES ($1, 'florist', 'Garden bridal bouquet', FALSE) RETURNING vendor_service_id`,
    [vendorProfileId],
  );
  const serviceId = svc.rows[0]!.vendor_service_id;

  const coupleUserId = await user(`gr-couple-${tag}@example.com`);
  const coordinatorUserId = await user(`gr-coord-${tag}@example.com`);
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Ana & Miguel', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple'), ($1,$3,'coordinator')`,
    [eventId, coupleUserId, coordinatorUserId],
  );
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, linked_vendor_profile_id, marketplace_vendor_id, service_id)
     VALUES ($1,'florist','Bloom & Co.','delivered',$2,$2,$3)`,
    [eventId, vendorProfileId, serviceId],
  );
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1,'Gabriel','dela Peña','both','friends'), ($1,'Absent','Guest','both','friends')
     RETURNING guest_id`,
    [eventId],
  );
  const [checkedIn, notCheckedIn] = g.rows.map((r) => r.guest_id);
  await db.query(
    `INSERT INTO public.guest_checkins (event_id, guest_id, method) VALUES ($1,$2,'qr_scan')`,
    [eventId, checkedIn],
  );
  return { vendorProfileId, serviceId, coupleUserId, coordinatorUserId, eventId, checkedIn: checkedIn!, notCheckedIn: notCheckedIn! };
}

const HOST_INSERT = `INSERT INTO public.vendor_reviews
   (vendor_profile_id, event_id, couple_user_id, rating_overall,
    rating_communication, rating_quality, rating_value, rating_on_time, body, service_id)
 VALUES ($1,$2,$3,$4,5,5,5,5,'Placeholder words.',$5)`;

async function hostReviewCount(vendorProfileId: string) {
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.vendor_reviews WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return r.rows[0]!.n;
}

function submit(s: Awaited<ReturnType<typeof seed>>, guestId: string, stars = 5, line: string | null = 'The bouquet was perfect.') {
  return asServiceRole(() =>
    db.query<{ id: string }>(
      `SELECT public.vendor_guest_review_submit($1,$2,$3,$4,$5,$6,NULL,'name') AS id`,
      [s.eventId, guestId, s.vendorProfileId, s.serviceId, stars, line],
    ),
  );
}

test('a COORDINATOR cannot write a host review — the database refuses it', async () => {
  const s = await seed('coord');
  await assert.rejects(
    asUser(s.coordinatorUserId, () => db.query(HOST_INSERT, [s.vendorProfileId, s.eventId, s.coordinatorUserId, 5, s.serviceId])),
    /row-level security/i,
  );
  assert.equal(await hostReviewCount(s.vendorProfileId), 0, 'nothing was written by the coordinator');
});

test('the couple (member_type couple — the couple and co-hosts) still writes a host review, with its card', async () => {
  const s = await seed('couple');
  await asUser(s.coupleUserId, () => db.query(HOST_INSERT, [s.vendorProfileId, s.eventId, s.coupleUserId, 4, s.serviceId]));
  const r = await db.query<{ service_id: string }>(
    `SELECT service_id FROM public.vendor_reviews WHERE vendor_profile_id = $1`,
    [s.vendorProfileId],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.service_id, s.serviceId, 'the review keeps the card it is for');
});

test('a guest the door never checked in cannot write a guest review', async () => {
  const s = await seed('nocheckin');
  await assert.rejects(submit(s, s.notCheckedIn), /not_at_event/);
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.vendor_guest_reviews WHERE vendor_profile_id = $1`,
    [s.vendorProfileId],
  );
  assert.equal(r.rows[0]!.n, 0);
});

test('a checked-in guest writes ONE guest review, public at once; a second is refused', async () => {
  const s = await seed('checkedin');
  const first = await submit(s, s.checkedIn, 4);
  assert.ok(first.rows[0]!.id, 'the writer returns the new review id');
  await assert.rejects(submit(s, s.checkedIn, 1), /already_reviewed/);

  // The public reads it THROUGH THE SERVER (service role, `hidden_at IS NULL`) — the same way the hosts' reviews are
  // read on /v/<slug>. anon has no REST door at all.
  const serverRead = await asServiceRole(() =>
    db.query<{ rating_overall: number; door: string }>(
      `SELECT rating_overall, door FROM public.vendor_guest_reviews WHERE vendor_profile_id = $1 AND hidden_at IS NULL`,
      [s.vendorProfileId],
    ),
  );
  assert.equal(serverRead.rows.length, 1, 'public at once — no approval queue');
  assert.equal(serverRead.rows[0]!.rating_overall, 4, 'the second submit did not overwrite the first');
  assert.equal(serverRead.rows[0]!.door, 'checkin');

  await db.exec(`SET ROLE anon`);
  try {
    await assert.rejects(
      db.query(`SELECT guest_id FROM public.vendor_guest_reviews WHERE vendor_profile_id = $1`, [s.vendorProfileId]),
      /permission denied/i,
      'anon must not read guest_id / event_id over REST',
    );
  } finally {
    await db.exec(`RESET ROLE`);
  }
});

test('nobody signed in can write a guest review directly, nor call the writer', async () => {
  const s = await seed('direct');
  await assert.rejects(
    asUser(s.coupleUserId, () =>
      db.query(
        `INSERT INTO public.vendor_guest_reviews (vendor_profile_id, event_id, guest_id, rating_overall, door)
         VALUES ($1,$2,$3,5,'checkin')`,
        [s.vendorProfileId, s.eventId, s.checkedIn],
      ),
    ),
    /permission denied|row-level security/i,
  );
  await assert.rejects(
    asUser(s.coupleUserId, () =>
      db.query(`SELECT public.vendor_guest_review_submit($1,$2,$3,NULL,5,NULL,NULL,'name')`, [
        s.eventId,
        s.checkedIn,
        s.vendorProfileId,
      ]),
    ),
    /permission denied/i,
  );
});

test('a guest review NEVER moves the shop stars — hosts only', async () => {
  const s = await seed('stars');
  await asUser(s.coupleUserId, () => db.query(HOST_INSERT, [s.vendorProfileId, s.eventId, s.coupleUserId, 5, s.serviceId]));
  await db.exec(`REFRESH MATERIALIZED VIEW public.vendor_review_stats`);
  const read = async () => {
    const raw = await db.query<{ avg: string; n: number }>(
      `SELECT avg_rating_overall::text AS avg, total_count AS n FROM public.vendor_review_stats WHERE vendor_profile_id = $1`,
      [s.vendorProfileId],
    );
    const trusted = await db.query<Record<string, unknown>>(
      `SELECT * FROM public.vendor_trusted_review_stats WHERE vendor_profile_id = $1`,
      [s.vendorProfileId],
    );
    return { raw: raw.rows[0], trusted: trusted.rows[0] ?? null };
  };
  const beforeGuest = await read();

  await submit(s, s.checkedIn, 1, 'One star, from a guest.');
  await db.exec(`REFRESH MATERIALIZED VIEW public.vendor_review_stats`);
  const afterGuest = await read();

  assert.deepEqual(afterGuest, beforeGuest, 'a 1-star guest review changed the hosts\' stars');
  const guestLine = await db.query<{ guest_review_count: number; guest_avg_rating: string }>(
    `SELECT guest_review_count, guest_avg_rating::text FROM public.vendor_guest_review_stats WHERE vendor_profile_id = $1`,
    [s.vendorProfileId],
  );
  assert.equal(guestLine.rows[0]!.guest_review_count, 1, 'the guest counts on its own line');
});

test('Setnayan admin hides a guest review — gone from the guests\' line at once', async () => {
  const s = await seed('hide');
  const { rows } = await submit(s, s.checkedIn, 2);
  const line = () =>
    asServiceRole(() => db.query(`SELECT 1 FROM public.vendor_guest_review_stats WHERE vendor_profile_id = $1`, [s.vendorProfileId]));
  assert.equal((await line()).rows.length, 1, 'precondition: counted while public');
  // Admin › Reviews hides through the service role (app/admin/reviews/actions.ts), stamping who.
  await asServiceRole(() =>
    db.query(`UPDATE public.vendor_guest_reviews SET hidden_at = NOW() WHERE review_id = $1`, [rows[0]!.id]),
  );
  assert.equal((await line()).rows.length, 0, 'a hidden review no longer counts');
  // And nobody signed in can un-hide it over REST.
  await assert.rejects(
    asUser(s.coupleUserId, () =>
      db.query(`UPDATE public.vendor_guest_reviews SET hidden_at = NULL WHERE review_id = $1`, [rows[0]!.id]),
    ),
    /permission denied/i,
  );
});

test('the shop replies to a guest review once, and only its own team can', async () => {
  const s = await seed('reply');
  const { rows } = await submit(s, s.checkedIn, 5);
  const reviewId = rows[0]!.id;
  // A stranger (the couple) is refused.
  await assert.rejects(
    asUser(s.coupleUserId, () => db.query(`SELECT public.vendor_guest_review_reply($1,'Thanks!')`, [reviewId])),
    /reply_refused/,
  );
  const owner = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [s.vendorProfileId],
  );
  const ownerId = owner.rows[0]!.user_id;
  await asUser(ownerId, () => db.query(`SELECT public.vendor_guest_review_reply($1,'Thank you, Gabriel!')`, [reviewId]));
  await assert.rejects(
    asUser(ownerId, () => db.query(`SELECT public.vendor_guest_review_reply($1,'Changed my mind')`, [reviewId])),
    /reply_refused/,
  );
  const r = await db.query<{ vendor_reply: string }>(`SELECT vendor_reply FROM public.vendor_guest_reviews WHERE review_id = $1`, [reviewId]);
  assert.equal(r.rows[0]!.vendor_reply, 'Thank you, Gabriel!', 'the first reply is final');
});

/* ── ✅ THE FLOOR: the REVIEWED supplier's booking must be complete, not any supplier's on the event ────────────── */

async function secondShop(tag: string, eventId: string, opts: { status: string; link: 'marketplace' | 'email' }) {
  const ownerId = await user(`gr-shop2-${tag}@example.com`);
  const email = `bookings-${tag}@shop2.example.com`;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, contact_email)
     VALUES ($1, 'Lights & Co.', 'Manila', ARRAY['photographer']::text[], 'verified', NOW(), $2)
     RETURNING vendor_profile_id`,
    [ownerId, email],
  );
  const id = vp.rows[0]!.vendor_profile_id;
  if (opts.link === 'marketplace') {
    await db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
       VALUES ($1,'photographer','Lights & Co.',$2,$3)`,
      [eventId, opts.status, id],
    );
  } else {
    await db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, contact_email)
       VALUES ($1,'photographer','Lights & Co.',$2,$3)`,
      [eventId, opts.status, email.toUpperCase()],
    );
  }
  return id;
}

test('the floor: a supplier whose OWN booking is not complete cannot be reviewed, even when another supplier delivered', async () => {
  const s = await seed('floor'); // Bloom & Co. is delivered on this event
  const notDone = await secondShop('floor', s.eventId, { status: 'contracted', link: 'marketplace' });
  await assert.rejects(
    asUser(s.coupleUserId, () => db.query(HOST_INSERT, [notDone, s.eventId, s.coupleUserId, 1, null])),
    /row-level security/i,
    'before this migration, Bloom & Co.’s delivery let the couple review a supplier still working',
  );
  assert.equal(await hostReviewCount(notDone), 0, 'nothing was written for the unfinished supplier');
  // …and the delivered one is still reviewable on the same event.
  await asUser(s.coupleUserId, () => db.query(HOST_INSERT, [s.vendorProfileId, s.eventId, s.coupleUserId, 5, s.serviceId]));
  assert.equal(await hostReviewCount(s.vendorProfileId), 1);
});

test('the floor: an older booking linked only by contact email is still found (case-insensitive), as the page finds it', async () => {
  const s = await seed('floor-email');
  const byEmail = await secondShop('floor-email', s.eventId, { status: 'delivered', link: 'email' });
  await asUser(s.coupleUserId, () => db.query(HOST_INSERT, [byEmail, s.eventId, s.coupleUserId, 4, null]));
  assert.equal(await hostReviewCount(byEmail), 1, 'a delivered email-linked booking stays reviewable');
});

test('the floor: a disputed booking freezes the review even when its status says delivered', async () => {
  const s = await seed('floor-dispute');
  await db.query(`UPDATE public.event_vendors SET completion_status = 'disputed' WHERE event_id = $1`, [s.eventId]);
  await assert.rejects(
    asUser(s.coupleUserId, () => db.query(HOST_INSERT, [s.vendorProfileId, s.eventId, s.coupleUserId, 5, s.serviceId])),
    /row-level security/i,
  );
  assert.equal(await hostReviewCount(s.vendorProfileId), 0);
});

test('the floor helper answers nothing about an event the caller does not host', async () => {
  const s = await seed('floor-oracle');
  const stranger = await user('gr-stranger-floor@example.com');
  const r = await asUser(stranger, () =>
    db.query<{ ok: boolean }>(`SELECT public.host_review_booking_is_complete($1,$2) AS ok`, [s.eventId, s.vendorProfileId]),
  );
  assert.equal(r.rows[0]!.ok, false, 'a delivered booking on somebody else’s event reads as false to a stranger');
});

/* ── § 2 Shown as ─────────────────────────────────────────────────────────────────────────────────────────────── */

test('Shown as: names by default, initials on request, and nothing else is accepted', async () => {
  const s = await seed('shownas');
  await asUser(s.coupleUserId, () => db.query(HOST_INSERT, [s.vendorProfileId, s.eventId, s.coupleUserId, 5, s.serviceId]));
  const r = await db.query<{ reviewer_display: string }>(
    `SELECT reviewer_display FROM public.vendor_reviews WHERE vendor_profile_id = $1`,
    [s.vendorProfileId],
  );
  assert.equal(r.rows[0]!.reviewer_display, 'names', 'every review before today reads exactly as it did');
  await db.query(`UPDATE public.vendor_reviews SET reviewer_display = 'initials' WHERE vendor_profile_id = $1`, [s.vendorProfileId]);
  await assert.rejects(
    db.query(`UPDATE public.vendor_reviews SET reviewer_display = 'anonymous' WHERE vendor_profile_id = $1`, [s.vendorProfileId]),
    /check constraint/i,
    'no anonymous review (owner, 6 Nov)',
  );
});

/* ── § 4 the card's own numbers ───────────────────────────────────────────────────────────────────────────────── */

test('the card’s numbers: the hosts’ trusted review lands on its card, a guest’s on the guests’ line — never crossed', async () => {
  const s = await seed('cardstats');
  await asUser(s.coupleUserId, () => db.query(HOST_INSERT, [s.vendorProfileId, s.eventId, s.coupleUserId, 4, s.serviceId]));
  await submit(s, s.checkedIn, 2);
  const host = await asServiceRole(() =>
    db.query<{ trusted_review_count: number; trusted_avg_rating: string }>(
      `SELECT trusted_review_count, trusted_avg_rating FROM public.vendor_service_trusted_review_stats
        WHERE vendor_profile_id = $1 AND service_id = $2`,
      [s.vendorProfileId, s.serviceId],
    ),
  );
  assert.equal(host.rows[0]?.trusted_review_count, 1);
  assert.equal(Number(host.rows[0]?.trusted_avg_rating), 4, 'the guest’s 2 stars never pull the card’s host number');
  const guests = await asServiceRole(() =>
    db.query<{ guest_review_count: number; guest_avg_rating: string }>(
      `SELECT guest_review_count, guest_avg_rating FROM public.vendor_guest_review_service_stats
        WHERE vendor_profile_id = $1 AND service_id = $2`,
      [s.vendorProfileId, s.serviceId],
    ),
  );
  assert.equal(guests.rows[0]?.guest_review_count, 1);
  assert.equal(Number(guests.rows[0]?.guest_avg_rating), 2);

  await db.exec(`SET ROLE anon`);
  try {
    await assert.rejects(
      db.query(`SELECT 1 FROM public.vendor_service_trusted_review_stats`),
      /permission denied/i,
      'server-only: the view reads tables the public cannot',
    );
  } finally {
    await db.exec(`RESET ROLE`);
  }
});

/* ── 🎁 the souvenir door: a guest the door never checked in, but whom THIS supplier's scanner gave a souvenir ──── */

test('a guest with only a SOUVENIR from this supplier’s scanner may review that supplier (and only that supplier)', async () => {
  const s = await seed('souvenir');
  // Before the scanner series (#7277) adds the supplier column, a souvenir proves nothing for any supplier.
  await db.query(`INSERT INTO public.guest_souvenir_claims (event_id, guest_id) VALUES ($1,$2)`, [s.eventId, s.notCheckedIn]);
  await assert.rejects(submit(s, s.notCheckedIn), /not_at_event/, 'a souvenir from the couple’s own desk names no supplier');

  // The column #7277 adds (`20271320327933_supplier_claim_scanner_once.sql` § 4) — installed here as it will be in prod.
  await db.exec(`ALTER TABLE public.guest_souvenir_claims
                   ADD COLUMN IF NOT EXISTS vendor_profile_id UUID
                     REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE SET NULL`);
  await assert.rejects(submit(s, s.notCheckedIn), /not_at_event/, 'still the couple’s desk (vendor_profile_id NULL)');

  // Another supplier's scanner handed it out → still not THIS supplier's proof.
  const otherShop = await secondShop('souvenir', s.eventId, { status: 'contracted', link: 'marketplace' });
  await db.query(`UPDATE public.guest_souvenir_claims SET vendor_profile_id = $1 WHERE guest_id = $2`, [otherShop, s.notCheckedIn]);
  await assert.rejects(submit(s, s.notCheckedIn), /not_at_event/, 'another supplier’s souvenir is not proof for this one');

  // THIS supplier's scanner handed it out → the guest may review this supplier, with the door recorded as souvenir.
  await db.query(`UPDATE public.guest_souvenir_claims SET vendor_profile_id = $1 WHERE guest_id = $2`, [s.vendorProfileId, s.notCheckedIn]);
  const made = await submit(s, s.notCheckedIn, 5, 'Loved the favour.');
  assert.ok(made.rows[0]!.id);
  const row = await db.query<{ door: string }>(`SELECT door FROM public.vendor_guest_reviews WHERE review_id = $1`, [made.rows[0]!.id]);
  assert.equal(row.rows[0]!.door, 'souvenir');
});
