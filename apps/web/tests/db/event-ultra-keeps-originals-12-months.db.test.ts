/**
 * 💎 EVENT ULTRA KEEPS FULL-SIZE ORIGINALS 12 MONTHS — executed (owner 2026-11-13, "EVENT ULTRA APPROVED — BUILD IT":
 * *"full-size originals kept 12 months after the event's last day instead of 3 (Ultra events only)"*).
 *
 * Replays every migration into PGlite, seeds the EVENT_ULTRA row's own figures (never typed here), and CALLS
 * `papic_events_past_fullres_clock` — the one function both the sweep (lib/papic-fullres-drop.ts) and the warning
 * email (lib/daily-email-jobs.ts) ask.
 *
 * 🪤 The "not yet" cases are the ones that bite: an Ultra event 100 days past its last day must NOT be returned (it
 * would be under the plain 92-day floor), and a refunded Ultra or a paid Event Pro must get NO extra hold. The
 * "released" case proves the hold still lets go.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let seq = 0;

const DAY = 86_400_000;
const CAPTURED_LONG_AGO = new Date(Date.now() - 900 * DAY).toISOString();
/** Mirrors FULL_RES_POST_EVENT_GRACE_DAYS = 92 (lib/papic-fullres-drop-core.ts). */
const GRACE = 92;

function dateDaysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
}

async function seedEvent(name: string, lastDayAgo: number): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1, 'birthday', $2::date) RETURNING event_id`,
    [name, dateDaysAgo(lastDayAgo)],
  );
  const eventId = ev.rows[0]!.event_id;
  const guest = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Ultra', 'Clock', 'both', 'friends') RETURNING guest_id`,
    [eventId],
  );
  await db.query(
    `INSERT INTO public.papic_guest_captures
       (event_id, guest_id, r2_object_key, display_r2_key, media_type, captured_at)
     VALUES ($1, $2, $3, $3, 'photo', $4)`,
    [eventId, guest.rows[0]!.guest_id, `r2://setnayan-media/papic/${eventId}.jpg`, CAPTURED_LONG_AGO],
  );
  return eventId;
}

async function order(eventId: string, sku: string, status: string): Promise<void> {
  seq += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`ultra-clock-${seq}@test.local`],
  );
  await db.query(
    `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code, service_key, status)
     VALUES ($1, $2, $3, 1, $4, $3, $5)`,
    [u.rows[0]!.id, eventId, sku, `ULTRA${seq}`, status],
  );
}

async function expiredNow(postEventDays = GRACE): Promise<Set<string>> {
  const res = await db.query<{ event_id: string }>(
    `SELECT event_id FROM public.papic_events_past_fullres_clock(0, $1::int)`,
    [postEventDays],
  );
  return new Set(res.rows.map((r) => r.event_id));
}

/** The row's own figure — the test follows the catalogue, never a typed copy. */
async function ultraExtraDays(): Promise<number> {
  const r = await db.query<{ d: number | null }>(
    `SELECT fullres_extra_keep_days AS d FROM public.platform_retail_catalog_v2 WHERE service_code = 'EVENT_ULTRA'`,
  );
  return Number(r.rows[0]?.d ?? 0);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
});

after(async () => {
  await db?.close();
});

test('the EVENT_ULTRA row is on sale, one-time, with its credits and a 12-month hold', async () => {
  const r = await db.query<{
    retail_price_php: string;
    billing_period: string;
    is_active: boolean;
    included_papic_credits: number;
    fullres_extra_keep_days: number;
  }>(
    `SELECT retail_price_php, billing_period, is_active, included_papic_credits, fullres_extra_keep_days
       FROM public.platform_retail_catalog_v2 WHERE service_code = 'EVENT_ULTRA'`,
  );
  const row = r.rows[0];
  assert.ok(row, 'no EVENT_ULTRA row');
  assert.equal(Number(row.retail_price_php), 9990);
  assert.equal(row.billing_period, 'one_time');
  assert.equal(row.is_active, true);
  assert.equal(row.included_papic_credits, 3500);
  // 12 months in all: the standard hold plus the extra is at least 365 days, and it is not the plain 92.
  assert.ok(GRACE + row.fullres_extra_keep_days >= 365, '12 months is at least 365 days');
  assert.ok(GRACE + row.fullres_extra_keep_days <= 366, 'and no more than a leap year');
});

test('🚨 a PAID Ultra event 100 days past its last day keeps its originals', async () => {
  const id = await seedEvent('Ultra, 100 days on', 100);
  await order(id, 'EVENT_ULTRA', 'paid');
  assert.ok(!(await expiredNow()).has(id), 'an Ultra event was released at three months — the extra hold is not read');
});

test('…and lets go once the 12 months have passed', async () => {
  const extra = await ultraExtraDays();
  const id = await seedEvent('Ultra, past 12 months', GRACE + extra + 3);
  await order(id, 'EVENT_ULTRA', 'fulfilled');
  assert.ok((await expiredNow()).has(id), 'the Ultra hold never releases — the sweep would be inert');
});

test('a refunded Ultra, a pending Ultra and a paid Event Pro get NO extra hold', async () => {
  const refunded = await seedEvent('Ultra refunded', 100);
  await order(refunded, 'EVENT_ULTRA', 'refunded');
  const pending = await seedEvent('Ultra under review', 100);
  await order(pending, 'EVENT_ULTRA', 'submitted');
  const pro = await seedEvent('Pro only', 100);
  await order(pro, 'COUPLE_WEBSITE_PRO', 'paid');
  const plain = await seedEvent('No plan', 100);
  const expired = await expiredNow();
  for (const [name, id] of [['refunded Ultra', refunded], ['pending Ultra', pending], ['paid Pro', pro], ['no plan', plain]] as const) {
    assert.ok(expired.has(id), `${name} was held past three months — only an approved Ultra order holds longer`);
  }
});

test('the warning job’s pulled-back call still sees the Ultra event before the sweep does', async () => {
  // daily-email-jobs.ts calls the same function with the post-event days pulled back by its lead (14). An Ultra
  // event 14 days short of release must show up there, and not in the sweep's own call.
  const extra = await ultraExtraDays();
  const id = await seedEvent('Ultra, two weeks to go', GRACE + extra - 7);
  await order(id, 'EVENT_ULTRA', 'paid');
  assert.ok(!(await expiredNow()).has(id), 'released a week early');
  assert.ok((await expiredNow(GRACE - 14)).has(id), 'the warning never fires for an Ultra event');
});
