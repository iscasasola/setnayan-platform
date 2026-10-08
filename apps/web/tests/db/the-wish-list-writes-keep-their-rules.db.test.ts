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
 *   7. Remove deletes the wish and keeps its gifts as "Any gift";
 *   8. ⚡ as few requests as the task allows, COUNTED on the real functions — and
 *      a save answers with the row as kept (the reason no re-read is owed).
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
import type { SupabaseClient } from '@supabase/supabase-js';

import './supabase-over-pglite'; // installs the `server-only` shim before the writers load
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

type Writers = typeof import('../../app/dashboard/[eventId]/pabuya/wish-items.server');
let W: Writers;
let replay: ReplayResult;
let db: PGlite;

let EVENT = '';
let OTHER_EVENT = '';
let COUPLE = '';
let STRANGER = '';

/* ── a supabase-js-shaped client that IS the signed-in person ────────────── */

type Row = Record<string, unknown>;
type Res = { data: Row[] | null; error: { message: string; code?: string } | null };
const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s: string) => {
  if (!IDENT.test(s)) throw new Error(`[wish adapter] not an identifier: ${s}`);
  return s;
};
const cols = (list: string) =>
  list
    .split(',')
    .map((c) => ident(c.trim()))
    .join(', ');

class Q implements PromiseLike<Res> {
  private eqs: Array<[string, unknown]> = [];
  private orders: string[] = [];
  private lim: number | null = null;
  private returning: string | null = null;
  private one = false;
  constructor(
    private uid: string,
    private table: string,
    private verb: 'select' | 'insert' | 'update' | 'delete',
    private payload: Row | null,
    private selected: string | null,
  ) {}
  select(list: string) {
    if (this.verb === 'select') throw new Error('[wish adapter] select().select() is not modelled');
    this.returning = cols(list);
    return this;
  }
  eq(col: string, value: unknown) {
    this.eqs.push([ident(col), value]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push(`${ident(col)} ${opts?.ascending === false ? 'DESC' : 'ASC'}`);
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  maybeSingle(): PromiseLike<{ data: Row | null; error: Res['error'] }> {
    this.one = true;
    return this.run().then((r) => ({ data: r.data?.[0] ?? null, error: r.error }));
  }
  then<A = Res, B = never>(ok?: ((v: Res) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.run().then(ok, no);
  }
  private async run(): Promise<Res> {
    const params: unknown[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where = () => (this.eqs.length ? ` WHERE ${this.eqs.map(([c, v]) => `${c} = ${p(v)}`).join(' AND ')}` : '');
    let sql: string;
    if (this.verb === 'select') {
      sql = `SELECT ${this.selected} FROM public.${ident(this.table)}${where()}`;
      if (this.orders.length) sql += ` ORDER BY ${this.orders.join(', ')}`;
      if (this.lim != null || this.one) sql += ` LIMIT ${this.one ? 1 : this.lim}`;
    } else if (this.verb === 'insert') {
      const keys = Object.keys(this.payload!);
      sql = `INSERT INTO public.${ident(this.table)} (${keys.map(ident).join(', ')}) VALUES (${keys.map((k) => p(this.payload![k])).join(', ')})`;
      if (this.returning) sql += ` RETURNING ${this.returning}`;
    } else if (this.verb === 'update') {
      const keys = Object.keys(this.payload!);
      const set = keys.map((k) => `${ident(k)} = ${p(this.payload![k])}`).join(', ');
      sql = `UPDATE public.${ident(this.table)} SET ${set}${where()}`;
      if (this.returning) sql += ` RETURNING ${this.returning}`;
    } else {
      sql = `DELETE FROM public.${ident(this.table)}${where()}`;
      if (this.returning) sql += ` RETURNING ${this.returning}`;
    }
    /* ONE STATEMENT AT A TIME. The writers run requests side by side (`Promise.all`), and this
       client is one connection: without the queue, one statement's RESET ROLE could land before
       another's query — which would then run as the superuser, past RLS, and "pass". */
    const turn = queue.then(async (): Promise<Res> => {
      sent.push(`${this.verb} ${this.table}`);
      await db.exec('SET ROLE authenticated');
      await setAuthUid(db, this.uid);
      try {
        const r = await db.query<Row>(sql, params);
        return { data: r.rows, error: null };
      } catch (e) {
        // Returned, never thrown — exactly as supabase-js hands a refusal back.
        return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } };
      } finally {
        await db.exec('RESET ROLE');
        await setAuthUid(db, null);
      }
    });
    queue = turn.then(
      () => undefined,
      () => undefined,
    );
    return turn;
  }
}

/** The statements-in-turn queue (see `run`). */
let queue: Promise<void> = Promise.resolve();
/** Every request the client sent, in order — "verb table" — for the count in test 8. */
const sent: string[] = [];
/** Run `fn` and hand back the requests it sent. */
async function counted<T>(fn: () => Promise<T>): Promise<{ res: T; sent: string[] }> {
  const from = sent.length;
  const res = await fn();
  return { res, sent: sent.slice(from) };
}

function clientFor(uid: string): SupabaseClient {
  return {
    from(table: string) {
      return {
        select: (list: string) => new Q(uid, table, 'select', null, cols(list)),
        insert: (row: Row) => new Q(uid, table, 'insert', row, null),
        update: (patch: Row) => new Q(uid, table, 'update', patch, null),
        delete: () => new Q(uid, table, 'delete', null, null),
      };
    },
  } as unknown as SupabaseClient;
}

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
  assert.equal(res.ok, true);
  return byName(name);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  /* The public media host, so a kept wish's picture has an address to be answered with. */
  process.env.R2_PUBLIC_URL = 'https://media.wish-writes.test';
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
  assert.equal(res.ok, true);
  const rice = await byName('Rice cooker');
  /* The save ANSWERS with the row as kept — its real id, the name trimmed, the link as stored —
     so the screen lays it over what it drew and no re-read is owed. */
  assert.ok(res.ok && res.wish);
  assert.deepEqual(
    res.wish,
    { id: rice.wish_item_id, name: 'Rice cooker', pricePhp: null, linkUrl: 'https://shop.example/rice-cooker', note: 'the grey one', photoRef: photo, photoUrl: `https://media.wish-writes.test/events/${EVENT}/wish-list/abc-rice.jpg`, gotBy: null },
  );
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

  assert.equal((await edit({ price: '8900' })).ok, true);
  assert.equal((await byName('Luggage set')).got_by, null, 'nothing moved: ₱3,000 of ₱8,900');

  const reached = await edit({ price: '3000' });
  assert.ok(reached.ok && reached.wish?.gotBy === 'auto', 'the answer carries the mark the price change made');
  let row = await byName('Luggage set');
  assert.equal(row.got_by, 'auto', 'the price came down to what was sent — it reached');
  assert.ok(row.got_at, 'both halves of the mark are written');

  assert.equal((await edit({ price: '5000' })).ok, true);
  row = await byName('Luggage set');
  assert.deepEqual([row.got_by, row.got_at], [null, null], 'the price went back above what was sent — open again');

  assert.equal((await edit({ price: '' })).ok, true);
  assert.equal((await byName('Luggage set')).got_by, null, 'a wish with no price never marks itself');

  // The couple's own mark is theirs: no sum takes it off or rewrites it.
  await W.setWishItemGot(clientFor(COUPLE), EVENT, form({ wish_item_id: lug.wish_item_id, got: '1' }));
  assert.equal((await edit({ price: '999999' })).ok, true);
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

// ── 8 ───────────────────────────────────────────────────────────────────────

test('8 · ⚡ as few requests as the task allows — counted on the real functions', async () => {
  const me = clientFor(COUPLE);
  const list = await wishes();
  assert.ok(list.length >= 4, 'the count needs a realistic list');

  /* ADD: where the list ends, then the insert — which answers with its own row (no read after). */
  const added = await counted(() => W.saveWishItem(me, EVENT, COUPLE, form({ name: 'Stand mixer', price: '12500' })));
  assert.equal(added.res.ok, true);
  assert.deepEqual(added.sent, ['select event_wish_items', 'insert event_wish_items']);
  /* A picture's address that cannot be built never turns a KEPT wish into a failure. */
  const host = process.env.R2_PUBLIC_URL;
  delete process.env.R2_PUBLIC_URL;
  const account = process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCOUNT_ID;
  try {
    const noHost = await W.saveWishItem(me, EVENT, COUPLE, form({ name: 'Kettle', photo_r2_key: `r2://setnayan-media/events/${EVENT}/wish-list/kettle.jpg` }));
    assert.ok(noHost.ok && noHost.wish && noHost.wish.photoUrl === null && noHost.wish.photoRef !== null, 'a kept wish was answered as a failure over its picture');
    await W.deleteWishItem(me, EVENT, form({ wish_item_id: noHost.wish.id }));
  } finally {
    process.env.R2_PUBLIC_URL = host;
    if (account) process.env.R2_ACCOUNT_ID = account;
  }
  const mixer = await byName('Stand mixer');

  /* EDIT: the row and what was sent toward it, side by side, then ONE write that answers with the row. */
  const edited = await counted(() => W.saveWishItem(me, EVENT, COUPLE, form({ wish_item_id: mixer.wish_item_id, name: 'Stand mixer', price: '11999', note: 'the red one' })));
  assert.ok(edited.res.ok && edited.res.wish?.note === 'the red one');
  assert.deepEqual([...edited.sent.slice(0, 2)].sort(), ['select event_gift_records', 'select event_wish_items']);
  assert.deepEqual(edited.sent.slice(2), ['update event_wish_items']);

  /* GOT IT and REMOVE: the write is the whole request. */
  const got = await counted(() => W.setWishItemGot(me, EVENT, form({ wish_item_id: mixer.wish_item_id, got: '1' })));
  assert.deepEqual([got.res, got.sent], [{ ok: true }, ['update event_wish_items']]);
  await W.setWishItemGot(me, EVENT, form({ wish_item_id: mixer.wish_item_id, got: '0' }));

  /* REORDER: one read, then ONLY the wishes whose place changed — two for a swap, whatever the length of the list. */
  const ids = (await wishes()).map((w) => w.wish_item_id);
  const swapped = [...ids];
  [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
  const moved = await counted(() => W.moveWishItem(me, EVENT, form({ order: swapped.join(',') })));
  assert.deepEqual(moved.res, { ok: true });
  assert.deepEqual(moved.sent, ['select event_wish_items', 'update event_wish_items', 'update event_wish_items'], `a swap in a list of ${ids.length} sent ${moved.sent.length} requests`);
  assert.deepEqual((await wishes()).map((w) => w.wish_item_id), swapped);
  /* The same order again changes nothing: the read alone. */
  const same = await counted(() => W.moveWishItem(me, EVENT, form({ order: swapped.join(',') })));
  assert.deepEqual([same.res, same.sent], [{ ok: true }, ['select event_wish_items']]);

  const gone = await counted(() => W.deleteWishItem(me, EVENT, form({ wish_item_id: mixer.wish_item_id })));
  assert.deepEqual([gone.res, gone.sent], [{ ok: true }, ['delete event_wish_items']]);
});
