/**
 * A CHANGE AFTER THE LOCK KEEPS BOTH NUMBERS — proved against the replayed
 * database, not read back from the migration.
 *
 * Owner, 2026-09-09, asked whether a price change after a lock should REPLACE
 * the agreed total or sit BESIDE it: **"Both, shown separately."** A price
 * change reaches a booked supplier two ways, and both must now keep the agreed
 * total and put the change beside it:
 *
 *   1 · A CHANGE ORDER the counterparty accepts (`accept_change_order`).
 *   2 · A NEW DEAL locked in chat on an already-booked supplier
 *       (`record_agreed_price_change`, called by `bookVendorAtChatLock`'s
 *       'refresh_fee_only' branch). Until 2026-09-11 this OVERWROTE
 *       `total_cost_php` — the ₱100,000 they locked at was simply gone.
 *
 * And three things that make it safe to leave in a couple's hands:
 *
 *   3 · Only the SERVER authors a change line. The couple's own breakdown is
 *       untouched, but a browser session cannot create, re-flag, edit or delete
 *       a line headed "Changes you both agreed".
 *   4 · A browser session cannot call the Deal recorder with a number of its
 *       own choosing.
 *   5 · The booking fee follows the AGREED total (changes included) — the
 *       2026-09-09 ruling "the fee base moves with the price" — both when it is
 *       first charged and when a charged fee is re-derived.
 *
 * The worked example is the owner's: ₱100,000 agreed, then −₱15,000.
 *
 * 🔑 Refusals by the guard are asserted as THROWS (the trigger raising is the
 * mechanism); landings are asserted as ROW COUNTS measured as the owner, never
 * from `RETURNING`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import {
  agreedTotalNow,
  resolveAgreedTotal,
  splitVendorLines,
  sumAmountPhp,
} from '../../lib/agreed-total-and-its-changes';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function reset() {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asUser(uid: string) {
  await reset();
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function newVendor(email: string): Promise<string> {
  const uid = await createUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Both Numbers Band', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid],
  );
  return v.rows[0]!.vendor_profile_id;
}

type World = { couple: string; eventId: string; vpid: string; evId: string };

/** A couple, their event, and a supplier BOOKED at ₱100,000 through the marketplace. */
async function bookedAt(tag: string, totalPhp: number | null, vpid?: string): Promise<World> {
  await reset();
  const couple = await createUser(`both-couple-${tag}@example.com`);
  const vendorProfileId = vpid ?? (await newVendor(`both-shop-${tag}@example.com`));
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`both-${tag}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, couple],
  );
  // A marketplace client who came through Explore and messaged (so the fee is
  // Setnayan-sourced, as a real chat lock is).
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
     VALUES ($1, $2, 'explore')`,
    [eventId, vendorProfileId],
  );
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Both Numbers Band', 'contracted', $2, $3)
     RETURNING vendor_id`,
    [eventId, totalPhp, vendorProfileId],
  );
  return { couple, eventId, vpid: vendorProfileId, evId: ev.rows[0]!.vendor_id };
}

type Line = { line_item_id: string; label: string; amount_php: string; is_change_delta: boolean };

/** Everything on this supplier, read as the OWNER so RLS cannot hide a row. */
async function stateOf(evId: string): Promise<{ headline: number | null; lines: Line[] }> {
  await reset();
  const h = await db.query<{ total_cost_php: string | null }>(
    `SELECT total_cost_php FROM public.event_vendors WHERE vendor_id = $1`,
    [evId],
  );
  const l = await db.query<Line>(
    `SELECT line_item_id, label, amount_php::text, is_change_delta
       FROM public.event_vendor_line_items WHERE vendor_id = $1 ORDER BY created_at, line_item_id`,
    [evId],
  );
  const raw = h.rows[0]?.total_cost_php;
  return { headline: raw == null ? null : Number(raw), lines: l.rows };
}

/** The agreed total the couple's budget prints — through the SHARED rule. */
function agreedOf(s: { headline: number | null; lines: Line[] }) {
  const { breakdown, changes } = splitVendorLines(s.lines);
  return resolveAgreedTotal({
    headline: s.headline ?? 0,
    catalogue: 0,
    breakdown: sumAmountPhp(breakdown),
    changes: sumAmountPhp(changes),
  });
}

async function recordDeal(w: World, newTotalPhp: number): Promise<{ status: string; delta_php?: string }> {
  await reset();
  const r = await db.query<{ r: { status: string; delta_php?: string } }>(
    `SELECT public.record_agreed_price_change($1, $2, $3) AS r`,
    [w.eventId, w.evId, newTotalPhp],
  );
  return r.rows[0]!.r;
}

// ───────────────────────────────────────────────────────────────────────────
// 1 · A CHANGE ORDER
// ───────────────────────────────────────────────────────────────────────────

test('a change order: ₱100,000 agreed, −₱15,000 accepted → ₱100,000 stays, −₱15,000 beside it, ₱85,000 agreed', async () => {
  const w = await bookedAt('co', 100_000);
  await reset();
  const co = await db.query<{ change_order_id: string }>(
    `INSERT INTO public.vendor_change_orders
       (event_vendor_id, event_id, vendor_profile_id, raised_by, title, delta_amount_php)
     VALUES ($1, $2, $3, 'vendor', 'One fewer set', -15000)
     RETURNING change_order_id`,
    [w.evId, w.eventId, w.vpid],
  );
  // Vendor-raised → the COUPLE accepts, through their own session.
  await asUser(w.couple);
  await db.query(`SELECT public.accept_change_order($1)`, [co.rows[0]!.change_order_id]);

  const s = await stateOf(w.evId);
  assert.equal(s.headline, 100_000, 'the agreed total was overwritten — it must stay beside the change');
  const changes = s.lines.filter((l) => l.is_change_delta);
  assert.equal(changes.length, 1, 'the change is not its own line');
  assert.equal(Number(changes[0]!.amount_php), -15_000);
  const a = agreedOf(s);
  assert.equal(a.agreed, 85_000, 'the budget does not add the change to the agreed total');
  assert.equal(a.basePart, 100_000, 'the agreed total before the change is not ₱100,000');
  assert.equal(a.changesPart, -15_000);
  assert.ok(a.agreed >= 0, 'a price cut became a negative bill');
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · A NEW DEAL AFTER THE LOCK
// ───────────────────────────────────────────────────────────────────────────

test('a new deal after the lock: ₱100,000 stays, the −₱15,000 is its own line, ₱85,000 agreed', async () => {
  const w = await bookedAt('deal', 100_000);

  const r = await recordDeal(w, 85_000);
  assert.equal(r.status, 'changed');

  const s = await stateOf(w.evId);
  assert.equal(
    s.headline,
    100_000,
    'the post-lock Deal OVERWROTE the agreed total again (the #5355 shape). Owner 2026-09-09: "Both, shown separately".',
  );
  const changes = s.lines.filter((l) => l.is_change_delta);
  assert.equal(changes.length, 1);
  assert.equal(Number(changes[0]!.amount_php), -15_000);
  assert.match(changes[0]!.label, /lowered/, 'a price cut is labelled as a raise');
  assert.equal(agreedOf(s).agreed, 85_000);
});

test('pressing the same deal again records nothing — idempotent by arithmetic', async () => {
  const w = await bookedAt('again', 100_000);
  await recordDeal(w, 85_000);
  const second = await recordDeal(w, 85_000);
  assert.equal(second.status, 'unchanged');
  const s = await stateOf(w.evId);
  assert.equal(s.lines.filter((l) => l.is_change_delta).length, 1, 'a repeat press doubled the change');
  assert.equal(agreedOf(s).agreed, 85_000);
});

test('a deal after a deal lands the agreed total ON the new number, never on top of old changes', async () => {
  const w = await bookedAt('twice', 100_000);
  await recordDeal(w, 85_000);
  const r = await recordDeal(w, 90_000);
  assert.equal(r.status, 'changed');
  assert.equal(Number(r.delta_php), 5_000, 'the second change was measured against the stale ₱100,000');
  const s = await stateOf(w.evId);
  assert.equal(s.headline, 100_000);
  assert.deepEqual(
    s.lines.filter((l) => l.is_change_delta).map((l) => Number(l.amount_php)),
    [-15_000, 5_000],
  );
  assert.equal(agreedOf(s).agreed, 90_000);
});

test('a deal after a change order is measured against the price AFTER that change', async () => {
  const w = await bookedAt('mixed', 100_000);
  await reset();
  const co = await db.query<{ change_order_id: string }>(
    `INSERT INTO public.vendor_change_orders
       (event_vendor_id, event_id, vendor_profile_id, raised_by, title, delta_amount_php)
     VALUES ($1, $2, $3, 'vendor', 'One fewer set', -15000) RETURNING change_order_id`,
    [w.evId, w.eventId, w.vpid],
  );
  await asUser(w.couple);
  await db.query(`SELECT public.accept_change_order($1)`, [co.rows[0]!.change_order_id]);

  const r = await recordDeal(w, 90_000);
  assert.equal(Number(r.delta_php), 5_000);
  assert.equal(agreedOf(await stateOf(w.evId)).agreed, 90_000);
});

test('a booking with no agreed total yet is PRICED by the deal, not handed a "change" from zero', async () => {
  const w = await bookedAt('unpriced', null);
  const r = await recordDeal(w, 85_000);
  assert.equal(r.status, 'priced');
  const s = await stateOf(w.evId);
  assert.equal(s.headline, 85_000);
  assert.equal(s.lines.length, 0, 'the whole price was recorded as a change on top of nothing');
});

test('the deal recorder refuses a negative total and finds nothing on another event', async () => {
  const w = await bookedAt('bounds', 100_000);
  await reset();
  await assert.rejects(
    () => db.query(`SELECT public.record_agreed_price_change($1, $2, -1)`, [w.eventId, w.evId]),
    /invalid_agreed_total/,
  );
  const other = await bookedAt('bounds-other', 50_000);
  // The right booking id with the WRONG event must not match.
  const r = await db.query<{ r: { status: string } }>(
    `SELECT public.record_agreed_price_change($1, $2, 1) AS r`,
    [other.eventId, w.evId],
  );
  assert.equal(r.rows[0]!.r.status, 'not_found');
  assert.equal((await stateOf(w.evId)).lines.length, 0);
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · ONLY THE SERVER AUTHORS A CHANGE LINE
// ───────────────────────────────────────────────────────────────────────────

test('the couple keeps their own breakdown lines — and cannot author, re-flag, edit or delete a change', async () => {
  const w = await bookedAt('guard', 100_000);
  await recordDeal(w, 85_000);
  const changeId = (await stateOf(w.evId)).lines.find((l) => l.is_change_delta)!.line_item_id;

  // Their own breakdown line: still theirs, exactly as before.
  await asUser(w.couple);
  await db.query(
    `INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php)
     VALUES ($1, $2, 'Deposit', 50000)`,
    [w.eventId, w.evId],
  );
  await reset();
  const own = (await stateOf(w.evId)).lines.find((l) => !l.is_change_delta)!;
  assert.equal(own.label, 'Deposit', 'the couple can no longer add their own line');

  const refused = async (sql: string, params: unknown[], why: string) => {
    await asUser(w.couple);
    try {
      await assert.rejects(() => db.query(sql, params), /change_line_is_server_authored/, why);
    } finally {
      await reset();
    }
  };

  await refused(
    `INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, is_change_delta)
     VALUES ($1, $2, 'Change order: forged', -99000, TRUE)`,
    [w.eventId, w.evId],
    'a browser session authored a line headed "Changes you both agreed"',
  );
  await refused(
    `UPDATE public.event_vendor_line_items SET is_change_delta = TRUE WHERE line_item_id = $1`,
    [own.line_item_id],
    'a breakdown line was re-flagged into an agreed change (it would ride ON TOP of the price)',
  );
  await refused(
    `UPDATE public.event_vendor_line_items SET amount_php = -99000 WHERE line_item_id = $1`,
    [changeId],
    'the amount of a change both sides agreed was edited by one side',
  );
  await refused(
    `DELETE FROM public.event_vendor_line_items WHERE line_item_id = $1`,
    [changeId],
    'a change both sides agreed was deleted by one side',
  );

  const after = await stateOf(w.evId);
  const change = after.lines.find((l) => l.line_item_id === changeId)!;
  assert.equal(Number(change.amount_php), -15_000, 'a refused write still moved the change');
  assert.equal(after.lines.filter((l) => l.is_change_delta).length, 1);

  // …and deleting their OWN line still works.
  await asUser(w.couple);
  await db.query(`DELETE FROM public.event_vendor_line_items WHERE line_item_id = $1`, [own.line_item_id]);
  await reset();
  assert.equal((await stateOf(w.evId)).lines.length, 1, 'the couple can no longer delete their own line');
});

test('removing the supplier still removes its change lines (the cascade runs as the owner)', async () => {
  const w = await bookedAt('cascade', 100_000);
  await recordDeal(w, 85_000);
  // Take the booking back to 'considering' as the owner so no booking-state
  // guard is what this measures — only the line guard on the cascade.
  await reset();
  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`, [w.evId]);
  await asUser(w.couple);
  await db.query(`DELETE FROM public.event_vendors WHERE vendor_id = $1`, [w.evId]);
  await reset();
  const n = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.event_vendor_line_items WHERE vendor_id = $1`,
    [w.evId],
  );
  const ev = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.event_vendors WHERE vendor_id = $1`,
    [w.evId],
  );
  assert.equal(ev.rows[0]!.n, 0, 'the couple could not remove the supplier at all — re-anchor this test');
  assert.equal(n.rows[0]!.n, 0, 'the guard blocked the cascade — removing a supplier now fails');
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · A BROWSER CANNOT CALL THE DEAL RECORDER
// ───────────────────────────────────────────────────────────────────────────

test('a browser session cannot call record_agreed_price_change', async () => {
  const w = await bookedAt('rpc', 100_000);
  await asUser(w.couple);
  try {
    await assert.rejects(
      () =>
        db.query(`SELECT public.record_agreed_price_change($1, $2, 1)`, [w.eventId, w.evId]),
      /permission denied/,
      'the couple can record an "agreed" change of their own choosing',
    );
  } finally {
    await reset();
  }
  assert.equal((await stateOf(w.evId)).lines.length, 0);
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · THE FEE FOLLOWS THE AGREED TOTAL
// ───────────────────────────────────────────────────────────────────────────

/** Five earlier bookings for the shop, so the next one is billable. */
async function warmPastFree5(vpid: string, tag: string) {
  for (let i = 1; i <= 5; i++) {
    const w = await bookedAt(`${tag}-warm-${i}`, 10_000, vpid);
    await reset();
    await db.query(`SELECT public.booking_fee_open_lock_charge($1)`, [w.evId]);
  }
}

test('the fee is charged on the agreed total AFTER a change, not on the pre-change price', async () => {
  const w = await bookedAt('fee-open', 100_000);
  await recordDeal(w, 85_000);
  await reset();
  const r = await db.query<{ r: { charge_id: string } }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS r`,
    [w.evId],
  );
  const base = await db.query<{ c: string }>(
    `SELECT proposal_amount_centavos::text AS c FROM public.booking_fee_charges WHERE charge_id = $1`,
    [r.rows[0]!.r.charge_id],
  );
  assert.equal(
    Number(base.rows[0]!.c),
    8_500_000,
    'the fee base is the pre-change ₱100,000 — the 2026-09-09 ruling "the fee base moves with the price" broke',
  );
});

test('a change after the fee was charged re-derives it, as a price move always did', async () => {
  const vpid = await newVendor('both-fee-rederive@example.com');
  await warmPastFree5(vpid, 'rederive');
  const w = await bookedAt('fee-rederive', 100_000, vpid);
  await reset();
  const opened = await db.query<{ r: { charge_id: string; amount_charged_centavos: number; is_free: boolean } }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS r`,
    [w.evId],
  );
  const charge = opened.rows[0]!.r;
  assert.equal(charge.is_free, false, 'the sixth booking should be billable — re-anchor the warm-up');
  assert.equal(charge.amount_charged_centavos, 500_000, '5% of ₱100,000');

  await recordDeal(w, 85_000);

  await reset();
  const after = await db.query<{ a: number; p: string }>(
    `SELECT amount_charged_centavos::int AS a, proposal_amount_centavos::text AS p
       FROM public.booking_fee_charges WHERE charge_id = $1`,
    [charge.charge_id],
  );
  assert.equal(
    Number(after.rows[0]!.p),
    8_500_000,
    'the pending fee still reads the pre-change price — the change line never reached the re-derive',
  );
  assert.equal(after.rows[0]!.a, 425_000, '5% of ₱85,000');
  const count = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.booking_fee_charges WHERE event_vendor_id = $1`,
    [w.evId],
  );
  assert.equal(count.rows[0]!.n, 1, 'a change minted a second charge instead of re-deriving the one');
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · ONE PRICE EVERYWHERE (owner 2026-09-11, "Show the total now")
// ───────────────────────────────────────────────────────────────────────────
//
// Every screen other than the budget card and the per-supplier page shows ONE
// number: the agreed total NOW. In the app that is `agreedTotalNow`; on the
// supplier's My Performance page it is four SQL readers, re-signed by
// 20271221806689. Both are proved here on the owner's worked example, on a
// real booking, after a real post-lock Deal.

test('the one-number screens read ₱85,000 — the same number the budget card ends on', async () => {
  const w = await bookedAt('one-price', 100_000);
  await recordDeal(w, 85_000);
  const s = await stateOf(w.evId);
  // What the embed hands a screen: the headline and the booking's line items.
  assert.equal(
    agreedTotalNow(s.headline, s.lines),
    85_000,
    'a one-number screen still prints the price the lock wrote',
  );
  assert.equal(agreedTotalNow(s.headline, s.lines), agreedOf(s).agreed, 'two rules, two numbers');
});

test('the supplier\'s own figures read the agreed total now, not the lock-time price', async () => {
  const w = await bookedAt('perf', 100_000);
  await recordDeal(w, 85_000);
  await reset();
  const owner = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [w.vpid],
  );
  // AS THE SUPPLIER: every one of these is ownership-gated and raises for anyone else.
  await asUser(owner.rows[0]!.user_id);
  const monthly = await db.query<{ n: number; rev: string }>(
    `SELECT COALESCE(SUM(booking_count), 0)::int AS n, COALESCE(SUM(revenue_php), 0)::text AS rev
       FROM public.vendor_booking_monthly_series($1)`,
    [w.vpid],
  );
  const daily = await db.query<{ n: number; rev: string }>(
    `SELECT COALESCE(SUM(booking_count), 0)::int AS n, COALESCE(SUM(revenue_php), 0)::text AS rev
       FROM public.vendor_booking_daily_series($1)`,
    [w.vpid],
  );
  const bySource = await db.query<{ priced: number; rev: string }>(
    `SELECT COALESCE(SUM(priced_count), 0)::int AS priced, COALESCE(SUM(revenue_php), 0)::text AS rev
       FROM public.vendor_source_attribution($1)`,
    [w.vpid],
  );
  const deals = await db.query<{ n: number; avg: string; total: string }>(
    `SELECT booked_priced_count AS n, avg_contract_php::text AS avg, total_contract_php::text AS total
       FROM public.vendor_deal_size($1)`,
    [w.vpid],
  );
  await reset();

  assert.equal(monthly.rows[0]!.n, 1, 'the booking fell out of the monthly series');
  assert.equal(Number(monthly.rows[0]!.rev), 85_000, 'monthly revenue is the lock-time ₱100,000');
  assert.equal(daily.rows[0]!.n, 1, 'the booking fell out of the daily series');
  assert.equal(Number(daily.rows[0]!.rev), 85_000, 'daily revenue is the lock-time ₱100,000');
  assert.equal(bySource.rows[0]!.priced, 1, 'a priced booking stopped counting as priced');
  assert.equal(Number(bySource.rows[0]!.rev), 85_000, 'revenue by source is the lock-time ₱100,000');
  assert.equal(deals.rows[0]!.n, 1);
  assert.equal(Number(deals.rows[0]!.avg), 85_000, 'average deal size is the lock-time ₱100,000');
  assert.equal(Number(deals.rows[0]!.total), 85_000, 'total contracted is the lock-time ₱100,000');
});

test('a booking with no price stays unpriced on the supplier\'s figures', async () => {
  const w = await bookedAt('perf-unpriced', null);
  await reset();
  const owner = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [w.vpid],
  );
  await asUser(owner.rows[0]!.user_id);
  const deals = await db.query<{ n: number; total: string }>(
    `SELECT booked_priced_count AS n, total_contract_php::text AS total
       FROM public.vendor_deal_size($1)`,
    [w.vpid],
  );
  const bySource = await db.query<{ booked: number; priced: number }>(
    `SELECT COALESCE(SUM(booking_count), 0)::int AS booked, COALESCE(SUM(priced_count), 0)::int AS priced
       FROM public.vendor_source_attribution($1)`,
    [w.vpid],
  );
  await reset();
  assert.equal(deals.rows[0]!.n, 0, 'an unpriced booking was counted as priced');
  assert.equal(Number(deals.rows[0]!.total), 0);
  assert.equal(bySource.rows[0]!.booked, 1);
  assert.equal(bySource.rows[0]!.priced, 0, 'an unpriced booking was counted as priced');
});
