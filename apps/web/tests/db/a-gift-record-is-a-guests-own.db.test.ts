/**
 * "I SENT IT" — THE ONE WRITER OF A GIFT RECORD, RUN FOR REAL: `recordGift`
 * (`lib/gift-record.server.ts`) called against the REPLAYED schema.
 *
 * ⚖ Owner 2026-10-08 (DECISION_LOG "E-GIFTS WISH LIST"): "when people send
 * gcash, they also give screenshot of their payment and the vallue and their
 * message for the couple. this will be the way to measure." · "it will
 * accumulate all the gift and mark them one by one" · "when amount is reached."
 *
 * `event_gift_records` gives no browser role INSERT, so the row is written with
 * the service role and `recordGift` is the WHOLE fence. Each test is one hole in
 * that fence:
 *
 *   1. an invited guest of THIS event is kept — under their invitation's own
 *      name, with their guest id, toward the wish they named;
 *   2. 🔒 who is NOT kept: nobody (no session) · a guest of ANOTHER event · a
 *      session naming somebody else's guest row · a guest REMOVED from the list;
 *   3. a guest who DECLINED is still a guest: the design's rule is recognition,
 *      not attendance — not coming is exactly when a gift is sent instead;
 *   4. 🔒 the wish must be THIS event's;
 *   5. the event must accept gifts and have a way to give switched on;
 *   6. the amount is a whole number of pesos above zero — and nothing caps it;
 *   7. the word and the name fit; the invitation's name cannot be overridden;
 *   8. 🔒 the screenshot must be the guest's OWN private upload;
 *   9. "when amount is reached": the wish marks itself — never one with no
 *      price, never over the couple's own mark, never counting a removed record;
 *  10. 🔒 it only works as the service role: handed a browser's own client, it
 *      keeps nothing and says so.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • the session's event not compared to the event asked for   → 2 red;
 *   • the guest row's `deleted_at` not asked                    → 2 red;
 *   • the wish read without `.eq('event_id', …)`                → 4 red;
 *   • the gifts-on / way-to-give check removed                  → 5 red;
 *   • the screenshot held to the EVENT's folder, not the guest's → 8 red;
 *   • `gotAfterGifts` not consulted after the insert            → 9 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import './supabase-over-pglite'; // installs the `server-only` shim before the writer loads
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { SERVICE, clientAs } from './pglite-client';
import {
  GIFT_AMOUNT_NEEDED,
  GIFT_MESSAGE_TOO_LONG,
  GIFT_NAME_NEEDED,
  GIFT_NAME_TOO_LONG,
  GIFT_NOT_ACCEPTING,
  GIFT_NOT_RECOGNISED,
  GIFT_SHOT_REFUSED,
  GIFT_WISH_GONE,
} from '../../lib/gift-record';

type Writer = typeof import('../../lib/gift-record.server');
let W: Writer;
let replay: ReplayResult;
let db: PGlite;

let EVENT = '';
let OTHER_EVENT = '';
let NENE = ''; // guest of EVENT
let JUN = ''; // guest of EVENT, declined
let GONE = ''; // guest of EVENT, removed from the list
let NAMELESS = ''; // guest of EVENT with no name on the invitation
let OUTSIDER = ''; // guest of OTHER_EVENT
let HOST_USER = '';
let AIR = ''; // S89H- public id, ₱4,500
let AIR_ROW = '';
let ANY = ''; // no price
let HOSTMARK = ''; // marked by the couple
let ELSEWHERE = ''; // a wish on OTHER_EVENT

async function newEvent(name: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ($1, 'birthday', $2) RETURNING event_id`,
    [name, name.toLowerCase().replace(/[^a-z]+/g, '-')],
  );
  return ev.rows[0]!.event_id;
}
async function newGuest(eventId: string, first: string, last: string, extra = ''): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, $2, $3, 'both', 'friends') RETURNING guest_id`,
    [eventId, first, last],
  );
  if (extra) await db.query(`UPDATE public.guests SET ${extra} WHERE guest_id = $1`, [g.rows[0]!.guest_id]);
  return g.rows[0]!.guest_id;
}
async function newWish(eventId: string, name: string, price: number | null): Promise<{ row: string; pub: string }> {
  const w = await db.query<{ wish_item_id: string; public_id: string }>(
    `INSERT INTO public.event_wish_items (event_id, name, price_php) VALUES ($1, $2, $3) RETURNING wish_item_id, public_id`,
    [eventId, name, price],
  );
  return { row: w.rows[0]!.wish_item_id, pub: w.rows[0]!.public_id };
}
type Rec = { wish_item_id: string | null; amount_php: number; giver_name: string; giver_guest_id: string | null; message: string | null; screenshot_r2_key: string | null; method_kind: string | null; removed_at: string | null };
async function records(eventId = EVENT): Promise<Rec[]> {
  const r = await db.query<Rec>(
    `SELECT wish_item_id, amount_php, giver_name, giver_guest_id, message, screenshot_r2_key, method_kind, removed_at
       FROM public.event_gift_records WHERE event_id = $1 ORDER BY created_at, gift_record_id`,
    [eventId],
  );
  return r.rows;
}
const count = async () => (await records()).length + (await records(OTHER_EVENT)).length;
const admin = () => clientAs(db, SERVICE);
const as = (guestId: string, eventId = EVENT) => ({ guest_id: guestId, event_id: eventId });
const gotOf = async (row: string) =>
  (await db.query<{ got_by: string | null; got_at: string | null }>(`SELECT got_by, got_at FROM public.event_wish_items WHERE wish_item_id = $1`, [row])).rows[0]!;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  W = await import('../../lib/gift-record.server');

  EVENT = await newEvent('Maria and Jose');
  OTHER_EVENT = await newEvent('Somebody Else');
  NENE = await newGuest(EVENT, 'Nene', 'Reyes', `display_name = 'Tita Nene'`);
  JUN = await newGuest(EVENT, 'Jun', 'Cruz', `rsvp_status = 'declined'`);
  GONE = await newGuest(EVENT, 'Old', 'Friend', `deleted_at = now()`);
  NAMELESS = await newGuest(EVENT, '', '');
  OUTSIDER = await newGuest(OTHER_EVENT, 'Cora', 'Lim');

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ('couple@gift-record.test', jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
  );
  HOST_USER = u.rows[0]!.id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [EVENT, HOST_USER]);

  for (const ev of [EVENT, OTHER_EVENT]) {
    await db.query(
      `INSERT INTO public.event_egift_methods (event_id, method_kind, label, handle, is_enabled) VALUES ($1, 'gcash', 'GCash', '0917 123 4567', true)`,
      [ev],
    );
  }
  const air = await newWish(EVENT, 'Air fryer', 4500);
  AIR = air.pub;
  AIR_ROW = air.row;
  ANY = (await newWish(EVENT, 'Honeymoon fund', null)).pub;
  const hm = await newWish(EVENT, 'Coffee maker', 6000);
  HOSTMARK = hm.pub;
  await db.query(`UPDATE public.event_wish_items SET got_at = now(), got_by = 'host' WHERE wish_item_id = $1`, [hm.row]);
  ELSEWHERE = (await newWish(OTHER_EVENT, 'Rice cooker', 3200)).pub;
});

after(async () => {
  await replay?.db?.close?.();
});

// ── 1 ───────────────────────────────────────────────────────────────────────

test('1 · an invited guest of this event is kept — their invitation’s name, their guest id, the wish they named', async () => {
  const shot = `r2://setnayan-thread-files/gift-shots/${EVENT}/${NENE}/a1.jpg`;
  const res = await W.recordGift(admin(), as(NENE), EVENT, {
    wishId: AIR,
    amount: '2,000',
    message: '  For your merienda machine!  ',
    name: 'Somebody Else Entirely',
    shotRef: shot,
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(
    { giverName: res.giverName, amountPhp: res.amountPhp, wishName: res.wishName, hasShot: res.hasShot, hasMessage: res.hasMessage, nowGot: res.nowGot },
    { giverName: 'Tita Nene', amountPhp: 2000, wishName: 'Air fryer', hasShot: true, hasMessage: true, nowGot: false },
  );
  const rows = await records();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    wish_item_id: AIR_ROW,
    amount_php: 2000,
    giver_name: 'Tita Nene',
    giver_guest_id: NENE,
    message: 'For your merienda machine!',
    screenshot_r2_key: shot,
    method_kind: 'gcash', // one way to give is on, so it is known
    removed_at: null,
  });
});

test('1 · a gift toward no wish is kept as "Any gift"; with two ways on, the way is not guessed', async () => {
  await db.query(
    `INSERT INTO public.event_egift_methods (event_id, method_kind, label, handle, is_enabled) VALUES ($1, 'bank', 'BPI', '1234 5678 90', true)`,
    [EVENT],
  );
  const res = await W.recordGift(admin(), as(NENE), EVENT, { amount: 5000 });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.wishName, null);
  const last = (await records()).at(-1)!;
  assert.equal(last.wish_item_id, null);
  assert.equal(last.method_kind, null, 'two ways are on — which one they used is not known, and not guessed');
  assert.deepEqual([last.message, last.screenshot_r2_key], [null, null], 'a screenshot is asked for, never demanded');
});

// ── 2 ───────────────────────────────────────────────────────────────────────

test('2 · 🔒 nobody, a guest of another event, a borrowed guest id, a removed guest — none is kept', async () => {
  const before = await count();
  const refused = async (label: string, session: Parameters<Writer['recordGift']>[1], eventId = EVENT) => {
    const res = await W.recordGift(admin(), session, eventId, { wishId: eventId === EVENT ? AIR : ELSEWHERE, amount: 500 });
    assert.equal(res.ok, false, `${label}: a record was kept`);
    if (!res.ok) assert.equal(res.error, GIFT_NOT_RECOGNISED, `${label}: refused in the wrong words`);
  };
  await refused('no session', null);
  await refused('a guest of another event, asking for this one', as(OUTSIDER, OTHER_EVENT));
  await refused('a session that claims this event for another event’s guest', as(OUTSIDER, EVENT));
  await refused('this event’s guest, asking to write into another event', as(NENE, EVENT), OTHER_EVENT);
  await refused('a guest removed from the list', as(GONE));
  await refused('a guest id that does not exist', as('00000000-0000-4000-8000-00000000dead'));
  assert.equal(await count(), before, 'a refused "I sent it" wrote a record');
});

// ── 3 ───────────────────────────────────────────────────────────────────────

test('3 · a guest who declined is still a guest — they can tell the couple what they sent', async () => {
  const status = await db.query<{ rsvp_status: string }>(`SELECT rsvp_status::text AS rsvp_status FROM public.guests WHERE guest_id = $1`, [JUN]);
  assert.equal(status.rows[0]!.rsvp_status, 'declined', 'the fixture is not a declined guest');
  const res = await W.recordGift(admin(), as(JUN), EVENT, { wishId: ANY, amount: 1500, message: 'Sorry we cannot come!' });
  assert.equal(res.ok, true, 'a declined guest was turned away');
  const mine = (await records()).filter((r) => r.giver_guest_id === JUN);
  assert.equal(mine.length, 1);
  assert.equal(mine[0]!.giver_name, 'Jun Cruz');
});

// ── 4 ───────────────────────────────────────────────────────────────────────

test('4 · 🔒 the wish must be this event’s', async () => {
  const before = await count();
  for (const wishId of [ELSEWHERE, 'S89H-0000000000', 'not-an-id', `${AIR}' OR '1'='1`]) {
    const res = await W.recordGift(admin(), as(NENE), EVENT, { wishId, amount: 500 });
    assert.equal(res.ok, false, `kept toward ${wishId}`);
    if (!res.ok) assert.equal(res.error, GIFT_WISH_GONE);
  }
  assert.equal(await count(), before);
});

// ── 5 ───────────────────────────────────────────────────────────────────────

test('5 · the event must accept gifts, and have a way to give switched on', async () => {
  const before = await count();
  await db.query(`UPDATE public.events SET gifts_on = false WHERE event_id = $1`, [EVENT]);
  let res = await W.recordGift(admin(), as(NENE), EVENT, { wishId: AIR, amount: 500 });
  assert.deepEqual(res, { ok: false, error: GIFT_NOT_ACCEPTING }, 'Accept gifts? — No');
  await db.query(`UPDATE public.events SET gifts_on = NULL WHERE event_id = $1`, [EVENT]);

  await db.query(`UPDATE public.event_egift_methods SET is_enabled = false WHERE event_id = $1`, [EVENT]);
  res = await W.recordGift(admin(), as(NENE), EVENT, { wishId: AIR, amount: 500 });
  assert.deepEqual(res, { ok: false, error: GIFT_NOT_ACCEPTING }, 'no way to give is on');
  await db.query(`UPDATE public.event_egift_methods SET is_enabled = true WHERE event_id = $1`, [EVENT]);

  assert.equal(await count(), before);
  assert.equal((await W.recordGift(admin(), as(NENE), EVENT, { wishId: ANY, amount: 100 })).ok, true, 'never answered = gifts are on');
});

// ── 6 ───────────────────────────────────────────────────────────────────────

test('6 · the amount: a whole number of pesos above zero — and nothing caps it', async () => {
  const before = await count();
  for (const amount of [undefined, '', '0', 0, -500, '-5', '1.50', 'five hundred', '1e9', '1234567890', {}]) {
    const res = await W.recordGift(admin(), as(NENE), EVENT, { wishId: ANY, amount });
    assert.deepEqual(res, { ok: false, error: GIFT_AMOUNT_NEEDED }, `kept: ${String(amount)}`);
  }
  assert.equal(await count(), before);
  const big = await W.recordGift(admin(), as(NENE), EVENT, { wishId: ANY, amount: '₱999,999,999' });
  assert.equal(big.ok && big.amountPhp, 999_999_999, 'a large gift is the guest’s to say — no cap was invented');
});

// ── 7 ───────────────────────────────────────────────────────────────────────

test('7 · the word and the name fit their columns; a nameless invitation must say who it is from', async () => {
  const before = await count();
  assert.deepEqual(await W.recordGift(admin(), as(NENE), EVENT, { amount: 500, message: 'x'.repeat(241) }), { ok: false, error: GIFT_MESSAGE_TOO_LONG });
  assert.deepEqual(await W.recordGift(admin(), as(NAMELESS), EVENT, { amount: 500 }), { ok: false, error: GIFT_NAME_NEEDED });
  assert.deepEqual(await W.recordGift(admin(), as(NAMELESS), EVENT, { amount: 500, name: '   ' }), { ok: false, error: GIFT_NAME_NEEDED });
  assert.deepEqual(await W.recordGift(admin(), as(NAMELESS), EVENT, { amount: 500, name: 'x'.repeat(81) }), { ok: false, error: GIFT_NAME_TOO_LONG });
  assert.equal(await count(), before);

  const res = await W.recordGift(admin(), as(NAMELESS), EVENT, { amount: 500, name: '  Ate Grace  ', message: 'x'.repeat(240) });
  assert.equal(res.ok && res.giverName, 'Ate Grace');
});

// ── 8 ───────────────────────────────────────────────────────────────────────

test('8 · 🔒 the screenshot must be the guest’s own private upload', async () => {
  const before = await count();
  for (const shotRef of [
    `r2://setnayan-thread-files/gift-shots/${EVENT}/${JUN}/theirs.jpg`, // another guest's
    `r2://setnayan-thread-files/gift-shots/${OTHER_EVENT}/${NENE}/x.jpg`, // another event's folder
    `r2://setnayan-media/gift-shots/${EVENT}/${NENE}/x.jpg`, // the PUBLIC bucket
    `r2://setnayan-thread-files/pabuya-qr/${EVENT}/qr.jpg`, // the couple's QR
    `r2://setnayan-thread-files/gift-shots/${EVENT}/${NENE}/../${JUN}/x.jpg`,
    'https://evil.example/shot.jpg',
  ]) {
    const res = await W.recordGift(admin(), as(NENE), EVENT, { wishId: ANY, amount: 500, shotRef });
    assert.deepEqual(res, { ok: false, error: GIFT_SHOT_REFUSED }, `kept: ${shotRef}`);
  }
  assert.equal(await count(), before);
});

// ── 9 ───────────────────────────────────────────────────────────────────────

test('9 · "when amount is reached": the wish marks itself — and only then', async () => {
  // ₱2,000 is on the air fryer from test 1. A removed record must not count toward ₱4,500.
  await db.query(
    `INSERT INTO public.event_gift_records (event_id, wish_item_id, amount_php, giver_name, removed_at) VALUES ($1, $2, 9000, 'Removed', now())`,
    [EVENT, AIR_ROW],
  );
  let res = await W.recordGift(admin(), as(JUN), EVENT, { wishId: AIR, amount: 2000 });
  assert.equal(res.ok && res.nowGot, false, '₱4,000 of ₱4,500 — a removed ₱9,000 was counted');
  assert.deepEqual(await gotOf(AIR_ROW), { got_by: null, got_at: null });

  res = await W.recordGift(admin(), as(NENE), EVENT, { wishId: AIR, amount: 500 });
  assert.equal(res.ok && res.nowGot, true, '₱4,500 of ₱4,500 did not mark the wish');
  const marked = await gotOf(AIR_ROW);
  assert.equal(marked.got_by, 'auto');
  assert.ok(marked.got_at);

  // More toward a got wish is still kept (it stays on that wish), and marks nothing twice.
  res = await W.recordGift(admin(), as(NENE), EVENT, { wishId: AIR, amount: 700 });
  assert.equal(res.ok && res.nowGot, false);
  assert.equal(String((await gotOf(AIR_ROW)).got_at), String(marked.got_at), 'the mark was rewritten');

  // No price: never marks itself, whatever is sent.
  const any = await db.query<{ wish_item_id: string }>(`SELECT wish_item_id FROM public.event_wish_items WHERE public_id = $1`, [ANY]);
  assert.deepEqual(await gotOf(any.rows[0]!.wish_item_id), { got_by: null, got_at: null });

  // The couple's own mark is theirs.
  const hm = await db.query<{ wish_item_id: string }>(`SELECT wish_item_id FROM public.event_wish_items WHERE public_id = $1`, [HOSTMARK]);
  res = await W.recordGift(admin(), as(NENE), EVENT, { wishId: HOSTMARK, amount: 6000 });
  assert.equal(res.ok && res.nowGot, false);
  assert.equal((await gotOf(hm.rows[0]!.wish_item_id)).got_by, 'host');
});

// ── 10 ──────────────────────────────────────────────────────────────────────

test('10 · 🔒 it only works as the service role — a browser’s own client keeps nothing, and says so', async () => {
  const before = await count();
  const res = await W.recordGift(clientAs(db, HOST_USER), as(NENE), EVENT, { wishId: AIR, amount: 500 });
  assert.equal(res.ok, false, 'a signed-in browser role wrote a gift record');
  assert.equal(await count(), before);
});

// ── 11 · the RA 10173 file ──────────────────────────────────────────────────
test('11 · 🔒 "Download my data": a guest gets what THEY said they sent — a host gets none of their guests’', async () => {
  const { readOwnGiftRecords } = await import('../../lib/export-own-gift-records');
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ('nene@gift-record.test', jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
  );
  const NENE_USER = u.rows[0]!.id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, guest_id) VALUES ($1, $2, 'guest', $3)`, [EVENT, NENE_USER, NENE]);
  const shot = `r2://setnayan-thread-files/gift-shots/${EVENT}/${NENE}/export.jpg`;
  await db.query(
    `INSERT INTO public.event_gift_records (event_id, amount_php, screenshot_r2_key, message, giver_name, giver_guest_id)
     VALUES ($1, 750, $2, 'For the export', 'Tita Nene', $3)`,
    [EVENT, shot, NENE],
  );

  const all = await records();
  const hers = all.filter((r) => r.giver_guest_id === NENE);
  assert.ok(hers.length >= 2 && hers.length < all.length, 'the fixture must hold her records AND other guests’');

  // META — RLS alone hands the HOST every guest's record; the filter is what keeps them out of the host's file.
  const hostSees = await clientAs(db, HOST_USER).from('event_gift_records').select('gift_record_id').eq('event_id', EVENT);
  assert.equal((hostSees.data ?? []).length, all.length, 'the host arm changed — the next assertion would pass vacuously');
  // …and her own session reads none of her own (no guest SELECT policy) — why the read is the service role's.
  const sheSees = await clientAs(db, NENE_USER).from('event_gift_records').select('gift_record_id').eq('event_id', EVENT);
  assert.equal((sheSees.data ?? []).length, 0);

  const mine = await readOwnGiftRecords(clientAs(db, NENE_USER), admin(), NENE_USER);
  assert.equal(mine?.error, null);
  const rows = (mine?.data ?? []) as Array<Record<string, unknown>>;
  assert.equal(rows.length, hers.length, 'her file must hold every record she made, and only those');
  for (const row of rows) {
    assert.equal(row.giver_name, 'Tita Nene');
    assert.ok(!('screenshot_r2_key' in row), 'the storage key must never be in the file');
    assert.ok(!('removed_at' in row), 'the host’s own setting-aside is not the guest’s data');
    assert.equal(typeof row.screenshot_held, 'boolean');
  }
  assert.ok(rows.some((r) => r.screenshot_held === true && r.amount_php === 750 && r.message === 'For the export'));

  // The host has no guest seat here: their file holds NONE of their guests' gifts.
  const hosts = await readOwnGiftRecords(clientAs(db, HOST_USER), admin(), HOST_USER);
  assert.deepEqual(hosts, { data: [], error: null });

  // No service role on this run → NOT READ (null), never "you sent nothing".
  assert.equal(await readOwnGiftRecords(clientAs(db, NENE_USER), null, NENE_USER), null);
});
