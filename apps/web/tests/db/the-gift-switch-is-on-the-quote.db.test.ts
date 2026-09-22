/**
 * the-gift-switch-is-on-the-quote.db.test.ts — the ACCEPTED quote's switch
 * decides the Setnayan gift; the card is only the default; a stranger's quote
 * cannot switch it; and the bill sizes the gift from the same answer.
 *
 * ⚖ OWNER, 2026-09-22: "per-quote switch" (on the approved prototype) and, on
 * the switch drawn disabled there, "We want this working."
 *
 * Migration under test: 20271240324859_the_gift_switch_is_on_the_quote.sql —
 * `vendor_proposals.includes_setnayan_gift` (nullable, no default) and
 * `setnayan_gift_offered_on` reading the accepted quote before the card.
 *
 * ── Why a db-test and not a unit test ──────────────────────────────────────
 * Production holds 3 threads, all accepted, and 0 quotes sent through the
 * composer; there is no preview for a migration. The only place these rows
 * can be seen deciding anything is the replayed schema.
 *
 * 🛡 Sabotage watched red: delete `AND vp.vendor_profile_id =
 * ev.marketplace_vendor_id` from the quote arm — test 4 (a stranger's quote)
 * goes red. Also: read the card first (`COALESCE(card, quote)`) — test 1 goes
 * red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let db: ReplayResult['db'];
let n = 0;

before(async () => {
  db = (await createReplayedDb()).db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

/** A supplier with one card (the gift as given), a couple's event, and the booking row between them. */
async function seedBooking(cardGiftOn: boolean) {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`quote switch ${n}`],
  );
  const vendorProfileId = await one<string>(
    `INSERT INTO public.vendor_profiles (business_name) VALUES ($1) RETURNING vendor_profile_id`,
    [`Shop ${n}`],
  );
  const serviceId = await one<string>(
    // is_active FALSE: an active card must carry a cover photo (a real CHECK).
    // `setnayan_gift_offered_on` does not read is_active.
    `INSERT INTO public.vendor_services (vendor_profile_id, category, includes_setnayan_gift, is_active)
     VALUES ($1, 'live_band', $2, FALSE) RETURNING vendor_service_id`,
    [vendorProfileId, cardGiftOn],
  );
  const eventVendorId = await one<string>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, total_cost_php)
     VALUES ($1, 'band_dj', $2, 'considering', $3, $4, 50000)
     RETURNING vendor_id`,
    [eventId, `Shop ${n}`, vendorProfileId, serviceId],
  );
  return { eventId, vendorProfileId, serviceId, eventVendorId };
}

/** A quote by `vendorProfileId` on `eventId`, in `status`, with the switch as given (null = says nothing). */
async function seedQuote(
  eventId: string,
  vendorProfileId: string,
  status: 'sent' | 'accepted',
  giftSwitch: boolean | null,
  resolvedAt: string | null = status === 'accepted' ? new Date().toISOString() : null,
) {
  return one<string>(
    `INSERT INTO public.vendor_proposals
       (vendor_profile_id, event_id, title, status, includes_setnayan_gift, resolved_at, total_centavos)
     VALUES ($1, $2, 'Quote', $3, $4, $5, 5000000)
     RETURNING proposal_id`,
    [vendorProfileId, eventId, status, giftSwitch, resolvedAt],
  );
}

const offeredOn = (eventVendorId: string) =>
  one<boolean>('SELECT public.setnayan_gift_offered_on($1)', [eventVendorId]);

test('0 · the column exists, is nullable, and has NO default — an existing quote says nothing', async () => {
  const col = await db.query<{ is_nullable: string; column_default: string | null; data_type: string }>(
    `SELECT is_nullable, column_default, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_proposals' AND column_name = 'includes_setnayan_gift'`,
  );
  assert.equal(col.rows.length, 1, 'vendor_proposals.includes_setnayan_gift exists');
  assert.equal(col.rows[0]!.is_nullable, 'YES');
  assert.equal(col.rows[0]!.column_default, null, 'no default — a decision nobody made must not be recorded');
  assert.equal(col.rows[0]!.data_type, 'boolean');
});

test('1 · the ACCEPTED quote\'s switch WINS over the card — on over off, off over on', async () => {
  const a = await seedBooking(false);
  assert.equal(await offeredOn(a.eventVendorId), false, 'card off, no quote ⇒ off');
  await seedQuote(a.eventId, a.vendorProfileId, 'accepted', true);
  assert.equal(await offeredOn(a.eventVendorId), true, 'the accepted quote says ON ⇒ on, although the card says off');

  const b = await seedBooking(true);
  assert.equal(await offeredOn(b.eventVendorId), true, 'card on, no quote ⇒ on');
  await seedQuote(b.eventId, b.vendorProfileId, 'accepted', false);
  assert.equal(await offeredOn(b.eventVendorId), false, 'the accepted quote says OFF ⇒ off, although the card says on');
  // sabotage: COALESCE(card, quote) → RED here
});

test('2 · NULL on the quote says nothing — the card decides', async () => {
  const on = await seedBooking(true);
  await seedQuote(on.eventId, on.vendorProfileId, 'accepted', null);
  assert.equal(await offeredOn(on.eventVendorId), true, 'quote NULL, card on ⇒ on');
  const off = await seedBooking(false);
  await seedQuote(off.eventId, off.vendorProfileId, 'accepted', null);
  assert.equal(await offeredOn(off.eventVendorId), false, 'quote NULL, card off ⇒ off');
});

test('3 · a quote that is only SENT does not switch anything — the bill follows what the couple accepted', async () => {
  const s = await seedBooking(false);
  await seedQuote(s.eventId, s.vendorProfileId, 'sent', true);
  assert.equal(await offeredOn(s.eventVendorId), false, 'sent, not accepted ⇒ the card still decides');
});

test('4 · 🔒 ANOTHER SUPPLIER\'S accepted quote on the same event cannot switch THIS booking', async () => {
  const mine = await seedBooking(false);
  // a stranger's shop, quoting the same couple, switch ON, accepted
  const strangerId = await one<string>(
    `INSERT INTO public.vendor_profiles (business_name) VALUES ('Stranger') RETURNING vendor_profile_id`,
  );
  await seedQuote(mine.eventId, strangerId, 'accepted', true);
  assert.equal(await offeredOn(mine.eventVendorId), false, 'a stranger\'s quote must not bill this shop for a gift it never gave');
  // sabotage: drop `AND vp.vendor_profile_id = ev.marketplace_vendor_id` → RED
});

test('5 · the NEWEST accepted quote decides when there are several', async () => {
  const b = await seedBooking(false);
  await seedQuote(b.eventId, b.vendorProfileId, 'accepted', true, '2026-09-01T00:00:00Z');
  await seedQuote(b.eventId, b.vendorProfileId, 'accepted', false, '2026-09-20T00:00:00Z');
  assert.equal(await offeredOn(b.eventVendorId), false, 'the later acceptance is the live answer');
});

test('6 · the BILL sizes the gift from the same answer — a switched-on quote on a card that says no', async () => {
  const b = await seedBooking(false);
  await seedQuote(b.eventId, b.vendorProfileId, 'accepted', true);
  const ledgerId = await one<string>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id) VALUES ($1, $2) RETURNING ledger_id`,
    [b.eventId, b.vendorProfileId],
  );
  const FEE_ON_50K = 250_000; // ₱2,500 on a ₱50,000 booking (5%)
  const chargeId = await one<string>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id, kind, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     VALUES ($1, $2, $3, $4, 'primary', 'lock', 'pending', 5000000, $5, $5, 'test')
     RETURNING charge_id`,
    [ledgerId, b.eventId, b.vendorProfileId, b.eventVendorId, FEE_ON_50K],
  );
  const row = await db.query<{ offered: boolean; credits: number; centavos: string | number }>(
    `SELECT setnayan_gift_offered AS offered, gift_credits AS credits, gift_centavos AS centavos
       FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chargeId],
  );
  assert.equal(row.rows[0]!.offered, true, 'the charge snapshot read the quote\'s switch');
  assert.ok(Number(row.rows[0]!.credits) > 0, 'and the gift was sized on the fee');
  // 40% of ₱2,500 = ₱1,000 → the ladder's 1,000-credit rung at ₱700 is below; between rungs
  assert.equal(Number(row.rows[0]!.centavos), Math.floor((FEE_ON_50K * 40) / 100), 'the charge is 40% of the fee');

  // and the mirror: card ON, accepted quote OFF ⇒ the bill carries NO gift
  const c = await seedBooking(true);
  await seedQuote(c.eventId, c.vendorProfileId, 'accepted', false);
  const ledger2 = await one<string>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id) VALUES ($1, $2) RETURNING ledger_id`,
    [c.eventId, c.vendorProfileId],
  );
  const charge2 = await one<string>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id, kind, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     VALUES ($1, $2, $3, $4, 'primary', 'lock', 'pending', 5000000, $5, $5, 'test')
     RETURNING charge_id`,
    [ledger2, c.eventId, c.vendorProfileId, c.eventVendorId, FEE_ON_50K],
  );
  const row2 = await db.query<{ offered: boolean; credits: number }>(
    `SELECT setnayan_gift_offered AS offered, gift_credits AS credits FROM public.booking_fee_charges WHERE charge_id = $1`,
    [charge2],
  );
  assert.equal(row2.rows[0]!.offered, false);
  assert.equal(Number(row2.rows[0]!.credits), 0);
});

test('7 · the quote\'s question (setnayan_gift_quote_applies) gives the same answer as the bill', async () => {
  const b = await seedBooking(false);
  await seedQuote(b.eventId, b.vendorProfileId, 'accepted', true);
  const arm = await one<string>('SELECT public.setnayan_gift_quote_applies($1, $2)', [b.eventId, b.vendorProfileId]);
  assert.notEqual(arm, 'card_says_no', 'with the accepted quote switched on, the card\'s "no" no longer answers');
});
