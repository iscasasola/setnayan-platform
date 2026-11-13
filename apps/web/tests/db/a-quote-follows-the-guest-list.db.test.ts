/**
 * 👥💸 A QUOTE FOLLOWS THE GUEST LIST — Piece 1 · PR-2, migration 20271339826198 (DECISION_LOG 2026-11-12).
 *
 * Against the replayed migrations, the guest list (not a typed number) moves a standing, not-yet-booked quote:
 *   · SQL and the TS mirror (`lib/quote-pax-follow.ts`) give the same lines, total and plan — to the centavo;
 *   · an UNLOCKED quote falls back as guests leave (20271340566104), never below the Bill-at-least minimum or what was
 *     sent; a LOCKED one never falls; a drop comes off unpaid auto rows only, capped at what is unsettled;
 *   · paid rows never change — the rise lands on the auto Final balance (a paid auto row → a new one takes it);
 *   · a supplier's `changes_locked` quotation STILL rises; a BOOKED deal rises like it and never falls (Piece 2);
 *   · each service counts its own guests ("Not counted for ▾"), and a kids meal never ticks anything by itself;
 *   · an accepted quote's `event_vendors.total_cost_php` follows, and the added-guest surcharge can no longer stack;
 *   · one chat line, "Quote rose to N pax · +₱X", in the (event, shop) conversation both sides read.
 *
 * Run (from apps/web): tsx --test tests/db/a-quote-follows-the-guest-list.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { followGuestCount, quoteFallWords, quoteRiseWords, type FollowLine, type FollowSchedule } from '../../lib/quote-pax-follow';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

let seq = 0;
const uniq = () => `pax-${++seq}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

type World = { eventId: string; host: string; shop: string; threadId: string; vendorId: string };

async function newWorld(): Promise<World> {
  const host = await newUser();
  const supplier = await newUser();
  const shop = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
      [supplier, `Kitchen ${uniq()}`],
    )
  ).rows[0]!.vendor_profile_id;
  const eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A celebration', 'birthday', DATE '2027-12-12', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, host]);
  const threadId = (
    await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
      [eventId, shop, host],
    )
  ).rows[0]!.thread_id;
  // A per-head service card, so "Not counted for ▾" may tick this booking.
  const card = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, pricing_basis, per_pax_price_php, min_pax, is_active)
       VALUES ($1, 'catering', 650, 'per_pax', 650, 1, FALSE) RETURNING vendor_service_id AS s`,
      [shop],
    )
  ).rows[0]!.s;
  const vendorId = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       VALUES ($1, 'catering'::public.vendor_category, 'The Kitchen', 'considering', $2, $3) RETURNING vendor_id`,
      [eventId, shop, card],
    )
  ).rows[0]!.vendor_id;
  return { eventId, host, shop, threadId, vendorId };
}

async function addGuests(w: World, n: number, rsvp = 'attending', meal: string | null = null): Promise<string[]> {
  if (n <= 0) return [];
  const r = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status, meal_preference)
     SELECT $1, 'Guest ' || i, 'Cruz', 'both', 'friends', $3::public.rsvp_status, $4::public.meal_preference
       FROM generate_series(1, $2::int) AS i
     RETURNING guest_id`,
    [w.eventId, n, rsvp, meal],
  );
  return r.rows.map((x) => x.guest_id);
}

const RATE = 65_000; // ₱650 a head — the quote's OWN line data, never a card's
const COCKTAIL = 1_620_000;

type Built = { lines: FollowLine[]; total: number; schedule: FollowSchedule; minPax: number; billedPax: number };

/** A quote as the quote maker (PR-1) writes it: per-head lines carry basis + rate; min and billed in merge_snapshot. */
function build(opts: { rate?: number; billed?: number; minPax?: number; firstPct?: number; extraPerPax?: number } = {}): Built {
  const rate = opts.rate ?? RATE;
  const billed = opts.billed ?? 100;
  const lines: FollowLine[] = [
    { label: 'Garden buffet', detail: `${billed} pax`, amount_centavos: rate * billed, basis: 'per_pax', rate_centavos: rate },
    { label: 'Cocktail hour', detail: null, amount_centavos: COCKTAIL, basis: 'flat' },
  ];
  if (opts.extraPerPax) {
    lines.push({ label: 'Giveaways', detail: null, amount_centavos: opts.extraPerPax * billed, basis: 'per_pax', rate_centavos: opts.extraPerPax });
  }
  const total = lines.reduce((s, l) => s + (l.amount_centavos ?? 0), 0);
  const first = Math.round((total * (opts.firstPct ?? 20)) / 100);
  const schedule: FollowSchedule = {
    version: 1,
    base_centavos: total,
    credit_centavos: 0,
    total_centavos: total,
    balances: true,
    over_by_centavos: 0,
    credit_over_centavos: 0,
    installments: [
      { seq: 0, label: 'First payment', kind: 'percent', amount_centavos: first, raw_centavos: first, percent_bps: (opts.firstPct ?? 20) * 100, due: 'on_lock', offset_days: 0, is_downpayment: true, is_auto_balance: false, credit_applied_centavos: 0 },
      { seq: 1, label: 'Final balance', kind: 'auto', amount_centavos: total - first, raw_centavos: total - first, percent_bps: null, due: 'before_event', offset_days: 14, is_downpayment: false, is_auto_balance: true, credit_applied_centavos: 0 },
    ],
  };
  return { lines, total, schedule, minPax: opts.minPax ?? 100, billedPax: billed };
}

async function quote(w: World, b: Built, status = 'sent', extra: { locked?: boolean; snapshot?: object } = {}): Promise<string> {
  const r = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals
       (event_id, vendor_profile_id, title, status, total_centavos, sent_at, line_items, merge_snapshot, valid_until, payment_schedule, resolved_at)
     VALUES ($1, $2, 'Garden reception', $3, $4, NOW(), $5::jsonb, $6::jsonb, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7, $7::jsonb,
             CASE WHEN $3 = 'accepted' THEN NOW() ELSE NULL END)
     RETURNING proposal_id`,
    [
      w.eventId,
      w.shop,
      status,
      b.total,
      JSON.stringify(b.lines),
      JSON.stringify(extra.snapshot ?? { source: 'proposal_maker', min_pax: b.minPax, billed_pax: b.billedPax }),
      JSON.stringify(b.schedule),
    ],
  );
  const id = r.rows[0]!.proposal_id;
  if (extra.locked) await db.query(`UPDATE public.vendor_proposals SET changes_locked = TRUE WHERE proposal_id = $1`, [id]);
  return id;
}

type Row = { total_centavos: string; line_items: FollowLine[]; payment_schedule: FollowSchedule; merge_snapshot: Record<string, unknown>; status: string };
const read = async (id: string) =>
  (await db.query<Row>(`SELECT total_centavos::text, line_items, payment_schedule, merge_snapshot, status FROM public.vendor_proposals WHERE proposal_id = $1`, [id])).rows[0]!;
const lines = async (w: World) =>
  (await db.query<{ body: string }>(`SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role = 'system' ORDER BY created_at`, [w.threadId])).rows.map((r) => r.body);
const rises = async (w: World) => (await lines(w)).filter((b) => b.startsWith('Quote rose to '));
const falls = async (w: World) => (await lines(w)).filter((b) => b.startsWith('Quote fell to '));
const count = async (w: World) => (await db.query<{ n: number }>(`SELECT public.quote_guest_count($1, $2) AS n`, [w.eventId, w.vendorId])).rows[0]!.n;

test('👥 the list grows past the quote → it rises by itself: per-head lines only, rise on the Final balance, one chat line', async () => {
  const w = await newWorld();
  const b = build();
  const p = await quote(w, b);
  await addGuests(w, 100);
  assert.equal(Number((await read(p)).total_centavos), b.total, 'at the billed count nothing moves');
  assert.deepEqual(await rises(w), []);

  await addGuests(w, 20);
  const r = await read(p);
  const delta = 20 * RATE;
  assert.equal(Number(r.total_centavos), b.total + delta);
  assert.equal(r.line_items[0]!.amount_centavos, 120 * RATE);
  assert.equal(r.line_items[0]!.detail, '120 pax × ₱650');
  assert.equal(r.line_items[1]!.amount_centavos, COCKTAIL, 'a flat line never moves');
  const [first, fin] = r.payment_schedule.installments!;
  assert.equal(first!.amount_centavos, b.schedule.installments![0]!.amount_centavos, 'the first payment stays put');
  assert.equal(fin!.amount_centavos, b.schedule.installments![1]!.amount_centavos + delta, 'the Final balance takes the rise');
  const sum = r.payment_schedule.installments!.reduce((s, i) => s + i.amount_centavos, 0);
  assert.equal(sum, Number(r.total_centavos), 'the plan still pays the whole quote');
  assert.equal(r.merge_snapshot.billed_pax, 120);
  assert.equal(r.merge_snapshot.sent_total_centavos, b.total, 'what was sent is remembered');
  assert.equal(r.status, 'sent', 'the SAME row — never a new version');
  assert.deepEqual(await rises(w), [quoteRiseWords(120, delta)]);
  assert.deepEqual(await rises(w), ['Quote rose to 120 pax · +₱13,000']);
  const versions = await db.query(`SELECT 1 FROM public.vendor_proposals WHERE event_id = $1`, [w.eventId]);
  assert.equal(versions.rows.length, 1);
});

test('⚖ SQL and the TS mirror agree to the centavo — lines, total, plan, billed pax, words', async () => {
  const cases = [
    { rate: 65_000, billed: 100, minPax: 100, guests: 137 },
    { rate: 12_345, billed: 80, minPax: 120, guests: 90 }, // below the minimum → billed at the minimum
    { rate: 99_999, billed: 150, minPax: 50, guests: 151, firstPct: 35 },
    { rate: 50_050, billed: 10, minPax: 0, guests: 33, extraPerPax: 4_500 },
    { rate: 1, billed: 1, minPax: 0, guests: 2, firstPct: 0 },
    { rate: 70_000, billed: 200, minPax: 100, guests: 150 }, // fewer than quoted → nothing
  ];
  for (const c of cases) {
    const w = await newWorld();
    const b = build(c);
    const p = await quote(w, b);
    await addGuests(w, c.guests);
    const ts = followGuestCount(
      { lines: b.lines, totalCentavos: b.total, schedule: b.schedule, minPax: b.minPax, billedPax: b.billedPax, booked: false },
      c.guests,
    );
    const r = await read(p);
    if (!ts.rose) {
      assert.equal(Number(r.total_centavos), b.total, JSON.stringify(c));
      assert.deepEqual(await rises(w), []);
      continue;
    }
    assert.equal(Number(r.total_centavos), ts.totalCentavos, JSON.stringify(c));
    assert.deepEqual(r.line_items, JSON.parse(JSON.stringify(ts.lines)), JSON.stringify(c));
    assert.deepEqual(r.payment_schedule, JSON.parse(JSON.stringify(ts.schedule)), JSON.stringify(c));
    assert.equal(r.merge_snapshot.billed_pax, ts.billedPax);
    assert.deepEqual(await rises(w), [ts.line]);
  }
});

test('⬇ guests leave → an unlocked quote falls back, never below the minimum or what was sent (20271340566104)', async () => {
  const w = await newWorld();
  const b = build({ billed: 150, minPax: 150 });
  const p = await quote(w, b);
  const ids = await addGuests(w, 120); // under the minimum → nothing
  assert.equal(Number((await read(p)).total_centavos), b.total);
  await addGuests(w, 40); // 160 → rises by 10
  const up = Number((await read(p)).total_centavos);
  assert.equal(up, b.total + 10 * RATE);
  await db.query(`UPDATE public.guests SET rsvp_status = 'declined' WHERE guest_id = ANY($1::uuid[])`, [ids.slice(0, 60)]);
  assert.equal(await count(w), 100);
  assert.equal(Number((await read(p)).total_centavos), b.total, 'a shrinking list brings it back to what was sent — no further');
  await db.query(`DELETE FROM public.guests WHERE guest_id = ANY($1::uuid[])`, [ids.slice(60)]);
  assert.equal(Number((await read(p)).total_centavos), b.total);
  assert.equal((await rises(w)).length, 1);
  assert.deepEqual(await falls(w), [quoteFallWords(150, 10 * RATE)]);
});

test('🔒 a supplier’s final (changes_locked) quotation STILL rises; a BOOKED deal rises too (Piece 2)', async () => {
  const locked = await newWorld();
  const pl = await quote(locked, build(), 'sent', { locked: true });
  await addGuests(locked, 110);
  assert.equal(Number((await read(pl)).total_centavos), build().total + 10 * RATE, 'the lock stops asks, never the guest list');

  // SABOTAGE: restore the deal_locked CONTINUE in quote_follow_guest_count → RED.
  const booked = await newWorld();
  const pb = await quote(booked, build(), 'accepted');
  await db.query(`UPDATE public.event_vendors SET status = 'contracted', total_cost_php = $2 WHERE vendor_id = $1`, [booked.vendorId, build().total / 100]);
  await addGuests(booked, 140);
  assert.equal(Number((await read(pb)).total_centavos), build().total + 40 * RATE, 'a booked quote follows the guest list up (Piece 2)');
  const ev = await db.query<{ t: string }>(`SELECT total_cost_php::text AS t FROM public.event_vendors WHERE vendor_id = $1`, [booked.vendorId]);
  assert.equal(Number(ev.rows[0]!.t), (build().total + 40 * RATE) / 100, 'the booking total follows the quote');
  assert.equal((await rises(booked)).length, 1, 'one chat line for the rise');
});

test('🏁 a job already DELIVERED or COMPLETE never moves its booking total (Piece 2 stops at the finished job)', async () => {
  // SABOTAGE: drop the delivered/complete CONTINUE at the top of quote_follow_guest_count's loop → RED (the proposal
  // reprices even though the booking total stays put).
  for (const done of ['delivered', 'complete']) {
    const w = await newWorld();
    const b = build();
    const p = await quote(w, b, 'accepted');
    await db.query(`UPDATE public.event_vendors SET status = $2::public.vendor_status, total_cost_php = $3 WHERE vendor_id = $1`, [w.vendorId, done, b.total / 100]);
    const before = await read(p);
    await addGuests(w, 140);
    const ev = await db.query<{ t: string }>(`SELECT total_cost_php::text AS t FROM public.event_vendors WHERE vendor_id = $1`, [w.vendorId]);
    assert.equal(Number(ev.rows[0]!.t), b.total / 100, `a ${done} job's total moved`);
    const after = await read(p);
    assert.deepEqual(after.line_items, before.line_items, `a ${done} job's quote lines moved`);
    assert.equal(Number(after.total_centavos), b.total, `a ${done} job's quote total moved`);
    const fin = (s: FollowSchedule) => s.installments!.find((i) => i.is_auto_balance);
    assert.deepEqual(fin(after.payment_schedule), fin(before.payment_schedule), `a ${done} job's Final installment moved`);
    assert.deepEqual(after.payment_schedule, before.payment_schedule, `a ${done} job's payment plan moved`);
    assert.equal(after.merge_snapshot.billed_pax, before.merge_snapshot.billed_pax, `a ${done} job's billed pax moved`);
    assert.deepEqual(await rises(w), [], `a ${done} job got a "Quote rose" chat line`);
    assert.deepEqual(await falls(w), [], `a ${done} job got a "Quote fell" chat line`);
  }
});

test('💳 paid rows never change: a paid Final balance → a NEW auto row takes the rise', async () => {
  const w = await newWorld();
  const b = build();
  const p = await quote(w, b, 'accepted');
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, schedule_instance_seq) VALUES ($1, $2, $3, 'GCash', 1)`,
    [w.eventId, w.vendorId, b.schedule.installments![1]!.amount_centavos / 100],
  );
  await addGuests(w, 105);
  const r = await read(p);
  const inst = r.payment_schedule.installments!;
  assert.deepEqual(inst.slice(0, 2), b.schedule.installments, 'the paid rows are byte-for-byte what they were');
  assert.equal(inst.length, 3);
  assert.equal(inst[2]!.seq, 2);
  assert.equal(inst[2]!.is_auto_balance, true);
  assert.equal(inst[2]!.amount_centavos, 5 * RATE);
  const ts = followGuestCount({ lines: b.lines, totalCentavos: b.total, schedule: b.schedule, minPax: 100, billedPax: 100, booked: false }, 105, [1]);
  assert.ok(ts.rose);
  assert.deepEqual(r.payment_schedule, JSON.parse(JSON.stringify(ts.schedule)), 'SQL and TS agree on the paid case too');
});

test('🤝 an accepted quote: event_vendors.total_cost_php follows, and the added-guest surcharge can no longer stack', async () => {
  const w = await newWorld();
  const b = build();
  await quote(w, b, 'accepted');
  await db.query(`UPDATE public.event_vendors SET status = 'shortlisted', total_cost_php = $2 WHERE vendor_id = $1`, [w.vendorId, b.total / 100]);
  await addGuests(w, 110);
  const ev = await db.query<{ t: string; base: number; s: string }>(
    `SELECT total_cost_php::text AS t, pax_quote_base AS base, pax_surcharge_php::text AS s FROM public.event_vendors WHERE vendor_id = $1`,
    [w.vendorId],
  );
  assert.equal(Number(ev.rows[0]!.t), (b.total + 10 * RATE) / 100);
  assert.equal(ev.rows[0]!.base, 110);
  assert.equal(Number(ev.rows[0]!.s), 0);
  await assert.rejects(
    db.query(`UPDATE public.event_vendors SET pax_surcharge_php = 5000 WHERE vendor_id = $1`, [w.vendorId]),
    /PAX_FOLLOWED_BY_QUOTE/,
  );
});

test('🍽 each service counts its own guests: a "Not counted for" tick holds the count; the untick lifts it', async () => {
  const w = await newWorld();
  const p = await quote(w, build());
  const kids = await addGuests(w, 5, 'attending', 'kids');
  for (const g of kids) {
    await db.query(`INSERT INTO public.guest_not_counted_for (guest_id, event_vendor_id) VALUES ($1, $2)`, [g, w.vendorId]);
  }
  await addGuests(w, 100);
  assert.equal(await count(w), 100, '105 on the list, 5 not counted for the caterer');
  assert.equal(Number((await read(p)).total_centavos), build().total);
  await db.query(`DELETE FROM public.guest_not_counted_for WHERE guest_id = $1`, [kids[0]]);
  assert.equal(Number((await read(p)).total_centavos), build().total + RATE, 'unticking one kid counts them again');
});

test('🍽 a kids meal never ticks "Not counted for" by itself', async () => {
  const w = await newWorld();
  await quote(w, build());
  const [g] = await addGuests(w, 1);
  await db.query(`UPDATE public.guests SET meal_preference = 'kids' WHERE guest_id = $1`, [g]);
  const ticks = await db.query(`SELECT 1 FROM public.guest_not_counted_for WHERE guest_id = $1`, [g]);
  assert.equal(ticks.rows.length, 0);
  assert.equal(await count(w), 1);
});

test('⛔ a quote without its own per-head rate is never repriced (no rate is guessed from the card)', async () => {
  const w = await newWorld();
  const b = build();
  const bare = b.lines.map(({ label, detail, amount_centavos }) => ({ label, detail, amount_centavos }));
  const p = await quote(w, { ...b, lines: bare });
  await addGuests(w, 180);
  assert.equal(Number((await read(p)).total_centavos), b.total);
  assert.deepEqual(await rises(w), []);
});

test('📈 the events trigger calls it too (a change of the guest estimate re-reads the list)', async () => {
  const w = await newWorld();
  const p = await quote(w, build());
  // The list grows with the guest-list triggers switched off, so only the events trigger can lift it.
  await db.exec(`SET session_replication_role = replica`);
  await addGuests(w, 112);
  await db.exec(`SET session_replication_role = DEFAULT`);
  assert.equal(Number((await read(p)).total_centavos), build().total);
  await db.query(`UPDATE public.events SET estimated_pax = 112 WHERE event_id = $1`, [w.eventId]);
  assert.equal(Number((await read(p)).total_centavos), build().total + 12 * RATE);
});

test('🛡 a browser session cannot call the repricer or the count', async () => {
  const w = await newWorld();
  await setAuthUid(db, w.host);
  await db.exec(`SET ROLE authenticated`);
  await assert.rejects(db.query(`SELECT public.quote_follow_guest_count($1)`, [w.eventId]), /permission denied/);
  await assert.rejects(db.query(`SELECT public.quote_guest_count($1, $2)`, [w.eventId, w.vendorId]), /permission denied/);
  await db.exec('RESET ROLE');
});

// ── 📉 THE FALL-BACK (migration 20271340566104; DECISION_LOG 2026-11-12 "WHEN A GUEST IS REMOVED, THE PRICE FALLS BACK —
// UNLESS THE SUPPLIER LOCKED IT") ─────────────────────────────────────────────────────────────────────────────────

type Snap = { billed_pax?: number; sent_billed_pax?: number; min_pax?: number };
const asQuote = (r: Row, locked = false) => ({
  lines: r.line_items,
  totalCentavos: Number(r.total_centavos),
  schedule: r.payment_schedule,
  minPax: (r.merge_snapshot as Snap).min_pax ?? null,
  billedPax: (r.merge_snapshot as Snap).billed_pax ?? null,
  sentBilledPax: (r.merge_snapshot as Snap).sent_billed_pax ?? null,
  booked: false,
  locked,
});

test('📉 SQL and the TS mirror agree on every fall — lines, total, plan, billed pax, words', async () => {
  const cases = [
    { up: 140, down: 120, minPax: 100 },
    { up: 140, down: 60, minPax: 100 }, // to the sent pax
    { up: 140, down: 60, minPax: 0, extraPerPax: 4_500, firstPct: 35 },
    { up: 103, down: 101, minPax: 0, rate: 12_345 },
  ];
  for (const c of cases) {
    const w = await newWorld();
    const b = build({ billed: 100, minPax: c.minPax, rate: c.rate, extraPerPax: c.extraPerPax, firstPct: c.firstPct });
    const p = await quote(w, b);
    const ids = await addGuests(w, c.up);
    const before = await read(p);
    assert.equal(Number(before.total_centavos) > b.total, true, JSON.stringify(c));
    const ts = followGuestCount(asQuote(before), Math.max(c.down, 0));
    await db.query(`DELETE FROM public.guests WHERE guest_id = ANY($1::uuid[])`, [ids.slice(c.down)]);
    const r = await read(p);
    assert.ok(ts.fell, JSON.stringify(c));
    assert.equal(Number(r.total_centavos), ts.totalCentavos, JSON.stringify(c));
    assert.deepEqual(r.line_items, JSON.parse(JSON.stringify(ts.lines)), JSON.stringify(c));
    assert.deepEqual(r.payment_schedule, JSON.parse(JSON.stringify(ts.schedule)), JSON.stringify(c));
    assert.equal(r.merge_snapshot.billed_pax, ts.billedPax);
    assert.equal(r.merge_snapshot.sent_billed_pax, 100, 'the pax it was sent at is remembered');
    assert.deepEqual(await falls(w), [ts.line]);
  }
});

test('📉 back to the sent quote exactly — the round trip leaves the same money on every line and row', async () => {
  const w = await newWorld();
  const b = build();
  const p = await quote(w, b);
  const ids = await addGuests(w, 130);
  await db.query(`DELETE FROM public.guests WHERE guest_id = ANY($1::uuid[])`, [ids.slice(100)]);
  const r = await read(p);
  assert.equal(Number(r.total_centavos), b.total);
  assert.deepEqual(r.line_items.map((l) => l.amount_centavos), b.lines.map((l) => l.amount_centavos));
  assert.deepEqual(r.payment_schedule.installments!.map((i) => i.amount_centavos), b.schedule.installments!.map((i) => i.amount_centavos));
  assert.deepEqual(await falls(w), ['Quote fell to 100 pax · −₱19,500']);
});

test('🔒 a locked (changes_locked) quotation rises but never falls back', async () => {
  const w = await newWorld();
  const p = await quote(w, build(), 'sent', { locked: true });
  const ids = await addGuests(w, 130);
  const up = Number((await read(p)).total_centavos);
  assert.equal(up, build().total + 30 * RATE);
  await db.query(`DELETE FROM public.guests WHERE guest_id = ANY($1::uuid[])`, [ids.slice(90)]);
  assert.equal(Number((await read(p)).total_centavos), up, 'the locked price is the floor');
  assert.deepEqual(await falls(w), []);
  await addGuests(w, 50); // 140 → still rises
  assert.equal(Number((await read(p)).total_centavos), build().total + 40 * RATE);
});

test('💳 a fall never touches a paid row — a paid Final balance leaves nothing to take it from', async () => {
  const w = await newWorld();
  const b = build();
  const p = await quote(w, b, 'accepted');
  const ids = await addGuests(w, 120);
  const risenRow = await read(p);
  const fin = risenRow.payment_schedule.installments![1]!;
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, schedule_instance_seq) VALUES ($1, $2, $3, 'GCash', 1)`,
    [w.eventId, w.vendorId, fin.amount_centavos / 100],
  );
  await db.query(`DELETE FROM public.guests WHERE guest_id = ANY($1::uuid[])`, [ids.slice(100)]);
  const r = await read(p);
  assert.equal(Number(r.total_centavos), Number(risenRow.total_centavos), 'paid → the price stays');
  assert.deepEqual(r.payment_schedule, risenRow.payment_schedule);
  assert.deepEqual(await falls(w), []);
});

test('💳 a drop bigger than the unsettled balance stops there (a paid Final balance + a small new one)', async () => {
  const w = await newWorld();
  const b = build();
  const p = await quote(w, b, 'accepted');
  const ids = await addGuests(w, 100);
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, schedule_instance_seq) VALUES ($1, $2, $3, 'GCash', 1)`,
    [w.eventId, w.vendorId, b.schedule.installments![1]!.amount_centavos / 100],
  );
  await addGuests(w, 3); // a NEW auto row of 3 guests' worth
  const risenRow = await read(p);
  assert.equal(risenRow.payment_schedule.installments!.length, 3);
  const ts = followGuestCount(asQuote(risenRow), 100, [1]);
  // 3 guests leave — the new auto row is exactly what is unsettled, and it goes.
  await db.query(`DELETE FROM public.guests WHERE guest_id = ANY($1::uuid[])`, [ids.slice(0, 3)]);
  const r = await read(p);
  assert.ok(ts.fell);
  assert.equal(Number(r.total_centavos), b.total);
  assert.deepEqual(r.payment_schedule.installments, b.schedule.installments, 'the paid rows as they were; the emptied auto row left');
  assert.deepEqual(r.payment_schedule, JSON.parse(JSON.stringify(ts.schedule)), 'SQL and TS agree on the capped case');
});

test('💳 no plan: the fall stops at what has been paid on the booking', async () => {
  const w = await newWorld();
  const b = build();
  const p = await quote(w, { ...b, schedule: null as unknown as FollowSchedule });
  const ids = await addGuests(w, 130);
  const risenRow = await read(p);
  const paid = Number(risenRow.total_centavos) - 10 * RATE; // ₱6,500 still to settle
  await db.query(`INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method) VALUES ($1, $2, $3, 'GCash')`, [w.eventId, w.vendorId, paid / 100]);
  await db.query(`DELETE FROM public.guests WHERE guest_id = ANY($1::uuid[])`, [ids.slice(100)]);
  const r = await read(p);
  assert.equal(Number(r.total_centavos), paid, 'falls 10 guests, never under what is paid');
  assert.equal(r.merge_snapshot.billed_pax, 120);
  const ts = followGuestCount(asQuote(risenRow), 100, [], paid);
  assert.ok(ts.fell);
  assert.equal(ts.totalCentavos, paid);
});

test('📉 a BOOKED deal never falls — it follows like a locked quote (Piece 2)', async () => {
  const w = await newWorld();
  const p = await quote(w, build(), 'accepted');
  const ids = await addGuests(w, 130);
  const up = Number((await read(p)).total_centavos);
  await db.query(`UPDATE public.event_vendors SET status = 'contracted', total_cost_php = $2 WHERE vendor_id = $1`, [w.vendorId, up / 100]);
  await db.query(`DELETE FROM public.guests WHERE guest_id = ANY($1::uuid[])`, [ids.slice(100)]);
  assert.equal(Number((await read(p)).total_centavos), up);
  assert.deepEqual(await falls(w), []);
});

test('🍽 ticking a guest "Not counted for" a service lowers that service’s quote; an accepted booking follows', async () => {
  const w = await newWorld();
  const b = build();
  await db.query(`UPDATE public.event_vendors SET status = 'shortlisted', total_cost_php = $2 WHERE vendor_id = $1`, [w.vendorId, b.total / 100]);
  const p = await quote(w, b, 'accepted');
  const kids = await addGuests(w, 5, 'attending', 'kids');
  await addGuests(w, 100);
  assert.equal(Number((await read(p)).total_centavos), b.total + 5 * RATE);
  await db.query(`INSERT INTO public.guest_not_counted_for (guest_id, event_vendor_id) SELECT unnest($1::uuid[]), $2`, [kids, w.vendorId]);
  assert.equal(Number((await read(p)).total_centavos), b.total, 'the couple’s tick takes the 5 kids’ plates back off');
  const ev = await db.query<{ t: string; base: number }>(`SELECT total_cost_php::text AS t, pax_quote_base AS base FROM public.event_vendors WHERE vendor_id = $1`, [w.vendorId]);
  assert.equal(Number(ev.rows[0]!.t), b.total / 100);
  assert.equal(ev.rows[0]!.base, 100);
  assert.deepEqual(await falls(w), ['Quote fell to 100 pax · −₱3,250']);
});
