/**
 * THE WISH LIST'S TWO TABLES — `event_wish_items` + `event_gift_records`,
 * asserted against the REPLAYED schema (migration
 * 20271266228704_the_wish_list_two_tables).
 *
 * ⚖ Owner 2026-10-08 (DECISION_LOG "E-GIFTS WISH LIST"): "when people send
 * gcash, they also give screenshot of their payment and the vallue and their
 * message for the couple. this will be the way to measure." And the design's
 * privacy line: a guest's screenshot, name, amount and message are the
 * couple's alone; Setnayan never holds the money.
 *
 * ── WHAT IS PINNED (each through a real `authenticated` / `anon` role) ─────
 *   1. a HOST (the couple, an accepted co-host, admin) reads their own event's
 *      wishes and gifts — and nobody else's;
 *   2. a signed-in NON-host reads ZERO rows of both: a stranger, an invited
 *      guest with an account, a moderator who was removed, one who never
 *      accepted;
 *   3. a GUEST WITH NO SESSION (anon) cannot read either table at all — and
 *      cannot write one;
 *   4. the couple keep their list themselves (insert · update · delete), but
 *      cannot plant a wish in somebody else's event;
 *   5. NOBODY signed in can invent or erase a gift record — the server writes
 *      a guest's record and Remove is soft; a host can correct the amount, move
 *      it, and soft-remove it;
 *   6. Got it is the ACTION's to write: no trigger marks a wish when its gifts
 *      reach the price;
 *   7. the rows outlive the people around them (the wish's author, the giver's
 *      guest row, the wish itself);
 *   8. the limits the app mirrors (lib/wish-list.ts) are the table's own.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • the host policy's USING relaxed to `true`         → 2 (stranger sees rows) red;
 *   • `GRANT SELECT … TO anon` added back               → 3 red;
 *   • `GRANT INSERT, DELETE` on gift records restored   → 5 red;
 *   • `ON DELETE SET NULL` dropped from created_by      → 7 (the delete is refused) red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import {
  GIFT_GIVER_NAME_MAX,
  GIFT_MESSAGE_MAX,
  GIFT_RECORD_SELECT,
  GIFT_SUM_FIELDS,
  WISH_GUEST_FIELDS,
  WISH_ITEM_SELECT,
  WISH_LINK_MAX,
  WISH_NAME_MAX,
  WISH_NOTE_MAX,
  reachedPrice,
  sumSent,
  type GiftSumRow,
} from '../../lib/wish-list';

let replay: ReplayResult;
let db: ReplayResult['db'];

let EVENT = '';
let OTHER_EVENT = '';
let COUPLE = '';
let COHOST = '';
let OTHER_COUPLE = '';
let GUEST_USER = '';
let STRANGER = '';
let ADMIN = '';
let REMOVED_MOD = '';
let PENDING_MOD = '';
let GUEST_ROW = '';

let WISH_AIR = ''; // ₱4,500 on EVENT
let WISH_ANY = ''; // no price, on EVENT
let WISH_ELSEWHERE = ''; // on OTHER_EVENT
let GIFT_1 = '';

let n = 0;
async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [`acct${n}@wish-list.test`],
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

async function wish(eventId: string, name: string, price: number | null, by: string | null = null): Promise<string> {
  const r = await db.query<{ wish_item_id: string }>(
    `INSERT INTO public.event_wish_items (event_id, name, price_php, created_by_user_id)
     VALUES ($1, $2, $3, $4) RETURNING wish_item_id`,
    [eventId, name, price, by],
  );
  return r.rows[0]!.wish_item_id;
}

/** The server's write — a guest's record goes in with the service role, never a browser role. */
async function gift(eventId: string, wishId: string | null, amount: number, giver = 'Tita Nene', guestId: string | null = null): Promise<string> {
  const r = await db.query<{ gift_record_id: string }>(
    `INSERT INTO public.event_gift_records (event_id, wish_item_id, amount_php, giver_name, giver_guest_id, message, method_kind)
     VALUES ($1, $2, $3, $4, $5, 'For your merienda machine!', 'gcash') RETURNING gift_record_id`,
    [eventId, wishId, amount, giver, guestId],
  );
  return r.rows[0]!.gift_record_id;
}

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE anon');
  await setAuthUid(db, null);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
  }
}

/** Resolves to the SQLSTATE a statement failed with, or 'ok'. */
async function outcome(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'ok';
  } catch (e) {
    return (e as { code?: string }).code ?? String((e as Error).message);
  }
}

const DENIED = '42501'; // insufficient_privilege — a missing grant AND a refused WITH CHECK
const CHECK = '23514';

/** What a signed-in user can see of both tables, through the app's own select lists. */
async function seenBy(uid: string): Promise<{ wishes: string[]; gifts: string[] }> {
  return as(uid, async () => {
    const w = await db.query<{ wish_item_id: string }>(`SELECT ${WISH_ITEM_SELECT} FROM public.event_wish_items`);
    const g = await db.query<{ gift_record_id: string }>(`SELECT ${GIFT_RECORD_SELECT} FROM public.event_gift_records`);
    return { wishes: w.rows.map((r) => r.wish_item_id).sort(), gifts: g.rows.map((r) => r.gift_record_id).sort() };
  });
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  EVENT = await newEvent('Maria & Jose');
  OTHER_EVENT = await newEvent('Somebody Else');

  COUPLE = await newUser();
  COHOST = await newUser();
  OTHER_COUPLE = await newUser();
  GUEST_USER = await newUser();
  STRANGER = await newUser();
  ADMIN = await newUser();
  REMOVED_MOD = await newUser();
  PENDING_MOD = await newUser();

  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Nene', 'Reyes', 'both', 'friends') RETURNING guest_id`,
    [EVENT],
  );
  GUEST_ROW = g.rows[0]!.guest_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id)
     VALUES ($1, $2, 'couple', NULL), ($1, $3, 'guest', $4), ($5, $6, 'couple', NULL)`,
    [EVENT, COUPLE, GUEST_USER, GUEST_ROW, OTHER_EVENT, OTHER_COUPLE],
  );
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [ADMIN]);

  // An accepted co-host; one who was removed; one who never accepted.
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, accepted_at, removed_at, permissions_json)
     VALUES ($1, $2, 'wedding_planner_external', now(), NULL, '{}'::jsonb),
            ($1, $3, 'wedding_planner_external', now(), now(), '{}'::jsonb),
            ($1, $4, 'wedding_planner_external', NULL, NULL, '{}'::jsonb)`,
    [EVENT, COHOST, REMOVED_MOD, PENDING_MOD],
  );

  WISH_AIR = await wish(EVENT, 'Air fryer', 4500, COUPLE);
  WISH_ANY = await wish(EVENT, 'Honeymoon fund', null, COUPLE);
  WISH_ELSEWHERE = await wish(OTHER_EVENT, 'Rice cooker', 3200, OTHER_COUPLE);

  GIFT_1 = await gift(EVENT, WISH_AIR, 2000, 'Tita Nene', GUEST_ROW);
  await gift(OTHER_EVENT, WISH_ELSEWHERE, 1000, 'Kuya Jun');
});

after(async () => {
  await replay?.db?.close?.();
});

// ── 0 · the fixture is not vacuous ─────────────────────────────────────────

test('fixture: both tables hold rows on two events, RLS is on, and the admin is admin', async () => {
  const w = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM public.event_wish_items`);
  const g = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM public.event_gift_records`);
  assert.equal(w.rows[0]!.c, 3);
  assert.equal(g.rows[0]!.c, 2);

  const rls = await db.query<{ relname: string; relrowsecurity: boolean }>(
    `SELECT relname, relrowsecurity FROM pg_class
      WHERE oid IN ('public.event_wish_items'::regclass, 'public.event_gift_records'::regclass) ORDER BY relname`,
  );
  assert.deepEqual(
    rls.rows.map((r) => [r.relname, r.relrowsecurity]),
    [
      ['event_gift_records', true],
      ['event_wish_items', true],
    ],
  );
  const a = await as(ADMIN, () => db.query<{ ok: boolean }>(`SELECT public.is_admin() AS ok`));
  assert.equal(a.rows[0]!.ok, true);
});

// ── 1 · a host reads their own ─────────────────────────────────────────────

test('the couple read their own wishes and gifts — and not another event’s', async () => {
  const seen = await seenBy(COUPLE);
  assert.deepEqual(seen.wishes, [WISH_AIR, WISH_ANY].sort());
  assert.deepEqual(seen.gifts, [GIFT_1]);
  assert.ok(!seen.wishes.includes(WISH_ELSEWHERE));
});

test('an accepted co-host reads the same; admin reads every event', async () => {
  const cohost = await seenBy(COHOST);
  assert.deepEqual(cohost.wishes, [WISH_AIR, WISH_ANY].sort());
  assert.deepEqual(cohost.gifts, [GIFT_1]);

  const admin = await seenBy(ADMIN);
  assert.equal(admin.wishes.length, 3);
  assert.equal(admin.gifts.length, 2);
});

// ── 2 · a non-host reads zero rows of both ─────────────────────────────────

test('a signed-in non-host reads ZERO rows of both tables', async () => {
  for (const [who, uid] of [
    ['a stranger', STRANGER],
    ['an invited guest with an account', GUEST_USER],
    ['a moderator who was removed', REMOVED_MOD],
    ['a moderator who never accepted', PENDING_MOD],
  ] as const) {
    const seen = await seenBy(uid);
    assert.deepEqual(seen.wishes, [], `${who} must see no wish`);
    assert.deepEqual(seen.gifts, [], `${who} must see no gift`);
  }
});

test('a guest’s projection and the sum are refused the same way — RLS is per row, not per column', async () => {
  const w = await as(GUEST_USER, () => db.query(`SELECT ${WISH_GUEST_FIELDS} FROM public.event_wish_items`));
  const s = await as(GUEST_USER, () => db.query(`SELECT ${GIFT_SUM_FIELDS} FROM public.event_gift_records`));
  assert.equal(w.rows.length, 0);
  assert.equal(s.rows.length, 0);
});

// ── 3 · a guest with no session cannot read either ─────────────────────────

test('anon cannot read either table at all, nor write one', async () => {
  assert.equal(await outcome(() => asAnon(() => db.query(`SELECT wish_item_id FROM public.event_wish_items`))), DENIED);
  assert.equal(await outcome(() => asAnon(() => db.query(`SELECT gift_record_id FROM public.event_gift_records`))), DENIED);
  assert.equal(
    await outcome(() => asAnon(() => db.query(`INSERT INTO public.event_wish_items (event_id, name) VALUES ($1, 'x')`, [EVENT]))),
    DENIED,
  );
  assert.equal(
    await outcome(() =>
      asAnon(() =>
        db.query(`INSERT INTO public.event_gift_records (event_id, amount_php, giver_name) VALUES ($1, 500, 'x')`, [EVENT]),
      ),
    ),
    DENIED,
  );

  const grants = await db.query<{ t: string; p: string }>(
    `SELECT table_name AS t, privilege_type AS p FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = 'anon'
        AND table_name IN ('event_wish_items', 'event_gift_records')`,
  );
  assert.deepEqual(grants.rows, [], 'anon holds no privilege on either table');

  const anonPolicies = await db.query<{ policyname: string }>(
    `SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('event_wish_items', 'event_gift_records')
        AND ('anon' = ANY (roles) OR 'public' = ANY (roles))`,
  );
  assert.deepEqual(anonPolicies.rows, [], 'no policy admits anon');
});

// ── 4 · the couple keep their list themselves ──────────────────────────────

test('a host adds, edits and removes a wish — but cannot plant one in another event', async () => {
  const made = await as(COUPLE, () =>
    db.query<{ wish_item_id: string; public_id: string }>(
      `INSERT INTO public.event_wish_items (event_id, name, price_php, link_url, note, created_by_user_id)
       VALUES ($1, 'Coffee maker', 6000, 'https://shop.example/coffee', 'the grey one', $2)
       RETURNING wish_item_id, public_id`,
      [EVENT, COUPLE],
    ),
  );
  const id = made.rows[0]!.wish_item_id;
  assert.match(made.rows[0]!.public_id, /^S89H-[0-9A-HJKMNP-TV-Z]{10}$/);

  const before = await db.query<{ updated_at: string }>(`SELECT updated_at FROM public.event_wish_items WHERE wish_item_id = $1`, [id]);
  await db.query(`SELECT pg_sleep(0.01)`);
  await as(COUPLE, () => db.query(`UPDATE public.event_wish_items SET price_php = 5500 WHERE wish_item_id = $1`, [id]));
  const after = await db.query<{ updated_at: string; price_php: number }>(
    `SELECT updated_at, price_php FROM public.event_wish_items WHERE wish_item_id = $1`,
    [id],
  );
  assert.equal(after.rows[0]!.price_php, 5500);
  assert.ok(new Date(after.rows[0]!.updated_at) > new Date(before.rows[0]!.updated_at), 'updated_at moves on an edit');

  await as(COUPLE, () => db.query(`DELETE FROM public.event_wish_items WHERE wish_item_id = $1`, [id]));
  const gone = await db.query(`SELECT 1 FROM public.event_wish_items WHERE wish_item_id = $1`, [id]);
  assert.equal(gone.rows.length, 0);

  assert.equal(
    await outcome(() =>
      as(COUPLE, () => db.query(`INSERT INTO public.event_wish_items (event_id, name) VALUES ($1, 'Planted')`, [OTHER_EVENT])),
    ),
    DENIED,
    'WITH CHECK refuses a wish in an event the caller does not host',
  );
  // …and an UPDATE or DELETE aimed at another event's wish simply matches nothing.
  await as(COUPLE, () => db.query(`UPDATE public.event_wish_items SET name = 'Hijacked' WHERE wish_item_id = $1`, [WISH_ELSEWHERE]));
  await as(COUPLE, () => db.query(`DELETE FROM public.event_wish_items WHERE wish_item_id = $1`, [WISH_ELSEWHERE]));
  const intact = await db.query<{ name: string }>(`SELECT name FROM public.event_wish_items WHERE wish_item_id = $1`, [WISH_ELSEWHERE]);
  assert.equal(intact.rows[0]?.name, 'Rice cooker');
});

test('a stranger cannot write a wish anywhere', async () => {
  assert.equal(
    await outcome(() => as(STRANGER, () => db.query(`INSERT INTO public.event_wish_items (event_id, name) VALUES ($1, 'x')`, [EVENT]))),
    DENIED,
  );
});

// ── 5 · a gift record is the guest's statement ─────────────────────────────

test('no signed-in user can invent or erase a gift record — not even the couple', async () => {
  assert.equal(
    await outcome(() =>
      as(COUPLE, () =>
        db.query(`INSERT INTO public.event_gift_records (event_id, wish_item_id, amount_php, giver_name) VALUES ($1, $2, 9000, 'Forged')`, [
          EVENT,
          WISH_AIR,
        ]),
      ),
    ),
    DENIED,
  );
  assert.equal(
    await outcome(() => as(COUPLE, () => db.query(`DELETE FROM public.event_gift_records WHERE gift_record_id = $1`, [GIFT_1]))),
    DENIED,
  );
  const still = await db.query(`SELECT 1 FROM public.event_gift_records WHERE gift_record_id = $1`, [GIFT_1]);
  assert.equal(still.rows.length, 1);
});

test('the couple correct an amount, move a gift and soft-remove it; a removed record stops counting', async () => {
  const id = await gift(EVENT, WISH_AIR, 700, 'Ate Grace');
  const sumOf = async (wishId: string): Promise<number> => {
    const r = await as(COUPLE, () =>
      db.query<GiftSumRow>(`SELECT ${GIFT_SUM_FIELDS} FROM public.event_gift_records WHERE event_id = $1 AND wish_item_id = $2`, [EVENT, wishId]),
    );
    return sumSent(r.rows);
  };
  assert.equal(await sumOf(WISH_AIR), 2700);

  await as(COUPLE, () => db.query(`UPDATE public.event_gift_records SET amount_php = 500 WHERE gift_record_id = $1`, [id]));
  assert.equal(await sumOf(WISH_AIR), 2500, 'the corrected amount is the one that counts');

  await as(COUPLE, () => db.query(`UPDATE public.event_gift_records SET wish_item_id = $2 WHERE gift_record_id = $1`, [id, WISH_ANY]));
  assert.equal(await sumOf(WISH_AIR), 2000);
  assert.equal(await sumOf(WISH_ANY), 500);

  await as(COUPLE, () => db.query(`UPDATE public.event_gift_records SET removed_at = now() WHERE gift_record_id = $1`, [id]));
  assert.equal(await sumOf(WISH_ANY), 0, 'a removed record never counts');
  const kept = await db.query(`SELECT 1 FROM public.event_gift_records WHERE gift_record_id = $1`, [id]);
  assert.equal(kept.rows.length, 1, 'Remove is soft — the record is still there to put back');

  // A stranger's UPDATE matches nothing.
  await as(STRANGER, () => db.query(`UPDATE public.event_gift_records SET amount_php = 1 WHERE gift_record_id = $1`, [GIFT_1]));
  const untouched = await db.query<{ amount_php: number }>(`SELECT amount_php FROM public.event_gift_records WHERE gift_record_id = $1`, [GIFT_1]);
  assert.equal(untouched.rows[0]!.amount_php, 2000);
});

test('a gift record wears the E-Gifts letter, not the guests’', async () => {
  const r = await db.query<{ public_id: string }>(`SELECT public_id FROM public.event_gift_records WHERE gift_record_id = $1`, [GIFT_1]);
  assert.match(r.rows[0]!.public_id, /^S89Y-[0-9A-HJKMNP-TV-Z]{10}$/);
});

// ── 6 · Got it is the action's to write ────────────────────────────────────

test('no trigger marks a wish got when its gifts reach the price — the action does', async () => {
  const w = await wish(EVENT, 'Bed linen', 2500, COUPLE);
  await gift(EVENT, w, 2500, 'Lola Cely');
  const sum = await db.query<GiftSumRow>(`SELECT ${GIFT_SUM_FIELDS} FROM public.event_gift_records WHERE wish_item_id = $1`, [w]);
  assert.equal(reachedPrice(2500, sumSent(sum.rows)), true, 'the gifts DID reach the price');

  const row = await db.query<{ got_at: string | null; got_by: string | null }>(
    `SELECT got_at, got_by FROM public.event_wish_items WHERE wish_item_id = $1`,
    [w],
  );
  assert.deepEqual(row.rows[0], { got_at: null, got_by: null }, 'the table did not mark it — only an action may');

  const triggers = await db.query<{ tgname: string }>(
    `SELECT tgname FROM pg_trigger
      WHERE NOT tgisinternal AND tgrelid IN ('public.event_wish_items'::regclass, 'public.event_gift_records'::regclass)`,
  );
  assert.deepEqual(
    triggers.rows.map((t) => t.tgname),
    ['event_wish_items_set_updated_at'],
    'two plain tables: the only trigger is updated_at',
  );

  // The couple's switch — and both columns move together or not at all.
  await as(COUPLE, () => db.query(`UPDATE public.event_wish_items SET got_at = now(), got_by = 'host' WHERE wish_item_id = $1`, [w]));
  assert.equal(await outcome(() => db.query(`UPDATE public.event_wish_items SET got_by = NULL WHERE wish_item_id = $1`, [w])), CHECK);
  assert.equal(await outcome(() => db.query(`UPDATE public.event_wish_items SET got_by = 'guest' WHERE wish_item_id = $1`, [w])), CHECK);
});

// ── 7 · the rows outlive the people around them ────────────────────────────

test('deleting the wish keeps its gifts as "Any gift"; deleting the guest keeps the record', async () => {
  const w = await wish(EVENT, 'Luggage set', 8900, COUPLE);
  const guest = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Jun', 'Cruz', 'both', 'friends') RETURNING guest_id`,
    [EVENT],
  );
  const rec = await gift(EVENT, w, 3000, 'Kuya Jun', guest.rows[0]!.guest_id);

  await db.query(`DELETE FROM public.event_wish_items WHERE wish_item_id = $1`, [w]);
  await db.query(`DELETE FROM public.guests WHERE guest_id = $1`, [guest.rows[0]!.guest_id]);

  const kept = await db.query<{ wish_item_id: string | null; giver_guest_id: string | null; giver_name: string; amount_php: number }>(
    `SELECT wish_item_id, giver_guest_id, giver_name, amount_php FROM public.event_gift_records WHERE gift_record_id = $1`,
    [rec],
  );
  assert.deepEqual(kept.rows[0], { wish_item_id: null, giver_guest_id: null, giver_name: 'Kuya Jun', amount_php: 3000 });
});

test('deleting the account that added a wish is not refused, and the wish stays', async () => {
  const author = await newUser();
  const w = await wish(EVENT, 'Stand mixer', 12500, author);
  assert.equal(await outcome(() => db.query(`DELETE FROM auth.users WHERE id = $1`, [author])), 'ok');
  const row = await db.query<{ created_by_user_id: string | null; name: string }>(
    `SELECT created_by_user_id, name FROM public.event_wish_items WHERE wish_item_id = $1`,
    [w],
  );
  assert.deepEqual(row.rows[0], { created_by_user_id: null, name: 'Stand mixer' });
});

test('deleting the event takes its wishes and gifts with it', async () => {
  const ev = await newEvent('Short-lived');
  const w = await wish(ev, 'Plant', 900);
  await gift(ev, w, 900);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [ev]);
  const left = await db.query<{ c: number }>(
    `SELECT (SELECT count(*) FROM public.event_wish_items WHERE event_id = $1)::int
          + (SELECT count(*) FROM public.event_gift_records WHERE event_id = $1)::int AS c`,
    [ev],
  );
  assert.equal(left.rows[0]!.c, 0);
});

// ── 8 · the limits the app mirrors are the table's own ─────────────────────

test('the wish limits: name, price, link, note', async () => {
  const put = (cols: string, vals: string, params: unknown[]) =>
    outcome(() => db.query(`INSERT INTO public.event_wish_items (event_id, ${cols}) VALUES ($1, ${vals})`, [EVENT, ...params]));

  assert.equal(await put('name', '$2', ['x'.repeat(WISH_NAME_MAX)]), 'ok');
  assert.equal(await put('name', '$2', ['x'.repeat(WISH_NAME_MAX + 1)]), CHECK);
  assert.equal(await put('name', '$2', ['   ']), CHECK, 'a blank name is not a wish');

  assert.equal(await put('name, price_php', `'p', $2`, [0]), CHECK);
  assert.equal(await put('name, price_php', `'p', $2`, [-5]), CHECK);
  assert.equal(await put('name, price_php', `'p', $2`, [1]), 'ok');

  assert.equal(await put('name, link_url', `'l', $2`, ['javascript:alert(1)']), CHECK);
  assert.equal(await put('name, link_url', `'l', $2`, ['https://shop.example/a b']), CHECK);
  assert.equal(await put('name, link_url', `'l', $2`, [`https://shop.example/${'a'.repeat(WISH_LINK_MAX)}`]), CHECK);
  assert.equal(await put('name, link_url', `'l', $2`, ['https://shop.example/air-fryer']), 'ok');

  assert.equal(await put('name, note', `'n', $2`, ['x'.repeat(WISH_NOTE_MAX)]), 'ok');
  assert.equal(await put('name, note', `'n', $2`, ['x'.repeat(WISH_NOTE_MAX + 1)]), CHECK);
});

test('the gift limits: amount, message, giver name', async () => {
  const put = (amount: number, giver: string, message: string | null) =>
    outcome(() =>
      db.query(`INSERT INTO public.event_gift_records (event_id, amount_php, giver_name, message) VALUES ($1, $2, $3, $4)`, [
        OTHER_EVENT,
        amount,
        giver,
        message,
      ]),
    );
  assert.equal(await put(0, 'A', null), CHECK, 'a gift of nothing is not a record');
  assert.equal(await put(-100, 'A', null), CHECK);
  assert.equal(await put(500, '  ', null), CHECK, 'a record always says who it is from');
  assert.equal(await put(500, 'x'.repeat(GIFT_GIVER_NAME_MAX + 1), null), CHECK);
  assert.equal(await put(500, 'A', 'x'.repeat(GIFT_MESSAGE_MAX + 1)), CHECK);
  assert.equal(await put(500, 'x'.repeat(GIFT_GIVER_NAME_MAX), 'x'.repeat(GIFT_MESSAGE_MAX)), 'ok');
});

// ── 9 · the policy is event_egift_methods' own, not a new pattern ──────────

test('both host policies carry exactly the E-Gifts ways-to-give predicate', async () => {
  const pol = await db.query<{ tablename: string; cmd: string; roles: string[]; qual: string; with_check: string }>(
    `SELECT tablename, cmd, roles::text[] AS roles, qual, with_check FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('event_egift_methods', 'event_wish_items', 'event_gift_records')
      ORDER BY tablename`,
  );
  assert.equal(pol.rows.length, 3, 'one policy per table — no second door');
  const methods = pol.rows.find((p) => p.tablename === 'event_egift_methods')!;
  for (const t of ['event_wish_items', 'event_gift_records']) {
    const p = pol.rows.find((x) => x.tablename === t)!;
    assert.equal(p.cmd, 'ALL');
    assert.deepEqual(p.roles, ['authenticated']);
    assert.equal(p.qual, methods.qual, `${t} USING differs from event_egift_methods_host_all`);
    assert.equal(p.with_check, methods.with_check, `${t} WITH CHECK differs from event_egift_methods_host_all`);
  }
});
