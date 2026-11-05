/**
 * THE GUEST PAGE'S STAMP MOVES WITH EVERY SHARED WRITE — event-day load L3
 * (migration 20271275959355), against the REPLAYED schema.
 *
 * The page remembers what every viewer of an event sees alike, filed under the
 * event's stamp (`apps/web/lib/event-shared-reads.ts`). That is only true if
 * every write to a table it may remember moves the stamp. This file proves it
 * on the real triggers:
 *
 *   1 · every table in `SHARED_EVENT_TABLES` carries a DEFERRED constraint
 *       trigger to `event_public_rev_on_write` — and `guests` watches exactly
 *       `GUESTS_SHARED_COLUMNS`;
 *   2 · a write moves the stamp AT COMMIT, to a value never used before; a
 *       `guests` RSVP or face-tagging answer does not; moving a row between
 *       events moves both; deleting an event is not refused;
 *   3 · `event_public_stamp(slug)` names the event and its rev;
 *   4 · `event_entitlement_facts(event)` answers what each separate question
 *       answers — the order rows, the comp list, the two host facts and, for
 *       every service code, the rows `event_basket_orders_granting` gives;
 *   5 · nothing here is reachable from a browser (anon / authenticated).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { GUESTS_SHARED_COLUMNS, SHARED_EVENT_TABLES } from '../../lib/event-shared-reads';

let replay: ReplayResult;
let db: PGlite;
let EVENT = '';
let OTHER = '';
let GUEST = '';
let seq = 900;
const nextRef = () => `STAMP${(seq += 1).toString().padStart(6, '0')}`;

const revOf = async (eventId: string): Promise<string | null> =>
  (await db.query<{ rev: string }>(`SELECT rev::text AS rev FROM public.event_public_revs WHERE event_id = $1`, [eventId])).rows[0]?.rev ?? null;
const asService = async <T>(run: () => Promise<T>): Promise<T> => {
  await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  try {
    return await run();
  } finally {
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  EVENT = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Maria & Jose', 'birthday', 'stamp-maria-jose') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  OTHER = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Other', 'birthday', 'stamp-other') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  GUEST = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role) VALUES ($1, 'Nene', 'Reyes', 'both', 'friends', 'guest') RETURNING guest_id`,
      [EVENT],
    )
  ).rows[0]!.guest_id;
});
after(async () => {
  await db?.close();
});

/* ═══ 1 · EVERY LISTED TABLE HAS ITS TRIGGER ════════════════════════════ */

test('1 · every table the page may remember carries a DEFERRED trigger that moves the stamp', async () => {
  const rows = (
    await db.query<{ tbl: string; tgname: string; deferrable: boolean; deferred: boolean; fn: string; def: string }>(
      `SELECT c.relname AS tbl, t.tgname, t.tgdeferrable AS deferrable, t.tginitdeferred AS deferred,
              p.proname AS fn, pg_get_triggerdef(t.oid) AS def
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
         JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE NOT t.tgisinternal AND p.proname = 'event_public_rev_on_write'`,
    )
  ).rows;
  for (const table of SHARED_EVENT_TABLES) {
    const mine = rows.filter((r) => r.tbl === table);
    assert.ok(mine.length > 0, `${table} may be remembered, but no trigger moves its stamp — a write to it would never be seen`);
    for (const r of mine) {
      assert.ok(r.deferrable && r.deferred, `${r.tgname} is not DEFERRABLE INITIALLY DEFERRED — it would lock the stamp mid-transaction`);
    }
    const events = mine.map((r) => r.def).join(' ');
    for (const op of ['INSERT', 'DELETE', 'UPDATE']) assert.ok(events.includes(op), `${table}: an ${op} does not move the stamp`);
  }
  const upd = rows.find((r) => r.tgname === 'guests_event_public_rev_upd');
  assert.ok(upd, 'the guests update trigger is gone');
  for (const column of GUESTS_SHARED_COLUMNS) {
    assert.ok(new RegExp(`old\\.${column}\\b`, 'i').test(upd.def), `guests.${column} is shared but its change does not move the stamp`);
  }
  const named = [...upd.def.matchAll(/old\.([a-z_]+)/gi)].map((m) => m[1]!.toLowerCase());
  assert.deepEqual([...new Set(named)].sort(), [...GUESTS_SHARED_COLUMNS].sort(), 'the guests trigger watches a column the app does not treat as shared (or the reverse)');
});

/* ═══ 2 · A WRITE MOVES THE STAMP, AT COMMIT ════════════════════════════ */

test('2 · a new event has a stamp; a write moves it to a value never used before', async () => {
  const first = await revOf(EVENT);
  assert.ok(first, 'a new event got no stamp from its own insert');
  const seen = new Set([first]);
  const moved = async (what: string, sql: string, params: unknown[]) => {
    await db.query(sql, params);
    const now = await revOf(EVENT);
    assert.ok(now && !seen.has(now), `${what} did not move the stamp to a new value (${now})`);
    seen.add(now!);
  };
  await moved('renaming the event', `UPDATE public.events SET display_name = 'Maria & Jose Reyes' WHERE event_id = $1`, [EVENT]);
  // (A new event is seeded with its scenes — one per type — so the countdown is cleared first, then written.)
  await db.query(`DELETE FROM public.invitation_widgets WHERE event_id = $1 AND widget_type = 'countdown'`, [EVENT]);
  seen.add((await revOf(EVENT))!);
  await moved('adding a scene', `INSERT INTO public.invitation_widgets (event_id, widget_type, display_order, is_visible) VALUES ($1, 'countdown', 99, TRUE)`, [EVENT]);
  await moved('hiding the scene', `UPDATE public.invitation_widgets SET is_visible = FALSE WHERE event_id = $1 AND widget_type = 'countdown'`, [EVENT]);
  await moved('removing the scene', `DELETE FROM public.invitation_widgets WHERE event_id = $1 AND widget_type = 'countdown'`, [EVENT]);
  await moved('a guest added', `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'Ana', 'Cruz', 'both', 'friends')`, [EVENT]);
  await moved('a guest made best man', `UPDATE public.guests SET role = 'best_man' WHERE guest_id = $1`, [GUEST]);
  await moved('a guest renamed', `UPDATE public.guests SET display_name = 'Nene R.' WHERE guest_id = $1`, [GUEST]);
});

test('2b · a guest’s RSVP or face-tagging answer does NOT move the stamp — the day’s own writes keep the cache', async () => {
  const before = await revOf(EVENT);
  await db.query(`UPDATE public.guests SET rsvp_status = 'attending' WHERE guest_id = $1`, [GUEST]);
  await db.query(`UPDATE public.guests SET face_tagging_wanted = TRUE WHERE guest_id = $1`, [GUEST]);
  // Re-writing a shared column with the SAME value is no change either.
  await db.query(`UPDATE public.guests SET role = role WHERE guest_id = $1`, [GUEST]);
  assert.equal(await revOf(EVENT), before, 'a guest’s own answer emptied every guest’s cache');
});

test('2c · the stamp moves at COMMIT — not while the transaction is still writing — and a rollback moves nothing', async () => {
  const before = await revOf(EVENT);
  await db.transaction(async (tx) => {
    await tx.query(`UPDATE public.events SET display_name = 'Mid-transaction' WHERE event_id = $1`, [EVENT]);
    await tx.query(`UPDATE public.guests SET display_name = 'Nene Mid' WHERE guest_id = $1`, [GUEST]);
    const inside = (await tx.query<{ rev: string }>(`SELECT rev::text AS rev FROM public.event_public_revs WHERE event_id = $1`, [EVENT])).rows[0]?.rev;
    assert.equal(inside, before, 'the stamp was locked and moved before COMMIT — the trigger is not deferred');
  });
  const after = await revOf(EVENT);
  assert.notEqual(after, before, 'the committed writes did not move the stamp');
  await db
    .transaction(async (tx) => {
      await tx.query(`UPDATE public.events SET display_name = 'Rolled back' WHERE event_id = $1`, [EVENT]);
      throw new Error('roll back');
    })
    .catch(() => undefined);
  assert.equal(await revOf(EVENT), after, 'a rolled-back write moved the stamp');
});

test('2d · a row moved to another event moves BOTH stamps; deleting an event is not refused', async () => {
  await db.query(`DELETE FROM public.invitation_widgets WHERE event_id IN ($1, $2) AND widget_type = 'greeting'`, [EVENT, OTHER]);
  const w = (
    await db.query<{ widget_id: string }>(
      `INSERT INTO public.invitation_widgets (event_id, widget_type, display_order, is_visible) VALUES ($1, 'greeting', 98, TRUE) RETURNING widget_id`,
      [EVENT],
    )
  ).rows[0]!.widget_id;
  const [a, b] = [await revOf(EVENT), await revOf(OTHER)];
  await db.query(`UPDATE public.invitation_widgets SET event_id = $2 WHERE widget_id = $1`, [w, OTHER]);
  assert.notEqual(await revOf(EVENT), a, 'the event the row left kept its stamp — it would keep showing the row');
  assert.notEqual(await revOf(OTHER), b, 'the event the row joined kept its stamp');
  // An event with scenes and guests deletes cleanly: the cascade's own triggers bump at COMMIT, no reference refuses them.
  const gone = (
    await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type, slug) VALUES ('Gone', 'birthday', 'stamp-gone') RETURNING event_id`)
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'X', 'Y', 'both', 'friends')`, [gone]);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [gone]);
  assert.equal((await db.query(`SELECT 1 FROM public.events WHERE event_id = $1`, [gone])).rows.length, 0);
});

/* ═══ 3 · THE STAMP READ ════════════════════════════════════════════════ */

test('3 · `event_public_stamp(slug)` names the event and its rev — case-insensitively, like the shell', async () => {
  const rows = await asService(
    async () => (await db.query<{ event_id: string; rev: string }>(`SELECT event_id, rev::text AS rev FROM public.event_public_stamp('Stamp-Maria-Jose')`)).rows,
  );
  assert.deepEqual(rows, [{ event_id: EVENT, rev: await revOf(EVENT) }]);
  const none = await asService(async () => (await db.query(`SELECT * FROM public.event_public_stamp('no-such-event')`)).rows);
  assert.equal(none.length, 0);
});

/* ═══ 4 · THE FACTS ═════════════════════════════════════════════════════ */

test('4 · `event_entitlement_facts` answers what each separate question answers — basket lines for every code', async () => {
  const order = async (key: string, status: string) =>
    (
      await db.query<{ order_id: string }>(
        `INSERT INTO public.orders (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
         VALUES ($1, NULL, $2, 'test', 1234, $3, $4) RETURNING order_id`,
        [EVENT, key, status, nextRef()],
      )
    ).rows[0]!.order_id;
  await order('COUPLE_WEBSITE_PRO', 'paid');
  const paidBasket = await order('ONBOARDING_SERVICES', 'paid');
  const pendingBasket = await order('ONBOARDING_SERVICES', 'submitted');
  for (const [o, code] of [[paidBasket, 'SETNAYAN_AI'], [paidBasket, 'ANIMATED_MONOGRAM'], [pendingBasket, 'PAPIC_GUEST_16K']] as const) {
    await db.query(`INSERT INTO public.onboarding_order_items (order_id, service_code, quantity, unit_price_php) VALUES ($1, $2, 1, 1)`, [o, code]);
  }
  // Another event's basket must never reach this one.
  const elsewhere = (
    await db.query<{ order_id: string }>(
      `INSERT INTO public.orders (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
       VALUES ($1, NULL, 'ONBOARDING_SERVICES', 'test', 1, 'paid', $2) RETURNING order_id`,
      [OTHER, nextRef()],
    )
  ).rows[0]!.order_id;
  await db.query(`INSERT INTO public.onboarding_order_items (order_id, service_code, quantity, unit_price_php) VALUES ($1, 'LIVE_STUDIO', 1, 1)`, [elsewhere]);

  await asService(async () => {
    const facts = (await db.query<{ f: Record<string, unknown> }>(`SELECT public.event_entitlement_facts($1) AS f`, [EVENT])).rows[0]!.f;
    // Key order is not part of a row (jsonb stores keys sorted) — compare sorted pairs.
    const sortRows = (rows: Array<Record<string, unknown>>) =>
      [...rows].map((r) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]))).sort();
    const orders = (await db.query<{ service_key: string; status: string }>(`SELECT service_key, status::text AS status FROM public.orders WHERE event_id = $1`, [EVENT])).rows;
    assert.deepEqual(sortRows(facts.orders as Array<Record<string, unknown>>), sortRows(orders), 'the order rows differ from the orders read');
    const comp = (await db.query<{ s: string[] }>(`SELECT public.event_comp_active_skus($1) AS s`, [EVENT])).rows[0]!.s;
    assert.deepEqual(facts.comp_skus, comp);
    assert.equal(facts.host_internal, (await db.query<{ b: boolean }>(`SELECT public.event_host_is_internal($1) AS b`, [EVENT])).rows[0]!.b);
    assert.equal(facts.founder_seat, (await db.query<{ b: boolean }>(`SELECT public.event_host_holds_founder_seat($1) AS b`, [EVENT])).rows[0]!.b);
    const basket = facts.basket as Array<{ service_code: string; order_id: string; status: string }>;
    let lines = 0;
    for (const code of ['SETNAYAN_AI', 'ANIMATED_MONOGRAM', 'PAPIC_GUEST_16K', 'LIVE_STUDIO', 'COUPLE_WEBSITE_PRO', 'NOT_A_CODE']) {
      const per = (
        await db.query<{ order_id: string; status: string }>(`SELECT order_id, status FROM public.event_basket_orders_granting($1, $2)`, [EVENT, code])
      ).rows;
      const mine = basket.filter((b) => b.service_code === code).map((b) => ({ order_id: b.order_id, status: b.status }));
      assert.deepEqual(sortRows(mine), sortRows(per), `${code}: the facts' basket lines differ from event_basket_orders_granting`);
      lines += per.length;
    }
    assert.equal(lines, 3, 'the basket fixture did not reach the function — the comparison proved nothing');
    assert.ok(!basket.some((b) => b.service_code === 'LIVE_STUDIO'), 'another event’s basket reached this one');
  });
});

/* ═══ 5 · NOTHING HERE IS A BROWSER'S ═══════════════════════════════════ */

test('5 · no browser role can read the stamps or call the two functions; the facts answer nobody but the service role', async () => {
  for (const role of ['anon', 'authenticated']) {
    const r = (
      await db.query<{ t: boolean; s: boolean; f: boolean }>(
        `SELECT has_table_privilege($1, 'public.event_public_revs', 'SELECT') AS t,
                has_function_privilege($1, 'public.event_public_stamp(text)', 'EXECUTE') AS s,
                has_function_privilege($1, 'public.event_entitlement_facts(uuid)', 'EXECUTE') AS f`,
        [role],
      )
    ).rows[0]!;
    assert.deepEqual(r, { t: false, s: false, f: false }, `${role} can reach the stamp machinery`);
  }
  const rls = (await db.query<{ on: boolean }>(`SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.event_public_revs'::regclass`)).rows[0]!;
  assert.equal(rls.on, true, 'RLS is off on event_public_revs');
  // Called without the service role's claim, the facts are NULL — the bill is the couple's.
  const f = (await db.query<{ f: unknown }>(`SELECT public.event_entitlement_facts($1) AS f`, [EVENT])).rows[0]!.f;
  assert.equal(f, null);
});
