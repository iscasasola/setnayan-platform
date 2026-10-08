/**
 * THE COUPLE MARKS GIFTS ONE BY ONE — the three writes a host has on a gift
 * record, run for real against the replayed schema with RLS ON (owner
 * 2026-10-08: "yes. it will accumulate all the gift and mark them one by one" ·
 * "when amount is reached."; design `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2
 * "One gift open" + § 6 E-PR5).
 *
 * `giftRecordWrite` is CALLED, as the signed-in person, through a
 * supabase-shaped client that runs as the `authenticated` role with their uid —
 * so the table's grants and `event_gift_records_host_all` decide exactly as they
 * do for a browser. Nothing here is the service role.
 *
 *   1 · correct the amount → the wish's Got it follows the sum, both ways;
 *   2 · an amount that is not an amount is refused, and nothing moves;
 *   3 · move a gift to another wish, and to "Any gift" → BOTH wishes re-settle;
 *   4 · 🔒 a gift cannot be moved to another event's wish, and another event's
 *       gift cannot be touched from here;
 *   5 · Remove is soft: the row stays, leaves every sum, and can be put back;
 *   6 · the couple's own mark is never touched by a sum; a wish with no price
 *       never marks itself;
 *   7 · 🔒 a stranger, a guest of this very event and another event's host can
 *       change NOTHING — and are told so, never "kept";
 *   8 · 🔒 a host can correct a record, never invent one and never destroy one;
 *   9 · 🔒 the screenshot of ONE opened gift: a host is handed a short-lived
 *       signed address of it, from this event's own folder only — a stranger, a
 *       guest of this very event and another event's host are handed nothing;
 *  10 · ⚡ as few requests as the task allows — counted on the real functions.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08) — see the PR body.
 *
 * Run from apps/web:  npx tsx --test tests/db/the-couple-marks-gifts-one-by-one.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import './supabase-over-pglite'; // installs the `server-only` shim before the writer loads
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { clientAs } from './pglite-client';

type Writer = typeof import('../../app/dashboard/[eventId]/pabuya/gift-records.server');
let W: Writer;
type Reader = typeof import('../../lib/wish-list.server');
let L: Reader;
let replay: ReplayResult;
let db: PGlite;

let EVENT = '';
let OTHER_EVENT = '';
let HOST = '';
let OTHER_HOST = '';
let STRANGER = '';
let GUEST_USER = '';
let AIR = ''; // ₱4,500
let RICE = ''; // ₱3,200
let FUND = ''; // no price
let COFFEE = ''; // ₱6,000 — marked by the couple
let ELSEWHERE = ''; // a wish of OTHER_EVENT
let R1 = ''; // AIR ₱2,000
let R2 = ''; // AIR ₱2,000
let R3 = ''; // no wish ₱5,000
let RX = ''; // OTHER_EVENT's record

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function newEvent(name: string, hostId: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date) VALUES ($1, 'birthday', DATE '2027-06-12') RETURNING event_id`,
    [name],
  );
  const id = r.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [id, hostId]);
  return id;
}
async function newWish(eventId: string, name: string, price: number | null): Promise<string> {
  const r = await db.query<{ wish_item_id: string }>(
    `INSERT INTO public.event_wish_items (event_id, name, price_php, sort_order) VALUES ($1, $2, $3, 0) RETURNING wish_item_id`,
    [eventId, name, price],
  );
  return r.rows[0]!.wish_item_id;
}
async function newRecord(eventId: string, wishId: string | null, amount: number, who: string): Promise<string> {
  const r = await db.query<{ gift_record_id: string }>(
    `INSERT INTO public.event_gift_records (event_id, wish_item_id, amount_php, giver_name) VALUES ($1, $2, $3, $4) RETURNING gift_record_id`,
    [eventId, wishId, amount, who],
  );
  return r.rows[0]!.gift_record_id;
}

type Rec = { wish_item_id: string | null; amount_php: number; removed_at: string | null; giver_name: string };
async function rec(id: string): Promise<Rec> {
  const r = await db.query<Rec>(`SELECT wish_item_id, amount_php, removed_at, giver_name FROM public.event_gift_records WHERE gift_record_id = $1`, [id]);
  return r.rows[0]!;
}
async function got(wishId: string): Promise<{ got_by: string | null; marked: boolean }> {
  const r = await db.query<{ got_by: string | null; got_at: string | null }>(`SELECT got_by, got_at FROM public.event_wish_items WHERE wish_item_id = $1`, [wishId]);
  return { got_by: r.rows[0]!.got_by, marked: r.rows[0]!.got_at != null };
}
const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const as = (uid: string) => clientAs(db, uid);
const amount = (uid: string, id: string, value: string, eventId = EVENT) => W.giftRecordWrite(as(uid), eventId, 'gift-amount', form({ gift_record_id: id, amount: value }));
const move = (uid: string, id: string, wishId: string, eventId = EVENT) => W.giftRecordWrite(as(uid), eventId, 'gift-move', form({ gift_record_id: id, wish_item_id: wishId }));
const remove = (uid: string, id: string, removed: '1' | '0', eventId = EVENT) => W.giftRecordWrite(as(uid), eventId, 'gift-remove', form({ gift_record_id: id, removed }));

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  /* Signing asks nobody — it is arithmetic over the key — so made-up credentials sign a
     made-up address here. No bucket is contacted by this file. */
  process.env.R2_ACCOUNT_ID ||= 'test-account';
  process.env.R2_ACCESS_KEY_ID ||= 'test-key';
  process.env.R2_SECRET_ACCESS_KEY ||= 'test-secret';
  W = await import('../../app/dashboard/[eventId]/pabuya/gift-records.server');
  L = await import('../../lib/wish-list.server');

  HOST = await newUser('couple@gifts-one-by-one.test');
  OTHER_HOST = await newUser('other-couple@gifts-one-by-one.test');
  STRANGER = await newUser('stranger@gifts-one-by-one.test');
  GUEST_USER = await newUser('guest@gifts-one-by-one.test');
  EVENT = await newEvent('Maria and Jose', HOST);
  OTHER_EVENT = await newEvent('Somebody Else', OTHER_HOST);

  /* A guest of THIS event, with an account bound to their seat — a guest, never a host. */
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'Nene', 'Reyes', 'both', 'friends') RETURNING guest_id`,
    [EVENT],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, guest_id) VALUES ($1, $2, 'guest', $3)`, [EVENT, GUEST_USER, g.rows[0]!.guest_id]);

  AIR = await newWish(EVENT, 'Air fryer', 4500);
  RICE = await newWish(EVENT, 'Rice cooker', 3200);
  FUND = await newWish(EVENT, 'Honeymoon fund', null);
  COFFEE = await newWish(EVENT, 'Coffee maker', 6000);
  await db.query(`UPDATE public.event_wish_items SET got_at = now(), got_by = 'host' WHERE wish_item_id = $1`, [COFFEE]);
  ELSEWHERE = await newWish(OTHER_EVENT, 'Luggage set', 8900);

  R1 = await newRecord(EVENT, AIR, 2000, 'Tita Nene');
  R2 = await newRecord(EVENT, AIR, 2000, 'Kuya Jun');
  R3 = await newRecord(EVENT, null, 5000, 'Ninong Bert');
  RX = await newRecord(OTHER_EVENT, ELSEWHERE, 1000, 'Cora Lim');
});

after(async () => {
  await replay?.db?.close?.();
});

test('1 · correct the amount → Got it follows the sum, both ways', async () => {
  assert.deepEqual(await got(AIR), { got_by: null, marked: false }, 'the fixture starts ₱500 short');
  assert.deepEqual(await amount(HOST, R1, '2500'), { ok: true });
  assert.equal((await rec(R1)).amount_php, 2500);
  assert.deepEqual(await got(AIR), { got_by: 'auto', marked: true }, '₱2,500 + ₱2,000 reaches ₱4,500 — the wish marks itself');

  /* The screenshot differed after all: back below the price, and the automatic mark goes. */
  assert.deepEqual(await amount(HOST, R1, '2,000'), { ok: true });
  assert.equal((await rec(R1)).amount_php, 2000);
  assert.deepEqual(await got(AIR), { got_by: null, marked: false }, 'an automatic mark that is no longer reached must clear');
});

test('2 · an amount that is not an amount is refused, and nothing moves', async () => {
  for (const not of ['', '0', '-500', 'two thousand', '12.50', '1000000000']) {
    const res = await amount(HOST, R1, not);
    assert.equal(res.ok, false, `"${not}" was taken for an amount`);
    assert.equal((await rec(R1)).amount_php, 2000);
  }
  assert.deepEqual(await got(AIR), { got_by: null, marked: false });
});

test('3 · move a gift to another wish, and to "Any gift" → both wishes re-settle', async () => {
  /* Ninong Bert's ₱5,000 was for the rice cooker (₱3,200): it marks itself. */
  assert.deepEqual(await move(HOST, R3, RICE), { ok: true });
  assert.equal((await rec(R3)).wish_item_id, RICE);
  assert.deepEqual(await got(RICE), { got_by: 'auto', marked: true });

  /* …no — it was for the air fryer. The rice cooker opens again; the air fryer is reached. */
  assert.deepEqual(await move(HOST, R3, AIR), { ok: true });
  assert.deepEqual(await got(RICE), { got_by: null, marked: false }, 'the wish it LEFT must be settled too');
  assert.deepEqual(await got(AIR), { got_by: 'auto', marked: true }, 'the wish it JOINED must be settled');

  /* Back to "Any gift": it counts toward no wish. */
  assert.deepEqual(await move(HOST, R3, ''), { ok: true });
  assert.equal((await rec(R3)).wish_item_id, null);
  assert.deepEqual(await got(AIR), { got_by: null, marked: false });
});

test('4 · 🔒 never to another event’s wish, and never another event’s gift', async () => {
  const res = await move(HOST, R3, ELSEWHERE);
  assert.equal(res.ok, false, 'a gift was moved onto another event’s wish');
  assert.equal((await rec(R3)).wish_item_id, null);
  assert.deepEqual(await got(ELSEWHERE), { got_by: null, marked: false });

  /* Another event's record, named from this event's door. */
  for (const res2 of [await amount(HOST, RX, '9999'), await move(HOST, RX, AIR), await remove(HOST, RX, '1')]) {
    assert.equal(res2.ok, false, 'another event’s gift was changed');
  }
  /* …and named with ITS event id, by somebody who does not host it. */
  for (const res3 of [await amount(HOST, RX, '9999', OTHER_EVENT), await move(HOST, RX, '', OTHER_EVENT), await remove(HOST, RX, '1', OTHER_EVENT)]) {
    assert.equal(res3.ok, false, 'a host of one event changed a gift of another');
  }
  assert.deepEqual(await rec(RX), { wish_item_id: ELSEWHERE, amount_php: 1000, removed_at: null, giver_name: 'Cora Lim' });
  /* A malformed id is refused before anything is read. */
  assert.equal((await amount(HOST, 'not-an-id', '500')).ok, false);
  assert.equal((await move(HOST, R3, 'not-an-id')).ok, false);
});

test('5 · Remove is soft: the row stays, leaves the sum, and can be put back', async () => {
  assert.deepEqual(await amount(HOST, R1, '2500'), { ok: true });
  assert.deepEqual(await got(AIR), { got_by: 'auto', marked: true });
  const rows = async () => Number((await db.query<{ n: string }>(`SELECT count(*) AS n FROM public.event_gift_records WHERE event_id = $1`, [EVENT])).rows[0]!.n);
  const before_ = await rows();

  assert.deepEqual(await remove(HOST, R2, '1'), { ok: true });
  assert.notEqual((await rec(R2)).removed_at, null);
  assert.equal(await rows(), before_, 'Remove must not delete the record');
  assert.deepEqual(await got(AIR), { got_by: null, marked: false }, 'a removed gift no longer counts toward its wish');

  assert.deepEqual(await remove(HOST, R2, '0'), { ok: true });
  assert.equal((await rec(R2)).removed_at, null);
  assert.deepEqual(await got(AIR), { got_by: 'auto', marked: true }, 'put back, it counts again');

  assert.equal((await remove(HOST, R2, 'maybe' as '1')).ok, false);
  assert.deepEqual(await amount(HOST, R1, '2000'), { ok: true });
});

test('6 · the couple’s own mark is never touched by a sum; no price never marks itself', async () => {
  /* ₱5,000 toward a ₱6,000 wish the couple marked themselves: still theirs. */
  assert.deepEqual(await move(HOST, R3, COFFEE), { ok: true });
  assert.deepEqual(await got(COFFEE), { got_by: 'host', marked: true });
  assert.deepEqual(await amount(HOST, R3, '9000'), { ok: true });
  assert.deepEqual(await got(COFFEE), { got_by: 'host', marked: true });
  assert.deepEqual(await remove(HOST, R3, '1'), { ok: true });
  assert.deepEqual(await got(COFFEE), { got_by: 'host', marked: true });
  assert.deepEqual(await remove(HOST, R3, '0'), { ok: true });

  /* Any amount toward a wish with no price: it never marks itself. */
  assert.deepEqual(await move(HOST, R3, FUND), { ok: true });
  assert.deepEqual(await got(FUND), { got_by: null, marked: false });
  assert.deepEqual(await amount(HOST, R3, '5000'), { ok: true });
  assert.deepEqual(await move(HOST, R3, ''), { ok: true });
});

test('7 · 🔒 a stranger, a guest of this event and another event’s host change nothing — and are told so', async () => {
  const was = [await rec(R1), await rec(R2), await rec(R3)];
  for (const [who, uid] of [
    ['a stranger', STRANGER],
    ['a guest of this event', GUEST_USER],
    ['another event’s host', OTHER_HOST],
  ] as const) {
    for (const res of [await amount(uid, R1, '1'), await move(uid, R2, ''), await move(uid, R3, AIR), await remove(uid, R1, '1'), await remove(uid, R2, '1')]) {
      assert.equal(res.ok, false, `${who} was told a change was kept`);
      assert.ok(!res.ok && res.error.length > 10, 'a refusal must carry words');
    }
  }
  assert.deepEqual([await rec(R1), await rec(R2), await rec(R3)], was, 'a record changed under somebody who does not host the event');
  assert.deepEqual(await got(AIR), { got_by: null, marked: false });

  /* The mark itself cannot be settled by them either. */
  assert.equal(await W.settleWishesGot(as(STRANGER), EVENT, [AIR]), true, 'they read no wish, so there is no mark to settle — and nothing was written');
  assert.deepEqual(await got(AIR), { got_by: null, marked: false });
});

test('8 · 🔒 a host can correct a record — never invent one, never destroy one', async () => {
  const host = as(HOST);
  const made = await host.from('event_gift_records').insert({ event_id: EVENT, amount_php: 99999, giver_name: 'Nobody' }).select('gift_record_id');
  assert.ok(made.error, 'a host’s browser role invented a gift record');
  const gone = await host.from('event_gift_records').delete().eq('gift_record_id', R1).select('gift_record_id');
  assert.ok(gone.error || (gone.data ?? []).length === 0, 'a host’s browser role destroyed a gift record');
  assert.equal((await rec(R1)).giver_name, 'Tita Nene');
});

const shot = (uid: string, id: string, eventId = EVENT) => W.giftRecordWrite(as(uid), eventId, 'gift-shot', form({ gift_record_id: id }));

test('9 · 🔒 the screenshot of one opened gift — a host only, this event’s own folder only', async () => {
  const guest = (await db.query<{ guest_id: string }>(`SELECT guest_id FROM public.guests WHERE event_id = $1 LIMIT 1`, [EVENT])).rows[0]!.guest_id;
  const mine = `r2://setnayan-thread-files/gift-shots/${EVENT}/${guest}/a1.jpg`;
  await db.query(`UPDATE public.event_gift_records SET screenshot_r2_key = $2 WHERE gift_record_id = $1`, [R1, mine]);

  /* The host: a signed address of THAT object, short-lived. */
  const res = await shot(HOST, R1);
  assert.ok(res.ok, 'the host was refused their own guest’s screenshot');
  const url = new URL(res.shotUrl!);
  assert.match(url.pathname, new RegExp(`/setnayan-thread-files/gift-shots/${EVENT}/${guest}/a1\\.jpg$|^/gift-shots/${EVENT}/${guest}/a1\\.jpg$`));
  assert.ok(url.searchParams.get('X-Amz-Signature'), 'the address is not signed');
  assert.equal(url.searchParams.get('X-Amz-Expires'), String(L.GIFT_SHOT_TTL_SECONDS), 'the address must be short-lived');
  assert.ok(L.GIFT_SHOT_TTL_SECONDS <= 900, 'ten minutes, not a day');

  /* A record with no screenshot: said as none — never an error, never an address. */
  assert.deepEqual(await shot(HOST, R2), { ok: true, shotUrl: null });

  /* 🔒 Nobody else is handed anything — and each is told so in words. */
  for (const [who, uid] of [
    ['a stranger', STRANGER],
    ['a guest of this event', GUEST_USER],
    ['another event’s host', OTHER_HOST],
  ] as const) {
    const no = await shot(uid, R1);
    assert.equal(no.ok, false, `${who} was handed a guest’s screenshot`);
    assert.ok(!no.ok && no.error.length > 10);
    assert.deepEqual(await L.readGiftShotUrl(as(uid), EVENT, R1), { read: false, gone: true });
  }
  /* …nor through another event's door, by its own host. */
  assert.equal((await shot(OTHER_HOST, R1, OTHER_EVENT)).ok, false);

  /* 🔒 A row that names anything outside this event's own private folder is refused, never signed. */
  for (const outside of [
    `r2://setnayan-thread-files/gift-shots/${OTHER_EVENT}/${guest}/x.jpg`, // another event's folder
    `r2://setnayan-media/gift-shots/${EVENT}/${guest}/x.jpg`, // the PUBLIC bucket
    `r2://setnayan-thread-files/thread-files/whatever.jpg`, // another private folder
    'https://example.com/shot.jpg', // a plain address
  ]) {
    await db.query(`UPDATE public.event_gift_records SET screenshot_r2_key = $2 WHERE gift_record_id = $1`, [R1, outside]);
    assert.deepEqual(await L.readGiftShotUrl(as(HOST), EVENT, R1), { read: false, gone: false }, `signed or passed on: ${outside}`);
    assert.equal((await shot(HOST, R1)).ok, false);
  }
  await db.query(`UPDATE public.event_gift_records SET screenshot_r2_key = NULL WHERE gift_record_id = $1`, [R1]);
});

/** The same client, counting every request it sends (one per awaited table call). */
function counting(uid: string) {
  const real = as(uid);
  const sent: string[] = [];
  const client = {
    from(table: string) {
      const q = real.from(table) as unknown as Record<string, unknown>;
      let verb = 'select';
      const wrap = (inner: Record<string, unknown>): unknown =>
        new Proxy(inner, {
          get(target, prop, receiver) {
            if (prop === 'then') {
              sent.push(`${verb} ${table}`);
              const then = Reflect.get(target, prop, receiver) as (...a: unknown[]) => unknown;
              return then.bind(target);
            }
            const v = Reflect.get(target, prop, receiver);
            if (typeof v !== 'function') return v;
            return (...args: unknown[]) => {
              if (prop === 'update' || prop === 'insert' || prop === 'delete' || prop === 'upsert') verb = String(prop);
              const out = (v as (...a: unknown[]) => unknown).apply(target, args);
              if (prop === 'maybeSingle') {
                sent.push(`${verb} ${table}`);
                return out;
              }
              return out && typeof out === 'object' ? wrap(out as Record<string, unknown>) : out;
            };
          },
        });
      return wrap(q);
    },
  };
  return { client: client as unknown as ReturnType<typeof as>, sent };
}

test('10 · ⚡ as few requests as the task allows — counted on the real functions', async () => {
  /* The couple's whole list: ONE read per table, side by side — whatever the number of wishes or gifts. */
  const list = counting(HOST);
  const view = await L.readStudioWishList(list.client, EVENT);
  assert.ok(view.read);
  assert.deepEqual(list.sent.sort(), ['select event_gift_records', 'select event_wish_items']);
  assert.ok(view.gifts.every((g) => g.shotUrl === null), 'the list read signed a screenshot');

  /* A gift toward NO wish, corrected: the write is the whole request. */
  const any = counting(HOST);
  assert.deepEqual(await W.giftRecordWrite(any.client, EVENT, 'gift-amount', form({ gift_record_id: R3, amount: '5000' })), { ok: true });
  assert.deepEqual(any.sent, ['update event_gift_records']);

  /* A gift toward a wish, corrected, the mark unchanged: one write, then the two reads that add it up. */
  const one = counting(HOST);
  assert.deepEqual(await W.giftRecordWrite(one.client, EVENT, 'gift-amount', form({ gift_record_id: R1, amount: '2100' })), { ok: true });
  assert.deepEqual(one.sent[0], 'update event_gift_records');
  assert.deepEqual(one.sent.slice(1).sort(), ['select event_gift_records', 'select event_wish_items']);

  /* …and when the sum reaches the price, ONE more write: the mark. */
  const reach = counting(HOST);
  assert.deepEqual(await W.giftRecordWrite(reach.client, EVENT, 'gift-amount', form({ gift_record_id: R1, amount: '2500' })), { ok: true });
  assert.equal(reach.sent.length, 4);
  assert.equal(reach.sent[3], 'update event_wish_items');

  /* Removed and put back: the same shape as a correction. */
  const gone = counting(HOST);
  assert.deepEqual(await W.giftRecordWrite(gone.client, EVENT, 'gift-remove', form({ gift_record_id: R1, removed: '1' })), { ok: true });
  assert.equal(gone.sent.length, 4, 'remove: the write, two reads, and the mark that opens again');
  const back = counting(HOST);
  assert.deepEqual(await W.giftRecordWrite(back.client, EVENT, 'gift-remove', form({ gift_record_id: R1, removed: '0' })), { ok: true });
  assert.equal(back.sent.length, 4);

  /* A move between two wishes: two reads side by side, the write, then BOTH wishes added up in
     one pass (two reads — not two per wish) and a mark only where it changes. */
  const moved = counting(HOST);
  assert.deepEqual(await W.giftRecordWrite(moved.client, EVENT, 'gift-move', form({ gift_record_id: R1, wish_item_id: RICE })), { ok: true });
  assert.deepEqual(moved.sent.slice(0, 2).sort(), ['select event_gift_records', 'select event_wish_items']);
  assert.equal(moved.sent[2], 'update event_gift_records');
  assert.deepEqual(moved.sent.slice(3, 5).sort(), ['select event_gift_records', 'select event_wish_items']);
  assert.ok(moved.sent.length <= 7, `a move sent ${moved.sent.length} requests`);
  const home = counting(HOST);
  assert.deepEqual(await W.giftRecordWrite(home.client, EVENT, 'gift-move', form({ gift_record_id: R1, wish_item_id: AIR })), { ok: true });
  assert.ok(home.sent.length <= 7);
  assert.deepEqual(await amount(HOST, R1, '2000'), { ok: true });
  assert.deepEqual(await got(AIR), { got_by: null, marked: false });
  assert.deepEqual(await got(RICE), { got_by: null, marked: false });

  /* The opened gift's screenshot: ONE read. */
  const see = counting(HOST);
  await W.giftRecordWrite(see.client, EVENT, 'gift-shot', form({ gift_record_id: R2 }));
  assert.deepEqual(see.sent, ['select event_gift_records']);
});
