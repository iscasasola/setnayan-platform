/**
 * PAY-01 BACKFILL (owner ruling 2026-11-15) — migration 20271347531019.
 *
 * A booking frozen with the generic 50/50 ESTIMATE (is_default_seeded) over an ACCEPTED quote is rewritten to the
 * quote's own amounts. Executed against seeded rows, not read as text:
 *   · the estimate over a 20% quote becomes ₱8,350 + ₱33,400 (the quote's fixed centavos), dates kept, no longer an
 *     estimate
 *   · a plan a supplier authored (is_default_seeded = FALSE) is untouched — that question is still OPEN
 *   · an estimate with no accepted quote is untouched
 *   · a second run changes nothing (idempotent)
 *   · more than 20 qualifying plans RAISES and writes nothing
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const MIGRATION = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20271347531019_pay_01_backfill_estimates_to_accepted_quote.sql'),
  'utf8',
);

let replay: ReplayResult;
let db: PGlite;
let shop: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('pay01-shop@example.com', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  const s = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'PAY-01 Shop', 'Manila', ARRAY['photography']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  shop = s.rows[0]!.vendor_profile_id;
});
after(async () => {
  await replay?.db.close();
});

const ESTIMATE = (half: number, lock: string, balanceDue: string | null) => [
  { seq: 0, label: 'First payment (estimated)', due_date: lock, amount_php: half, amount_kind: 'percent', percent_bps: 5000 },
  { seq: 1, label: 'Balance (estimated)', due_date: balanceDue, amount_php: half, amount_kind: 'percent', percent_bps: 5000 },
];

/** The quote's own frozen-on-send schedule — the shape `lib/proposal-send.ts` writes. */
const QUOTE_20 = (totalCents: number) => ({
  version: 1,
  balances: true,
  installments: [
    { due: 'on_lock', seq: 0, kind: 'percent', label: 'First payment', offset_days: 0, percent_bps: 2000, is_downpayment: true, amount_centavos: totalCents / 5 },
    { due: 'before_event', seq: 1, kind: 'auto', label: 'Final balance', offset_days: 14, percent_bps: null, is_downpayment: false, amount_centavos: totalCents - totalCents / 5 },
  ],
  total_centavos: totalCents,
});

async function booking(opts: { tag: string; total: number; seeded: boolean; quote: boolean; plan?: unknown }) {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ($1, 'birthday', '2026-12-19'::date, 'day') RETURNING event_id`,
    [`PAY-01 ${opts.tag}`],
  );
  const eventId = e.rows[0]!.event_id;
  const v = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php)
     VALUES ($1, 'photographer', 'PAY-01 Shop', 'considering', $2) RETURNING vendor_id`,
    [eventId, opts.total],
  );
  const vendorId = v.rows[0]!.vendor_id;
  // The same link the replot suite stamps (an unlisted test shop cannot be BOOKED by an insert).
  await db.query(`UPDATE public.event_vendors SET marketplace_vendor_id = $2 WHERE vendor_id = $1`, [vendorId, shop]);
  await db.query(
    `INSERT INTO public.event_vendor_payment_plan (event_id, event_vendor_id, instances_json, is_default_seeded)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [eventId, vendorId, JSON.stringify(opts.plan ?? ESTIMATE(opts.total / 2, '2026-11-14', '2026-12-05')), opts.seeded],
  );
  if (opts.quote) {
    const cents = opts.total * 100;
    await db.query(
      `INSERT INTO public.vendor_proposals
         (event_id, vendor_profile_id, title, status, total_centavos, sent_at, line_items, merge_snapshot, valid_until, payment_schedule, resolved_at)
       VALUES ($1, $2, 'Coverage', 'accepted', $3, NOW(),
               jsonb_build_array(jsonb_build_object('label','Coverage','detail',NULL,'amount_centavos',$3::bigint)),
               '{}'::jsonb, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7, $4::jsonb, NOW())`,
      [eventId, shop, cents, JSON.stringify(QUOTE_20(cents))],
    );
  }
  return vendorId;
}

async function planOf(vendorId: string) {
  const r = await db.query<{ instances_json: Array<Record<string, unknown>>; is_default_seeded: boolean }>(
    `SELECT instances_json, is_default_seeded FROM public.event_vendor_payment_plan WHERE event_vendor_id = $1`,
    [vendorId],
  );
  return r.rows[0]!;
}

test('an estimate over an accepted 20% quote becomes the quote; others are untouched; a re-run is a no-op', async () => {
  const fixed = await booking({ tag: 'quote', total: 41_750, seeded: true, quote: true });
  const authoredPlan = [
    { seq: 0, label: 'Reservation', due_date: '2026-11-14', amount_php: 10_000, amount_kind: 'fixed', percent_bps: null },
    { seq: 1, label: 'Balance', due_date: '2026-12-05', amount_php: 31_750, amount_kind: 'fixed', percent_bps: null },
  ];
  const authored = await booking({ tag: 'authored', total: 41_750, seeded: false, quote: true, plan: authoredPlan });
  const noQuote = await booking({ tag: 'no-quote', total: 17_500, seeded: true, quote: false });
  const before = { authored: await planOf(authored), noQuote: await planOf(noQuote) };

  await db.exec(MIGRATION);

  const p = await planOf(fixed);
  assert.equal(p.is_default_seeded, false, 'the rewritten plan is no longer an estimate');
  assert.deepEqual(
    p.instances_json.map((i) => [i.seq, i.label, Number(i.amount_php), i.due_date, i.amount_kind, i.percent_bps]),
    [
      [0, 'First payment', 8_350, '2026-11-14', 'fixed', null],
      [1, 'Final balance', 33_400, '2026-12-05', 'fixed', null],
    ],
    '₱20,875 + ₱20,875 becomes the quote: ₱8,350 (20% of ₱41,750) + the balance, dates kept',
  );
  assert.deepEqual(await planOf(authored), before.authored, 'a supplier-authored plan is untouched (still an open owner question)');
  assert.deepEqual(await planOf(noQuote), before.noQuote, 'an estimate with no accepted quote is untouched');

  const once = await planOf(fixed);
  await db.exec(MIGRATION);
  assert.deepEqual(await planOf(fixed), once, 'a second run changes nothing');
});

test('more than 20 qualifying plans RAISES and writes nothing', async () => {
  const ids: string[] = [];
  for (let n = 0; n < 21; n += 1) ids.push(await booking({ tag: `many-${n}`, total: 10_000, seeded: true, quote: true }));
  await assert.rejects(db.exec(MIGRATION), /safety stop/);
  for (const id of ids) assert.equal((await planOf(id)).is_default_seeded, true, 'nothing was written');
});
