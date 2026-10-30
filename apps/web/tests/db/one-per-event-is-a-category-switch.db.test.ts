/**
 * ONE PER EVENT IS A CATEGORY SWITCH (owner 2026-10-29) — test:db, migrations replayed.
 *
 * 20271296971721 moved "a couple may book only one of these per event" out of two hard-coded lists (the app's
 * HARD_SINGLE_PICK_GROUPS and the generated `event_vendors.hard_single_group` CASE) into ONE switch,
 * `service_categories.one_per_event`. The lock indexes and RPCs were not touched — they read the column — so
 * what is under test is that the column now FOLLOWS the switch, in both directions, and that the backfill is
 * the owner's: five on, LED off.
 *
 * Every test names the mutation that turns it red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

let n = 0;
async function newEvent(): Promise<string> {
  n += 1;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date_precision)
     VALUES ($1, 'birthday', 'year') RETURNING event_id`,
    [`One per event ${n}`],
  );
  return e.rows[0]!.event_id;
}

/** A confirmed booking (no marketplace link — the lock guard keys on the category alone). */
async function book(eventId: string, category: string, status = 'contracted'): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
     VALUES ($1, $2::public.vendor_category, 'One Co', $3::public.vendor_status) RETURNING vendor_id`,
    [eventId, category, status],
  );
  return r.rows[0]!.vendor_id;
}

async function refused(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

const switchOf = async (id: string) =>
  (await db.query<{ one_per_event: boolean }>(`SELECT one_per_event FROM public.service_categories WHERE id = $1`, [id])).rows[0]?.one_per_event;

test('the backfill is the owner’s: five categories on, LED off', async () => {
  // MUTATION: drop a name from the backfill list ⇒ its row reads false ⇒ red.
  for (const id of ['ceremony_venue', 'reception', 'officiants', 'coordinator', 'host_mc']) {
    assert.equal(await switchOf(id), true, `${id} must start as One per event`);
  }
  // MUTATION: put led_wall in the backfill ⇒ red ("we can book multiple for that as well").
  assert.equal(await switchOf('led_wall'), false, 'LED is multi (owner 2026-10-29)');
  const on = await db.query<{ c: string }>(`SELECT count(*) AS c FROM public.service_categories WHERE one_per_event`);
  assert.equal(Number(on.rows[0]!.c), 5, 'exactly the five — nothing else switched on by the backfill');
});

test('the column is no longer generated — the literal list is gone', async () => {
  const col = await db.query<{ is_generated: string }>(
    `SELECT is_generated FROM information_schema.columns
      WHERE table_schema='public' AND table_name='event_vendors' AND column_name='hard_single_group'`,
  );
  // MUTATION: drop the DROP EXPRESSION block ⇒ 'ALWAYS' ⇒ red.
  assert.equal(col.rows[0]?.is_generated, 'NEVER');
});

test('a second confirmed venue on one event is still refused (switch on)', async () => {
  const ev = await newEvent();
  await book(ev, 'venue');
  // MUTATION: make the key trigger write NULL ⇒ the second insert succeeds ⇒ red.
  const err = await refused(() => book(ev, 'venue'));
  assert.match(String(err), /hard_single_lock_uniq/, 'two confirmed receptions on one event must be refused');
});

test('two LED walls may both be booked (LED is multi now)', async () => {
  const ev = await newEvent();
  await book(ev, 'led_screens');
  // MUTATION: restore the old CASE (led_screens → led_background) ⇒ the second is refused ⇒ red.
  assert.equal(await refused(() => book(ev, 'led_screens')), null);
});

test('a client cannot write the key itself — the trigger always recomputes it', async () => {
  const ev = await newEvent();
  const id = await book(ev, 'venue', 'considering');
  await db.query(`UPDATE public.event_vendors SET hard_single_group = NULL WHERE vendor_id = $1`, [id]);
  const r = await db.query<{ hard_single_group: string | null }>(`SELECT hard_single_group FROM public.event_vendors WHERE vendor_id = $1`, [id]);
  // MUTATION: make the trigger INSERT-only ⇒ the NULL sticks ⇒ red.
  assert.equal(r.rows[0]!.hard_single_group, 'reception');
});

test('turning the switch OFF lets a second one in; turning it back ON re-keys the bookings', async () => {
  const ev = await newEvent();
  await book(ev, 'host_emcee');
  await db.query(`UPDATE public.service_categories SET one_per_event = false WHERE id = 'host_mc'`);
  // MUTATION: drop the follow trigger ⇒ the existing row keeps 'host_mc' ⇒ the second is refused ⇒ red.
  assert.equal(await refused(() => book(ev, 'host_emcee')), null, 'off → a co-host may be booked');

  // Back ON while this event holds two: the admin's update is refused, nothing half-changes.
  const err = await refused(() => db.query(`UPDATE public.service_categories SET one_per_event = true WHERE id = 'host_mc'`));
  assert.match(String(err), /hard_single_lock_uniq/, 'on → refused while an event already holds two');
  assert.equal(await switchOf('host_mc'), false, 'the refused flip left the switch as it was');

  // Clear the clash; now ON works and the bookings carry the key again.
  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE event_id = $1 AND category = 'host_emcee'`, [ev]);
  await db.query(`UPDATE public.service_categories SET one_per_event = true WHERE id = 'host_mc'`);
  const keys = await db.query<{ hard_single_group: string | null }>(
    `SELECT hard_single_group FROM public.event_vendors WHERE event_id = $1 AND category = 'host_emcee'`,
    [ev],
  );
  assert.deepEqual(keys.rows.map((r) => r.hard_single_group), ['host_mc', 'host_mc']);
});

test('switching a NEW category on makes its bookings one per event — no deploy', async () => {
  // The two LEDs the test above booked would (rightly) block the flip — step them back first.
  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE category = 'led_screens'`);
  const ev = await newEvent();
  await book(ev, 'led_screens');
  await db.query(`UPDATE public.service_categories SET one_per_event = true WHERE id = 'led_wall'`);
  // MUTATION: key on a literal list instead of the switch ⇒ the second LED is accepted ⇒ red.
  const err = await refused(() => book(ev, 'led_screens'));
  assert.match(String(err), /hard_single_lock_uniq/);
  await db.query(`UPDATE public.service_categories SET one_per_event = false WHERE id = 'led_wall'`);
});

test('officiants is filed under officiant, so an officiant booking belongs to it', async () => {
  const c = await db.query<{ coarse_category: string | null }>(`SELECT coarse_category::text FROM public.service_categories WHERE id = 'officiants'`);
  // MUTATION: drop the officiants filing ⇒ NULL ⇒ the officiant switch can never bite ⇒ red.
  assert.equal(c.rows[0]?.coarse_category, 'officiant');
  const ev = await newEvent();
  await book(ev, 'officiant');
  assert.match(String(await refused(() => book(ev, 'officiant'))), /hard_single_lock_uniq/);
});
