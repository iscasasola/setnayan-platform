/**
 * A SUPPLIER'S EVENT PHOTO WAITS 7 DAYS FOR THE GUESTS, AND A TAKEDOWN PULLS IT BACK OFF THE PAGE.
 *
 * Owner rulings (corpus DECISION_LOG.md): 2026-10-03 "A SUPPLIER'S OWN PAPIC PHOTOS GO ON ITS PORTFOLIO AUTOMATICALLY
 * AFTER A 7-DAY GUEST NOTICE" · 2026-10-28 "OWNER: Agree to all" (1) — honouring a takedown also removes the
 * supplier-held copies, and the 7-day notice comes before a supplier posts a guest photo.
 *
 * Before migration `supplier_page_photo_notice`, "Put on my page" appended the copy to `portfolio_r2_keys` the same
 * second (public, nobody told), and a takedown hid the ALBUM row while the page copy stayed up. Every assertion below
 * runs against the replayed schema; the supplier's half runs as the supplier's own signed-in session.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let vendorUserA: string;
let vendorUserB: string;
let vendorA: string;
let vendorB: string;
let eventId: string;
let otherEventId: string;

async function newUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function vendorOf(userId: string, name: string): Promise<string> {
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

let seq = 0;
async function albumPhoto(vendor: string, ev: string = eventId): Promise<{ photoId: string; pageRef: string }> {
  seq += 1;
  const r = await db.query<{ photo_id: string }>(
    `INSERT INTO public.vendor_papic_portfolio_photos
       (vendor_profile_id, event_id, r2_object_key, credits_spent, nsfw_checked)
     VALUES ($1, $2, $3, 1, TRUE) RETURNING photo_id`,
    [vendor, ev, `r2://setnayan-media/papic/vendor-${vendor}/portfolio/${ev}/p${seq}.jpg`],
  );
  // The same naming as lib/put-photo-on-my-page.ts `pagePhotoKeyFor`.
  return {
    photoId: r.rows[0]!.photo_id,
    pageRef: `r2://setnayan-media/vendors/${vendor}/portfolio/from-album/${ev}-p${seq}.jpg`,
  };
}

/** Run `fn` as the supplier's own signed-in session, then hand the connection back. */
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
}

/** The server's service-role writes (the publish job, a guest's Remove after the cookie check). */
async function asServer<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE service_role`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`);
  }
}

/** "Put on my page", as the shop owner's own session: the ONE door a notice is filed through. */
async function fileRpc(uid: string, photoId: string, pageRef: string): Promise<Record<string, unknown>> {
  return asUser(uid, async () => {
    const r = await db.query<{ j: Record<string, unknown> }>(
      `SELECT public.file_supplier_page_notice($1, $2) AS j`,
      [photoId, pageRef],
    );
    return r.rows[0]!.j;
  });
}

async function fileNotice(uid: string, photoId: string, _vendor: string, pageRef: string): Promise<string> {
  const j = await fileRpc(uid, photoId, pageRef);
  assert.equal(j.status, 'ok', `filing refused: ${JSON.stringify(j)}`);
  return String(j.notice_id);
}

async function walletBalance(vendor: string): Promise<number> {
  const r = await db.query<{ b: number }>(
    `SELECT COALESCE(SUM(delta), 0)::int AS b FROM public.shop_papic_wallet_entries WHERE vendor_profile_id = $1`,
    [vendor],
  );
  return r.rows[0]!.b;
}

async function pageRefs(vendor: string): Promise<string[]> {
  const r = await db.query<{ refs: string[] | null }>(
    `SELECT portfolio_r2_keys AS refs FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendor],
  );
  return r.rows[0]?.refs ?? [];
}

async function publish(noticeId: string): Promise<boolean> {
  return asServer(async () => {
    const r = await db.query<{ ok: boolean }>(`SELECT public.publish_supplier_page_photo($1) AS ok`, [noticeId]);
    return r.rows[0]!.ok;
  });
}

/** Seven days pass — written as the superuser, the way only time itself can. */
async function sevenDaysPass(noticeId: string): Promise<void> {
  await db.query(
    `UPDATE public.supplier_page_photo_notices
        SET noticed_at = NOW() - INTERVAL '8 days', public_from = NOW() - INTERVAL '1 day'
      WHERE notice_id = $1`,
    [noticeId],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);

  vendorUserA = await newUser('vendor-a-spn@test.test', 'vendor');
  vendorUserB = await newUser('vendor-b-spn@test.test', 'vendor');
  vendorA = await vendorOf(vendorUserA, 'Notice Studio A');
  vendorB = await vendorOf(vendorUserB, 'Notice Studio B');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Notice event', 'celebration') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
  const ev2 = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Another event', 'celebration') RETURNING event_id`,
  );
  otherEventId = ev2.rows[0]!.event_id;
});

after(async () => {
  await db?.close();
});

test('replay applies every migration (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · the owner files the notice through the ONE door — the 7 days are stamped, never supplied; no direct write', async () => {
  const { photoId, pageRef } = await albumPhoto(vendorA);
  const j = await fileRpc(vendorUserA, photoId, pageRef);
  assert.equal(j.status, 'ok');
  const noticeId = String(j.notice_id);
  const n = await db.query<{ days: number; published_at: string | null }>(
    `SELECT EXTRACT(EPOCH FROM (public_from - NOW())) / 86400 AS days, published_at
       FROM public.supplier_page_photo_notices WHERE notice_id = $1`,
    [noticeId],
  );
  assert.ok(Number(n.rows[0]!.days) > 6.99, `the window is ${n.rows[0]!.days} days, not 7`);
  assert.equal(n.rows[0]!.published_at, null);
  // A second tap answers from the notice that exists — never a second one, never a restarted window.
  const again = await fileRpc(vendorUserA, photoId, pageRef);
  assert.equal(again.status, 'exists');
  assert.equal(String(again.notice_id), noticeId);

  // No session can write the table itself — a direct INSERT would skip the wallet (and could name a window).
  const p2 = await albumPhoto(vendorA);
  await assert.rejects(
    asUser(vendorUserA, () =>
      db.query(
        `INSERT INTO public.supplier_page_photo_notices (photo_id, vendor_profile_id, event_id, page_ref)
         VALUES ($1, $2, $3, $4)`,
        [p2.photoId, vendorA, eventId, p2.pageRef],
      ),
    ),
    /permission denied/,
    'a supplier can file a notice past the wallet',
  );
  await assert.rejects(
    asUser(vendorUserA, () =>
      db.query(`UPDATE public.supplier_page_photo_notices SET published_at = NOW() WHERE notice_id = $1`, [noticeId]),
    ),
    /permission denied/,
    'the supplier can stamp its own publish',
  );
  // It does not reach the page before the 7 days — the publish refuses and the page is unchanged.
  assert.equal(await publish(noticeId), false, 'the publish ran before the 7 days were up');
  assert.ok(!(await pageRefs(vendorA)).includes(pageRef), 'the photo is public before the guests had their 7 days');
});

test('2 · tenancy: never another shop’s album photo, never a ref outside the shop’s own folder', async () => {
  const theirs = await albumPhoto(vendorB);
  const j = await fileRpc(vendorUserA, theirs.photoId, theirs.pageRef.replace(vendorB, vendorA));
  assert.equal(j.status, 'not_owner', 'shop A queued shop B’s album photo for its page');
  const mine = await albumPhoto(vendorA);
  await assert.rejects(
    fileRpc(vendorUserA, mine.photoId, `r2://setnayan-media/vendors/${vendorB}/portfolio/from-album/x.jpg`),
    /supplier_page_photo_notices_own_folder/,
    'a notice can name a file in another shop’s folder',
  );
});

test('2b · 💳 past the free room a page photo costs 1 credit from the shop wallet — and the WAITING photos count', async () => {
  // A fresh shop: 49 photos on the page + 1 waiting = the free 50 used. The next one is past it.
  const userC = await newUser('vendor-c-spn@test.test', 'vendor');
  const vendorC = await vendorOf(userC, 'Notice Studio C');
  const own = Array.from({ length: 49 }, (_, i) => `r2://setnayan-media/vendors/${vendorC}/portfolio/own-${i}.jpg`);
  await db.query(`UPDATE public.vendor_profiles SET portfolio_r2_keys = $2 WHERE vendor_profile_id = $1`, [vendorC, own]);
  const waiting = await albumPhoto(vendorC);
  const w = await fileRpc(userC, waiting.photoId, waiting.pageRef);
  assert.equal(w.status, 'ok');
  assert.equal(Number(w.charged), 0, 'the 50th photo (inside the free room) was charged');

  // 51st — counting the waiting one — costs a credit. An empty wallet files NOTHING.
  const next = await albumPhoto(vendorC);
  const short = await fileRpc(userC, next.photoId, next.pageRef);
  assert.equal(short.status, 'insufficient', `a photo past the free room went in unpaid: ${JSON.stringify(short)}`);
  assert.equal(Number(short.charge), 1);
  const none = await db.query(`SELECT 1 FROM public.supplier_page_photo_notices WHERE photo_id = $1`, [next.photoId]);
  assert.equal(none.rows.length, 0, 'a refused charge still filed the notice');

  await db.query(
    `INSERT INTO public.shop_papic_wallet_entries (vendor_profile_id, delta, kind, note) VALUES ($1, 5, 'comp', 'test')`,
    [vendorC],
  );
  const paid = await fileRpc(userC, next.photoId, next.pageRef);
  assert.equal(paid.status, 'ok');
  assert.equal(Number(paid.charged), 1, 'the photo past the free room was not charged');
  assert.equal(await walletBalance(vendorC), 4);
  const row = await db.query<{ kind: string; delta: number }>(
    `SELECT kind, delta FROM public.shop_papic_wallet_entries WHERE vendor_profile_id = $1 AND spend_ref = $2`,
    [vendorC, `page-notice:${paid.notice_id}`],
  );
  assert.deepEqual(row.rows[0], { kind: 'portfolio_spend', delta: -1 });

  // The publish never charges again — the photo was paid at the tap.
  await sevenDaysPass(String(paid.notice_id));
  assert.equal(await publish(String(paid.notice_id)), true);
  assert.equal(await walletBalance(vendorC), 4, 'the publish charged a photo that was already paid');
});

test('3 · after 7 days with nobody removing it, it goes up — and a takedown pulls it straight back off', async () => {
  const { photoId, pageRef } = await albumPhoto(vendorA);
  const noticeId = await fileNotice(vendorUserA, photoId, vendorA, pageRef);
  await sevenDaysPass(noticeId);
  assert.equal(await publish(noticeId), true, 'a photo past its 7 days did not go up');
  assert.ok((await pageRefs(vendorA)).includes(pageRef), 'published, but not on the page gallery');

  // The moderator honours a guest's takedown: `hideReportedPhoto` sets hidden_at on the ALBUM row (service role).
  await asServer(() =>
    db.query(`UPDATE public.vendor_papic_portfolio_photos SET hidden_at = NOW() WHERE photo_id = $1`, [photoId]),
  );
  assert.ok(!(await pageRefs(vendorA)).includes(pageRef), '🚨 the takedown hid the album photo and left the page copy up');
  const n = await db.query<{ removed_by: string | null }>(
    `SELECT removed_by FROM public.supplier_page_photo_notices WHERE notice_id = $1`,
    [noticeId],
  );
  assert.equal(n.rows[0]!.removed_by, 'takedown');
  // And it can never come back: a later publish refuses.
  assert.equal(await publish(noticeId), false);
  assert.ok(!(await pageRefs(vendorA)).includes(pageRef));
});

test('4 · a takedown DURING the window means it never goes up at all', async () => {
  const { photoId, pageRef } = await albumPhoto(vendorA);
  const noticeId = await fileNotice(vendorUserA, photoId, vendorA, pageRef);
  await asServer(() =>
    db.query(`UPDATE public.vendor_papic_portfolio_photos SET hidden_at = NOW() WHERE photo_id = $1`, [photoId]),
  );
  await sevenDaysPass(noticeId);
  assert.equal(await publish(noticeId), false, 'a taken-down photo went up when its window ended');
  assert.ok(!(await pageRefs(vendorA)).includes(pageRef));
});

test('5 · a guest’s Remove — before it goes up it never does; after, it comes straight off; bound to the event', async () => {
  const before_ = await albumPhoto(vendorA);
  const n1 = await fileNotice(vendorUserA, before_.photoId, vendorA, before_.pageRef);

  // A photo id posted from ANOTHER event's page matches nothing.
  const wrong = await asServer(() =>
    db.query<{ status: string }>(`SELECT status FROM public.remove_supplier_page_photo($1, $2)`, [before_.photoId, otherEventId]),
  );
  assert.equal(wrong.rows[0]!.status, 'not_found', 'a guest of another event removed this photo');

  const ok = await asServer(() =>
    db.query<{ status: string; page_ref: string }>(
      `SELECT status, page_ref FROM public.remove_supplier_page_photo($1, $2)`,
      [before_.photoId, eventId],
    ),
  );
  assert.equal(ok.rows[0]!.status, 'removed');
  assert.equal(ok.rows[0]!.page_ref, before_.pageRef, 'the server is not told which file to delete');
  await sevenDaysPass(n1);
  assert.equal(await publish(n1), false, 'a photo a guest removed went up anyway after 7 days');
  assert.ok(!(await pageRefs(vendorA)).includes(before_.pageRef));

  // The supplier cannot re-post it by tapping again — one notice per photo, ever.
  const again = await fileRpc(vendorUserA, before_.photoId, before_.pageRef);
  assert.equal(again.status, 'exists', 'a removed photo was filed a second time');
  assert.equal(again.removed_by, 'guest');

  // Remove keeps working after it went up (ruling (4)).
  const afterUp = await albumPhoto(vendorA);
  const n2 = await fileNotice(vendorUserA, afterUp.photoId, vendorA, afterUp.pageRef);
  await sevenDaysPass(n2);
  assert.equal(await publish(n2), true);
  assert.ok((await pageRefs(vendorA)).includes(afterUp.pageRef));
  await asServer(() => db.query(`SELECT * FROM public.remove_supplier_page_photo($1, $2)`, [afterUp.photoId, eventId]));
  assert.ok(!(await pageRefs(vendorA)).includes(afterUp.pageRef), 'a Remove after it went up left it on the page');
});

test('6 · nobody but the server can run the publish or the remove — not a supplier, not a stranger', async () => {
  const { photoId, pageRef } = await albumPhoto(vendorA);
  const noticeId = await fileNotice(vendorUserA, photoId, vendorA, pageRef);
  await sevenDaysPass(noticeId);
  await assert.rejects(
    asUser(vendorUserA, () => db.query(`SELECT public.publish_supplier_page_photo($1)`, [noticeId])),
    /permission denied/,
    'a supplier can publish its own photo',
  );
  await assert.rejects(
    asUser(vendorUserB, () => db.query(`SELECT * FROM public.remove_supplier_page_photo($1, $2)`, [photoId, eventId])),
    /permission denied/,
    'any signed-in account can remove a supplier’s photo',
  );
  await db.exec(`SET ROLE anon`);
  try {
    await assert.rejects(db.query(`SELECT public.publish_supplier_page_photo($1)`, [noticeId]), /permission denied/);
    await assert.rejects(db.query(`SELECT * FROM public.supplier_page_photo_notices`), /permission denied/);
  } finally {
    await db.exec(`RESET ROLE`);
  }
});

test('7 · RLS: a supplier reads only its own notices', async () => {
  const mine = await asUser(vendorUserA, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.supplier_page_photo_notices`)).rows[0]!.n,
  );
  const theirs = await asUser(vendorUserB, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.supplier_page_photo_notices`)).rows[0]!.n,
  );
  assert.ok(mine > 0, 'supplier A cannot read its own notices — a vacuous check');
  assert.equal(theirs, 0, 'supplier B reads supplier A’s notices');
});

test('8 · the backfill: a photo already on a page with NO notice comes off — hidden ones for good, visible ones into a 7-day notice', async () => {
  // The world before this migration: "Put on my page" appended the copy straight to the gallery.
  const visible = await albumPhoto(vendorB);
  const hidden = await albumPhoto(vendorB);
  await db.query(
    `UPDATE public.vendor_profiles SET portfolio_r2_keys = COALESCE(portfolio_r2_keys, ARRAY[]::text[]) || ARRAY[$2, $3, 'r2://setnayan-media/vendors/keep-me.jpg']
      WHERE vendor_profile_id = $1`,
    [vendorB, visible.pageRef, hidden.pageRef],
  );
  await db.query(`UPDATE public.vendor_papic_portfolio_photos SET hidden_at = NOW() WHERE photo_id = $1`, [hidden.photoId]);
  // The trigger needs a notice to know the page ref, and these legacy copies have none — so the leak is still live.
  assert.ok((await pageRefs(vendorB)).includes(hidden.pageRef), 'precondition: the legacy leak is not reproduced');

  // Re-apply the migration (it is written idempotent, as every migration must be).
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_supplier_page_photo_notice.sql'));
  assert.ok(file, 'the migration file was not found');
  await db.exec(readFileSync(join(dir, file!), 'utf8'));

  const refs = await pageRefs(vendorB);
  assert.ok(!refs.includes(hidden.pageRef), '🚨 a taken-down photo is still on the page after the backfill');
  assert.ok(!refs.includes(visible.pageRef), 'a photo that went up with no notice stayed up without one');
  assert.ok(refs.includes('r2://setnayan-media/vendors/keep-me.jpg'), 'the backfill removed a photo that was never from an album');
  const n = await db.query<{ photo_id: string; days: number; removed_at: string | null }>(
    `SELECT photo_id, EXTRACT(EPOCH FROM (public_from - NOW())) / 86400 AS days, removed_at
       FROM public.supplier_page_photo_notices WHERE photo_id = ANY($1::uuid[])`,
    [[visible.photoId, hidden.photoId]],
  );
  assert.deepEqual(n.rows.map((r) => r.photo_id), [visible.photoId], 'the hidden photo got a notice, or the visible one did not');
  assert.ok(Number(n.rows[0]!.days) > 6.99, 'the visible photo was not given the full 7 days');
});
