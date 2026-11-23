/**
 * 🛡 FAKE PROOF FIXES A–D IN THE DATABASE (owner 2026-11-23, specs DECISION_LOG b89e2420 "Go, all five";
 * migration 20271361301072_fake_proof_counts_only_arms_length_events).
 *
 * The audit: a supplier could farm stars, medals and "events done" ALONE with extra couple accounts made from their
 * own emails, because every gate asked only "is the reviewer the shop's owner or team?".
 *
 * Fails if:
 *   A · the shop's OWN offered card (thread_service_interests added_by_role 'vendor', source 'vendor_offered') is
 *       counted as an inquiry — Quick Responder's list or Trending Now's couples;
 *   B · "different couples" counts EVENTS: one couple account booking several events must be one couple;
 *   C · a review or a finished job moves the stars / events done / track record when the event was not arm's length:
 *       an import with no Setnayan fact, an UNVERIFIED shop's "sourced" booking (the fee rule's hole, left in billing),
 *       a Shortlist QR booking, or real guests while N is NOT SET; or it stops counting when the couple found a
 *       verified shop on Setnayan, or when N is set and the event really had N guests; or the guest count can be padded
 *       with one email, or with the shop's own; or a non-counting review disappears from the public list instead of
 *       showing as the supplier's own client; or a deleted celebration loses the answer it had;
 *   D · a review the screener flagged is counted or listed while the flag is open or confirmed, or stays held after
 *       an admin's Dismiss;
 *   · fee billing changes (booking_fee_attribution_for still reads 'sourced' for the unverified shop);
 *   · any new function / view is reachable by anon or a signed-in user.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

async function newUser(email?: string): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email ?? `fake-proof-${n}@test.local`],
  );
  return u.rows[0]!.id;
}

async function newShop(verified = true): Promise<{ shop: string; ownerEmail: string; owner: string }> {
  n += 1;
  const ownerEmail = `fake-proof-owner-${n}@test.local`;
  const owner = await newUser(ownerEmail);
  const v = await db.query<{ vendor_profile_id: string }>(
    verified
      ? `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
         VALUES ($1, 'Proof Shop', 'Manila', ARRAY['photography']::text[], 'verified', NOW() - INTERVAL '100 days', 'verified')
         RETURNING vendor_profile_id`
      : `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
         VALUES ($1, 'Proof Shop', 'Manila', ARRAY['photography']::text[])
         RETURNING vendor_profile_id`,
    [owner],
  );
  return { shop: v.rows[0]!.vendor_profile_id, ownerEmail, owner };
}

async function newCard(shop: string): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active, primary_photo_r2_key, starting_price_php)
     VALUES ($1, 'photography', 'Proof Card', FALSE, 'r2://media/proof-cover.jpg', 15000) RETURNING vendor_service_id`,
    [shop],
  );
  const id = r.rows[0]!.vendor_service_id;
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label) VALUES ($1, $2, 'Full-day coverage')`,
    [id, shop],
  );
  await db.query(`UPDATE public.vendor_services SET is_active = TRUE WHERE vendor_service_id = $1`, [id]);
  return id;
}

/** An event owned by `couple` (a fresh account unless given). */
async function newEvent(couple?: string): Promise<{ event: string; couple: string }> {
  const c = couple ?? (await newUser());
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Proof Event', 'birthday') RETURNING event_id`,
  );
  const event = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [event, c]);
  return { event, couple: c };
}

/** A finished job of `shop` on `event`, linked to the shop, with the given booking source. */
async function finishedJob(shop: string, event: string, source: string): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id, source)
     VALUES ($1, 'photographer', 'Proof Shop', 'delivered', $2, $2, $3)`,
    [event, shop, source],
  );
}

async function review(shop: string, event: string, couple: string): Promise<string> {
  const r = await db.query<{ review_id: string }>(
    `INSERT INTO public.vendor_reviews
       (vendor_profile_id, event_id, couple_user_id, rating_overall,
        rating_communication, rating_quality, rating_value, rating_on_time, body, booked_through_setnayan)
     VALUES ($1, $2, $3, 5, 5, 5, 5, 5, 'Wonderful on the day.', TRUE)
     RETURNING review_id`,
    [shop, event, couple],
  );
  return r.rows[0]!.review_id;
}

async function refresh(): Promise<void> {
  await db.query(`REFRESH MATERIALIZED VIEW public.vendor_proof_events`);
  await db.query(`REFRESH MATERIALIZED VIEW public.vendor_trusted_review_stats`);
  await db.query(`REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats`);
}

async function route(shop: string, event: string): Promise<string | null> {
  const r = await db.query<{ r: string | null }>(`SELECT public.vendor_event_proof_route($1, $2) AS r`, [shop, event]);
  return r.rows[0]!.r;
}
async function stars(shop: string): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT trusted_review_count AS c FROM public.vendor_trusted_review_stats WHERE vendor_profile_id = $1`,
    [shop],
  );
  return Number(r.rows[0]?.c ?? -1);
}
async function eventsDone(shop: string): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT public_completed_count AS c FROM public.vendor_public_completed_events_stats WHERE vendor_profile_id = $1`,
    [shop],
  );
  return Number(r.rows[0]?.c ?? -1);
}
async function trackRecord(shop: string): Promise<number> {
  const r = await db.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM public.vendor_completed_events WHERE vendor_profile_id = $1`,
    [shop],
  );
  return Number(r.rows[0]!.c);
}
async function publicReview(reviewId: string): Promise<{ counts_as_proof: boolean } | null> {
  const r = await db.query<{ counts_as_proof: boolean }>(
    `SELECT counts_as_proof FROM public.vendor_reviews_public WHERE review_id = $1`,
    [reviewId],
  );
  return r.rows[0] ?? null;
}
async function setN(value: number | null): Promise<void> {
  await db.query(`INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`).catch(() => {});
  await db.query(`UPDATE public.platform_settings SET proof_real_guests_min = $1 WHERE id = 1`, [value]);
}
async function guests(event: string, emails: Array<string | null>, how: 'rsvp' | 'papic' = 'rsvp'): Promise<void> {
  for (const email of emails) {
    n += 1;
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, email, rsvp_status, rsvp_responded_at)
       VALUES ($1, 'Guest', $2, 'both', 'friends', $3, $4::public.rsvp_status, $5)
       RETURNING guest_id`,
      [event, `N${n}`, email, how === 'rsvp' ? 'attending' : 'pending', how === 'rsvp' ? new Date().toISOString() : null],
    );
    if (how === 'papic') {
      await db.query(`INSERT INTO public.papic_guest_captures (event_id, guest_id) VALUES ($1, $2)`, [event, g.rows[0]!.guest_id]);
    }
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setN(null);
});

after(async () => {
  await db?.close();
});

test('A · the shop’s own offered card is never an inquiry — not for Quick Responder, not for Trending Now', async () => {
  const { shop } = await newShop();
  const offered = await newCard(shop);
  const asked = await newCard(shop);
  const { event, couple } = await newEvent();
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'pending') RETURNING thread_id`,
    [event, shop, couple],
  );
  const thread = t.rows[0]!.thread_id;
  // The shop offers its own card (offerServiceCore) and posts its own message a moment later; the couple separately
  // asks about another card.
  await db.query(
    `INSERT INTO public.thread_service_interests (thread_id, vendor_service_id, source, added_by_role)
     VALUES ($1, $2, 'vendor_offered', 'vendor'), ($1, $3, 'couple_added', 'couple')`,
    [thread, offered, asked],
  );
  await db.query(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, is_bot)
     VALUES ($1, $2, $3, $4, 'vendor'::public.chat_sender_role, 'Offered: Proof Card', FALSE)`,
    [thread, event, shop, couple],
  );
  const cards = (
    await db.query<{ f: { cards: Array<{ id: string; inquiries: unknown[]; couples_now: number }> } }>(
      `SELECT public.service_card_badge_facts($1) AS f`,
      [shop],
    )
  ).rows[0]!.f.cards;
  const o = cards.find((c) => c.id === offered)!;
  const a = cards.find((c) => c.id === asked)!;
  assert.equal(o.inquiries.length, 0, 'A: the shop’s own offer scored as an inquiry answered inside the hour');
  assert.equal(o.couples_now, 0, 'A: the shop’s own offer padded Trending Now');
  // Control — the couple's own ask IS an inquiry (the filter is not simply "nothing counts").
  assert.equal(a.inquiries.length, 1, 'control: the couple’s own ask is an inquiry');
  assert.equal(a.couples_now, 1, 'control: the couple’s own ask counts for Trending Now');
});

test('B · one couple ACCOUNT booking several events is one couple; different accounts are different couples', async () => {
  const { shop } = await newShop();
  const card = await newCard(shop);
  const oneAccount = await newUser();
  const book = async (couple?: string) => {
    const { event } = await newEvent(couple);
    await db.query(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, deposit_recorded_at, deposit_paid_php, source)
       VALUES ($1, 'photographer', 'Proof Shop', 'deposit_paid', $2, $3, NOW() - INTERVAL '2 days', 1000, 'host_marketplace_search')`,
      [event, shop, card],
    );
  };
  for (let i = 0; i < 5; i += 1) await book(oneAccount);
  const read = async () =>
    (await db.query<{ f: { cards: Array<{ id: string; paid_bookings: number; paid_couples: number }> } }>(
      `SELECT public.service_card_badge_facts($1) AS f`,
      [shop],
    )).rows[0]!.f.cards.find((c) => c.id === card)!;
  let c = await read();
  assert.equal(c.paid_bookings, 5, 'fixture: five paid bookings');
  assert.equal(c.paid_couples, 1, 'B: five events of ONE couple account read as five couples');
  for (let i = 0; i < 4; i += 1) await book();
  c = await read();
  assert.equal(c.paid_couples, 5, 'B: four more accounts make five different couples');
});

test('C · only an arm’s-length event moves the stars, events done and the track record — the others still show', async () => {
  // (1) Found on Setnayan, by a verified shop → counts.
  const verified = await newShop(true);
  const found = await newEvent();
  await finishedJob(verified.shop, found.event, 'host_marketplace_search');
  const foundReview = await review(verified.shop, found.event, found.couple);

  // An import (the shop's own invite), no Setnayan fact → does not count while N is not set.
  const imported = await newEvent();
  await finishedJob(verified.shop, imported.event, 'vendor_invite');
  const importReview = await review(verified.shop, imported.event, imported.couple);
  await guests(imported.event, ['a@x.test', 'b@x.test', 'c@x.test']);

  // A Shortlist QR booking is the supplier's: not an event done on its own.
  const qr = await newEvent();
  await finishedJob(verified.shop, qr.event, 'vendor_shortlist_qr');

  await refresh();
  assert.equal(await route(verified.shop, found.event), 'found_on_setnayan');
  assert.equal(await route(verified.shop, imported.event), null, 'C: real guests counted while N is NOT SET');
  assert.equal(await route(verified.shop, qr.event), null, 'C: a Shortlist QR booking counted as found on Setnayan');
  assert.equal(await stars(verified.shop), 1, 'C: only the found-on-Setnayan review moves the stars');
  assert.equal(await eventsDone(verified.shop), 1, 'C: only the found-on-Setnayan job is an event done');
  assert.equal(await trackRecord(verified.shop), 1, 'C: only the found-on-Setnayan job is on the track record');

  // The non-counting review still SHOWS, as the supplier's own client.
  assert.deepEqual(await publicReview(foundReview), { counts_as_proof: true });
  assert.deepEqual(
    await publicReview(importReview),
    { counts_as_proof: false },
    'C: a review that does not count must still be listed, marked as the supplier’s own client',
  );

  // N set: the import with 3 distinct real guests now counts — and one email typed thrice is ONE guest.
  await setN(3);
  assert.equal(await route(verified.shop, imported.event), 'real_guests', 'C: N is set and the event had N real guests');
  const padded = await newEvent();
  await finishedJob(verified.shop, padded.event, 'vendor_invite');
  await guests(padded.event, ['same@x.test', 'SAME@x.test ', 'same@x.test']);
  await guests(padded.event, [verified.ownerEmail], 'papic');
  assert.equal(await route(verified.shop, padded.event), null, 'C: one email, or the shop’s own, padded the guest count');
  await guests(padded.event, ['d@x.test', 'e@x.test'], 'papic');
  assert.equal(await route(verified.shop, padded.event), 'real_guests', 'C: Papic captures count as real guests');
  await setN(null);
  assert.equal(await route(verified.shop, padded.event), null, 'C: clearing N must take the guest route away again');

  // (2) An UNVERIFIED shop's marketplace booking is billed as 'sourced' (99b6ab50) — and that billing is unchanged —
  // but it is not proof: the shop was not verified when it met the couple.
  const unverified = await newShop(false);
  const ev = await newEvent();
  await finishedJob(unverified.shop, ev.event, 'vendor_invite');
  const bill = await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [unverified.shop, ev.event]);
  assert.equal(bill.rows[0]!.a, 'sourced', 'FEE BILLING CHANGED: an unverified shop’s booking no longer pays the flat fee');
  assert.equal(await route(unverified.shop, ev.event), null, 'C: the unverified shop’s "sourced" import counted as proof');
});

/** Act as a signed-in person — the role alone is not an identity (without auth.uid() RLS refuses an anonymous
 *  caller and a test passes for the wrong reason). */
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
}

test('C · a deleted celebration keeps the answer it had, and an unanswered orphan does not count', async () => {
  const { shop, owner } = await newShop(true);
  const good = await newEvent();
  await finishedJob(shop, good.event, 'host_marketplace_search');
  const goodReview = await review(shop, good.event, good.couple);
  const bad = await newEvent();
  await finishedJob(shop, bad.event, 'vendor_invite');
  const badReview = await review(shop, bad.event, bad.couple);
  await refresh();
  assert.equal(await stars(shop), 1, 'fixture: one counting review');

  await db.query(`DELETE FROM public.events WHERE event_id = ANY($1::uuid[])`, [[good.event, bad.event]]);
  const stamps = await db.query<{ review_id: string; event_id: string | null; proof_at_delete: boolean | null }>(
    `SELECT review_id, event_id, proof_at_delete FROM public.vendor_reviews WHERE review_id = ANY($1::uuid[])`,
    [[goodReview, badReview]],
  );
  const byId = new Map(stamps.rows.map((r) => [r.review_id, r]));
  assert.equal(byId.get(goodReview)?.event_id, null, 'fixture: the review outlived its event');
  assert.equal(byId.get(goodReview)?.proof_at_delete, true, 'C: the arm’s-length answer was lost at the delete');
  assert.equal(byId.get(badReview)?.proof_at_delete, false, 'C: the non-arm’s-length review was stamped as proof');
  await refresh();
  assert.equal(await stars(shop), 1, 'C: the deleted celebration’s counting review stopped counting (or the other began)');

  // 🔒 The row is the supplier's, the field is not: through its own reply policy (which has no event_id clause) the
  // supplier writes a reply AND tries to stamp its orphaned non-proof review as proof.
  await asUser(owner, () =>
    db.query(`UPDATE public.vendor_reviews SET vendor_reply = 'Thank you!', proof_at_delete = TRUE WHERE review_id = $1`, [badReview]),
  );
  const forged = await db.query<{ vendor_reply: string | null; proof_at_delete: boolean | null }>(
    `SELECT vendor_reply, proof_at_delete FROM public.vendor_reviews WHERE review_id = $1`,
    [badReview],
  );
  assert.equal(forged.rows[0]!.vendor_reply, 'Thank you!', 'fixture: the supplier’s update must actually land (else RLS proved nothing)');
  assert.equal(forged.rows[0]!.proof_at_delete, false, 'C: a supplier forged proof on its own orphaned review');
  await refresh();
  assert.equal(await stars(shop), 1, 'C: the forged stamp moved the stars');
});

test('D · a flagged review is HELD out of the counts and the public list until an admin dismisses it', async () => {
  const { shop } = await newShop(true);
  const ev = await newEvent();
  await finishedJob(shop, ev.event, 'host_marketplace_search');
  const r = await review(shop, ev.event, ev.couple);
  await refresh();
  assert.equal(await stars(shop), 1, 'fixture: the review counts');

  await db.query(
    `INSERT INTO public.integrity_flags (kind, subject_vendor_id, subject_review_id, score, reason)
     VALUES ('review_fraud', $1, $2, 90, 'burst_velocity')`,
    [shop, r],
  );
  await refresh();
  assert.equal(await stars(shop), 0, 'D: an OPEN flag still counted in the stars');
  assert.equal(await publicReview(r), null, 'D: an OPEN flag still published the review');

  await db.query(`UPDATE public.integrity_flags SET status = 'confirmed_fraud' WHERE subject_review_id = $1`, [r]);
  await refresh();
  assert.equal(await stars(shop), 0, 'D: confirming the fraud published the review');

  await db.query(`UPDATE public.integrity_flags SET status = 'dismissed' WHERE subject_review_id = $1`, [r]);
  await refresh();
  assert.equal(await stars(shop), 1, 'D: Dismiss did not release the review');
  assert.deepEqual(await publicReview(r), { counts_as_proof: true });
});

test('· nothing new is reachable by anon or a signed-in user', async () => {
  for (const fn of [
    'public.vendor_event_proof_route(uuid, uuid)',
    'public.event_real_guest_count(uuid, uuid)',
    'public.event_couple_key(uuid)',
    'public.service_card_badge_facts(uuid)',
  ]) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, fn]);
      assert.equal(r.rows[0]!.ok, false, `${role} can EXECUTE ${fn}`);
    }
  }
  for (const rel of ['public.vendor_proof_events', 'public.vendor_reviews_public']) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(`SELECT has_table_privilege($1, $2, 'SELECT') AS ok`, [role, rel]);
      assert.equal(r.rows[0]!.ok, false, `${role} can SELECT ${rel}`);
    }
  }
});
