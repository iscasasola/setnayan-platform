/**
 * THE WISH LIST'S FOUR WRITES, RUN FOR REAL — `saveWishItem` · `deleteWishItem` ·
 * `moveWishItem` · `setWishItemGot`
 * (`app/dashboard/[eventId]/pabuya/wish-items.server.ts`) called against the
 * REPLAYED schema, as the signed-in person, with RLS on.
 *
 * ⚖ Owner 2026-10-08 (E-Gifts › Wish list): wishes save LIVE; a wish is marked
 * got "when amount is reached"; the couple can flip it by hand; Setnayan never
 * holds the money. And the repo's own rule: a failure never renders as success.
 *
 * The writers take a Supabase client, so this hands them one — a small
 * supabase-js-shaped client over PGlite that runs every statement as the
 * `authenticated` role with the caller's uid, modelling EXACTLY the call shapes
 * those four functions use (anything else throws). So what is pinned is the
 * production code path, not a re-statement of it:
 *
 *   1. a host adds a wish — it lands LAST, stamped with who added it;
 *   2. what the sheet may not keep is refused in words, and nothing is written
 *      (no name · a price that is not a number · a link that is not a link · a
 *      photo that is not this event's own wish-list upload);
 *   3. a NON-host's save, edit, got, move and delete write nothing — and are
 *      SAID, never reported as kept (the zero-row rule);
 *   4. editing the PRICE re-settles the automatic Got it against what guests say
 *      they sent — and never touches a mark the couple made by hand; a removed
 *      record does not count toward it;
 *   5. the couple's switch writes both halves of the mark, and takes both off;
 *   6. one drag is the whole order, and an order naming somebody else's wish —
 *      or leaving one out — moves nothing;
 *   7. Remove deletes the wish and keeps its gifts as "Any gift".
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • the photo policy check removed                     → 2 red;
 *   • the zero-row check on the edit removed             → 3 red;
 *   • `gotAfterGifts` not consulted on a price change    → 4 red;
 *   • `moveWishItem` no longer comparing the id sets     → 6 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import './supabase-over-pglite'; // installs the `server-only` shim before the writers load
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { clientAs } from './pglite-client';

type Writers = typeof import('../../app/dashboard/[eventId]/pabuya/wish-items.server');
let W: Writers;
let replay: ReplayResult;
let db: PGlite;

let EVENT = '';
let OTHER_EVENT = '';
let COUPLE = '';
let STRANGER = '';

/* The signed-in person, as a supabase-js-shaped client over the replay (`pglite-client.ts`). */
const clientFor = (uid: string) => clientAs(db, uid);

/* ── fixtures ─────────────────────────────────────────────────────────────── */

let n = 0;
async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [`acct${n}@wish-writes.test`],
  );
  return u.rows[0]!.id;
}
async function newEvent(name: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  return ev.rows[0]!.event_id;
}
/** The server's own write of a guest's record (wish list 4/5 will do this with the service role). */
async function gift(wishId: string | null, amount: number, removed = false): Promise<string> {
  const r = await db.query<{ gift_record_id: string }>(
    `INSERT INTO public.event_gift_records (event_id, wish_item_id, amount_php, giver_name, removed_at)
     VALUES ($1, $2, $3, 'Tita Nene', $4) RETURNING gift_record_id`,
    [EVENT, wishId, amount, removed ? new Date().toISOString() : null],
  );
  return r.rows[0]!.gift_record_id;
}
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
type WishRow = { wish_item_id: string; name: string; price_php: number | null; sort_order: number; got_at: string | null; got_by: string | null; photo_r2_key: string | null; link_url: string | null; note: string | null; created_by_user_id: string | null };
async function wishes(eventId = EVENT): Promise<WishRow[]> {
  const r = await db.query<WishRow>(
    `SELECT wish_item_id, name, price_php, sort_order, got_at, got_by, photo_r2_key, link_url, note, created_by_user_id
       FROM public.event_wish_items WHERE event_id = $1 ORDER BY sort_order, created_at`,
    [eventId],
  );
  return r.rows;
}
const byName = async (name: string) => (await wishes()).find((w) => w.name === name)!;

/** Add a wish as the couple and hand back its row. */
async function add(name: string, price = ''): Promise<WishRow> {
  const res = await W.saveWishItem(clientFor(COUPLE), EVENT, COUPLE, form({ name, price }));
  assert.deepEqual(res, { ok: true });
  return byName(name);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  W = await import('../../app/dashboard/[eventId]/pabuya/wish-items.server');

  EVENT = await newEvent('Maria & Jose');
  OTHER_EVENT = await newEvent('Somebody Else');
  COUPLE = await newUser();
  STRANGER = await newUser();
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [EVENT, COUPLE]);
});

after(async () => {
  await replay?.db?.close?.();
});

// ── 1 ───────────────────────────────────────────────────────────────────────

test('1 · a host adds a wish: it lands last, with its fields, stamped with who added it', async () => {
  const air = await add('Air fryer', '4500');
  assert.equal(air.price_php, 4500);
  assert.equal(air.created_by_user_id, COUPLE);
  assert.equal(air.got_at, null);

  const photo = `r2://setnayan-media/events/${EVENT}/wish-list/abc-rice.jpg`;
  const res = await W.saveWishItem(
    clientFor(COUPLE),
    EVENT,
    COUPLE,
    form({ name: '  Rice cooker  ', price: '', link: 'shop.example/rice-cooker', note: 'the grey one', photo_r2_key: photo }),
  );
  assert.deepEqual(res, { ok: true });
  const rice = await byName('Rice cooker');
  assert.equal(rice.price_php, null, 'an empty price is "any amount"');
  assert.equal(rice.link_url, 'https://shop.example/rice-cooker', 'a link pasted without its scheme is still a link');
  assert.equal(rice.note, 'the grey one');
  assert.equal(rice.photo_r2_key, photo);
  assert.ok(rice.sort_order > air.sort_order, 'a new wish goes to the end of the couple’s order');
});

// ── 2 ───────────────────────────────────────────────────────────────────────

test('2 · what may not be kept is refused in words, and nothing is written', async () => {
  const count = (await wishes()).length;
  const save = (fields: Record<string, string>) => W.saveWishItem(clientFor(COUPLE), EVENT, COUPLE, form(fields));
  const refused = async (fields: Record<string, string>, said: RegExp) => {
    const res = await save(fields);
    assert.equal(res.ok, false, `kept: ${JSON.stringify(fields)}`);
    if (!res.ok) assert.match(res.error, said);
  };
  await refused({ name: '   ' }, /Give it a name/);
  await refused({ name: 'x'.repeat(61) }, /60 characters/);
  await refused({ name: 'Lamp', price: 'about 4k' }, /price as a number/);
  await refused({ name: 'Lamp', price: '0' }, /price as a number/);
  await refused({ name: 'Lamp', link: 'javascript:alert(1)' }, /link does not look right/);
  await refused({ name: 'Lamp', note: 'x'.repeat(121) }, /120 characters/);
  // A photo must be THIS event's own wish-list upload in the public media bucket.
  await refused({ name: 'Lamp', photo_r2_key: `r2://setnayan-media/events/${OTHER_EVENT}/wish-list/theirs.jpg` }, /photo could not be used/);
  await refused({ name: 'Lamp', photo_r2_key: `r2://setnayan-thread-files/pabuya-qr/${EVENT}/qr.jpg` }, /photo could not be used/);
  await refused({ name: 'Lamp', photo_r2_key: `r2://setnayan-media/events/${EVENT}/hero/cover.jpg` }, /photo could not be used/);
  await refused({ name: 'Lamp', photo_r2_key: 'https://evil.example/x.jpg' }, /photo could not be used/);
  assert.equal((await wishes()).length, count, 'a refused save wrote a row');
});

// ── 3 ───────────────────────────────────────────────────────────────────────

test('3 · a non-host writes nothing — and is told so, never "kept"', async () => {
  const air = await byName('Air fryer');
  const snapshot = JSON.stringify(await wishes());
  const them = clientFor(STRANGER);

  const planted = await W.saveWishItem(them, EVENT, STRANGER, form({ name: 'Planted' }));
  assert.equal(planted.ok, false, 'a stranger added a wish to somebody else’s list');

  const edited = await W.saveWishItem(them, EVENT, STRANGER, form({ wish_item_id: air.wish_item_id, name: 'Hijacked', price: '1' }));
  assert.equal(edited.ok, false, 'a stranger’s edit was reported as kept');

  const got = await W.setWishItemGot(them, EVENT, form({ wish_item_id: air.wish_item_id, got: '1' }));
  assert.equal(got.ok, false);

  const moved = await W.moveWishItem(them, EVENT, form({ order: (await wishes()).map((w) => w.wish_item_id).reverse().join(',') }));
  assert.equal(moved.ok, false);

  const removed = await W.deleteWishItem(them, EVENT, form({ wish_item_id: air.wish_item_id }));
  assert.equal(removed.ok, false, 'a stranger’s Remove was reported as done');

  assert.equal(JSON.stringify(await wishes()), snapshot, 'something changed');

  // …and the couple naming ANOTHER event's id cannot reach across either.
  const across = await W.saveWishItem(clientFor(COUPLE), OTHER_EVENT, COUPLE, form({ name: 'Across' }));
  assert.equal(across.ok, false);
  assert.equal((await wishes(OTHER_EVENT)).length, 0);
});

// ── 4 ───────────────────────────────────────────────────────────────────────

test('4 · editing the price re-settles the automatic Got it — by what guests say they sent', async () => {
  const lug = await add('Luggage set', '8900');
  await gift(lug.wish_item_id, 3000);
  await gift(lug.wish_item_id, 9000, true); // removed by the couple: never counts
  const edit = (fields: Record<string, string>) =>
    W.saveWishItem(clientFor(COUPLE), EVENT, COUPLE, form({ wish_item_id: lug.wish_item_id, name: 'Luggage set', ...fields }));

  assert.deepEqual(await edit({ price: '8900' }), { ok: true });
  assert.equal((await byName('Luggage set')).got_by, null, 'nothing moved: ₱3,000 of ₱8,900');

  assert.deepEqual(await edit({ price: '3000' }), { ok: true });
  let row = await byName('Luggage set');
  assert.equal(row.got_by, 'auto', 'the price came down to what was sent — it reached');
  assert.ok(row.got_at, 'both halves of the mark are written');

  assert.deepEqual(await edit({ price: '5000' }), { ok: true });
  row = await byName('Luggage set');
  assert.deepEqual([row.got_by, row.got_at], [null, null], 'the price went back above what was sent — open again');

  assert.deepEqual(await edit({ price: '' }), { ok: true });
  assert.equal((await byName('Luggage set')).got_by, null, 'a wish with no price never marks itself');

  // The couple's own mark is theirs: no sum takes it off or rewrites it.
  await W.setWishItemGot(clientFor(COUPLE), EVENT, form({ wish_item_id: lug.wish_item_id, got: '1' }));
  assert.deepEqual(await edit({ price: '999999' }), { ok: true });
  assert.equal((await byName('Luggage set')).got_by, 'host');
});

// ── 5 ───────────────────────────────────────────────────────────────────────

test('5 · the couple’s switch: on is "marked by you", off opens it again — both halves each time', async () => {
  const cof = await add('Coffee maker', '6000');
  const flip = (got: string) => W.setWishItemGot(clientFor(COUPLE), EVENT, form({ wish_item_id: cof.wish_item_id, got }));
  assert.deepEqual(await flip('1'), { ok: true });
  let row = await byName('Coffee maker');
  assert.equal(row.got_by, 'host');
  assert.ok(row.got_at);
  assert.deepEqual(await flip('0'), { ok: true });
  row = await byName('Coffee maker');
  assert.deepEqual([row.got_by, row.got_at], [null, null]);
  assert.equal((await flip('maybe')).ok, false);
  assert.equal((await W.setWishItemGot(clientFor(COUPLE), EVENT, form({ wish_item_id: 'not-an-id', got: '1' }))).ok, false);
});

// ── 6 ───────────────────────────────────────────────────────────────────────

test('6 · one drag is the whole order — and a wrong list moves nothing', async () => {
  const before = await wishes();
  const ids = before.map((w) => w.wish_item_id);
  const move = (order: string[]) => W.moveWishItem(clientFor(COUPLE), EVENT, form({ order: order.join(',') }));

  const reversed = [...ids].reverse();
  assert.deepEqual(await move(reversed), { ok: true });
  assert.deepEqual((await wishes()).map((w) => w.wish_item_id), reversed);
  assert.deepEqual((await wishes()).map((w) => w.sort_order), reversed.map((_, i) => i), 'each wish takes its place 0, 1, 2 …');

  const elsewhere = await db.query<{ wish_item_id: string }>(
    `INSERT INTO public.event_wish_items (event_id, name) VALUES ($1, 'Theirs') RETURNING wish_item_id`,
    [OTHER_EVENT],
  );
  const kept = JSON.stringify(await wishes());
  assert.equal((await move([...reversed.slice(1), elsewhere.rows[0]!.wish_item_id])).ok, false, 'an order naming another event’s wish');
  assert.equal((await move(reversed.slice(1))).ok, false, 'an order that leaves a wish out');
  assert.equal((await move([reversed[0]!, reversed[0]!, ...reversed.slice(2)])).ok, false, 'an order naming one wish twice');
  assert.equal((await move([])).ok, false);
  assert.equal(JSON.stringify(await wishes()), kept, 'a refused move moved something');
});

// ── 7 ───────────────────────────────────────────────────────────────────────

test('7 · Remove deletes the wish and keeps its gifts as "Any gift"', async () => {
  const lamp = await add('Reading lamp', '1800');
  const g = await gift(lamp.wish_item_id, 500);
  assert.deepEqual(await W.deleteWishItem(clientFor(COUPLE), EVENT, form({ wish_item_id: lamp.wish_item_id })), { ok: true });
  assert.equal((await wishes()).some((w) => w.name === 'Reading lamp'), false);
  const rec = await db.query<{ wish_item_id: string | null; amount_php: number }>(
    `SELECT wish_item_id, amount_php FROM public.event_gift_records WHERE gift_record_id = $1`,
    [g],
  );
  assert.deepEqual(rec.rows[0], { wish_item_id: null, amount_php: 500 });
  // A second Remove of the same wish is said, not swallowed.
  assert.equal((await W.deleteWishItem(clientFor(COUPLE), EVENT, form({ wish_item_id: lamp.wish_item_id }))).ok, false);
});
