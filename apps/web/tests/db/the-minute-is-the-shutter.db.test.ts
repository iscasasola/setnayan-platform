/**
 * THE MINUTE IS THE SHUTTER, NOT THE UPLOAD.
 *
 * Until migration 20271214644139 both Papic writers let `captured_at` fall to
 * its column default of now(), so a photograph was filed under the minute its
 * BYTES FINISHED ARRIVING. At a venue with patchy signal a 2 PM photograph
 * landed at 8 PM, and the story's per-minute dial — every bar of it — became a
 * chart of where the reception had signal.
 *
 * ── 🔑 WHY THE NUMBERS HERE ARE DELIBERATELY FAR APART ─────────────────────
 * Every capture in the bar test is TAKEN inside one ten-minute window and one
 * of them is UPLOADED six hours later. The defect and the fix disagree at every
 * assertion:
 *
 *   • defective writer → the late shot sits alone on the 8 PM bar; the 2 PM bar
 *     holds two of three
 *   • correct writer   → all three sit on the 2 PM bar; the 8 PM bar is empty
 *
 * Had the delay been minutes, or the captures spread across the evening, both
 * answers would coincide and the test would prove nothing.
 *
 * ── ⚠ AND THE HALF THAT MATTERS MORE ──────────────────────────────────────
 * `papic_record_guest_capture` is the authoritative race-safe gate every guest
 * capture at a live wedding goes through. A validation that could RAISE would
 * turn a wrong phone clock into a REFUSED PHOTOGRAPH at somebody's wedding, in
 * progress. So the refusal path is tested first and hardest: a future stamp, a
 * 1970 stamp, a stamp from before the celebration existed, and no stamp at all
 * — all four must record the capture and merely lose the exact minute.
 *
 * Migration: 20271214644139_the_minute_is_the_shutter.sql
 * Run: cd apps/web && npx tsx --test tests/db/the-minute-is-the-shutter.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

type Reply = { status: string; photo_id?: string | null };

/** An event with a real shared pool, so the guest writer's gates all pass. */
async function seedEvent() {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1, 'birthday') RETURNING event_id`,
    [`shutter test ${n}`],
  );
  const coupleId = await one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`shutter-couple-${n}@test.local`],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, coupleId],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, 5000, 'admin', 'shutter test')`,
    [eventId],
  );
  return eventId;
}

async function seedGuest(eventId: string) {
  n += 1;
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category,
                                ugc_terms_accepted_at)
     VALUES ($1, $2, 'Cruz', 'both', 'friends', NOW()) RETURNING guest_id`,
    [eventId, `Shutter${n}`],
  );
}

async function seedSeat(eventId: string) {
  n += 1;
  const userId = await one<string>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [`shutter-seat-${n}@test.local`],
  );
  const seatId = await one<string>(
    `INSERT INTO public.paparazzi_seats
       (event_id, seat_index, sku_code, claim_qr_token, claimer_user_id, claimed_at)
     VALUES ($1, $2, 'PAPIC_SEATS', $3, $4, NOW()) RETURNING seat_id`,
    [eventId, n, `shutter-tok-${n}`, userId],
  );
  return { seatId, userId };
}

/** Record one guest capture with an explicit (or absent) shutter claim. */
async function guestCapture(guestId: string, claimed: string | null): Promise<Reply> {
  return one<Reply>(
    `SELECT public.papic_record_guest_capture(
       $1, $2, false, 'photo', NULL, NULL, 1, $3::timestamptz)`,
    [guestId, `r2://shutter/${Math.random()}`, claimed],
  );
}

/** Record one seat capture with an explicit (or absent) shutter claim. */
async function seatCapture(
  seat: { seatId: string; userId: string },
  eventId: string,
  claimed: string | null,
): Promise<Reply> {
  return one<Reply>(
    `SELECT public.papic_record_seat_capture(
       $1, $2, $3, $4, 'photo', NULL, 0, NULL, NULL, NULL, NULL, $5::timestamptz)`,
    [seat.seatId, eventId, seat.userId, `r2://shutter/${Math.random()}`, claimed],
  );
}

const minutesApart = (a: string | Date, b: string | Date) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE REFUSAL PATH — built first, because a mistake here refuses
//     photographs at a wedding in progress.
// ═══════════════════════════════════════════════════════════════════════════

test('an unbelievable clock costs the shot its minute, NEVER the shot', async () => {
  const eventId = await seedEvent();
  const guestId = await seedGuest(eventId);

  const claims: Array<[string, string | null]> = [
    ['absent', null],
    ['three days in the future', new Date(Date.now() + 3 * 86_400_000).toISOString()],
    ['the 1970 epoch', '1970-01-01T00:00:00Z'],
    ['a year before the celebration existed', new Date(Date.now() - 365 * 86_400_000).toISOString()],
  ];

  for (const [label, claimed] of claims) {
    const before = await one<string>(
      `SELECT COUNT(*)::text FROM public.papic_guest_captures WHERE guest_id = $1`,
      [guestId],
    );
    const reply = await guestCapture(guestId, claimed);
    const after = await one<string>(
      `SELECT COUNT(*)::text FROM public.papic_guest_captures WHERE guest_id = $1`,
      [guestId],
    );
    console.log(
      `  refusal path · ${label}: status=${reply.status} rows ${before} → ${after}`,
    );
    assert.equal(reply.status, 'ok', `${label} must still record the capture`);
    assert.equal(Number(after), Number(before) + 1, `${label} must add exactly one row`);
  }

  // Every one of them was filed at now(), which is byte-for-byte the behaviour
  // every row had before this migration. The worst case is the status quo.
  const strayed = await one<string>(
    `SELECT COUNT(*)::text FROM public.papic_guest_captures
      WHERE guest_id = $1 AND ABS(EXTRACT(EPOCH FROM (captured_at - now()))) > 300`,
    [guestId],
  );
  assert.equal(strayed, '0', 'an unbelievable claim was written to the row');
});

test('a believable shutter time is BELIEVED — the resolver is not now() in disguise', async () => {
  const eventId = await seedEvent();
  const guestId = await seedGuest(eventId);

  const shutter = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const reply = await guestCapture(guestId, shutter);
  assert.equal(reply.status, 'ok');

  const row = await db.query<{ captured_at: string; created_at: string }>(
    `SELECT captured_at, created_at FROM public.papic_guest_captures
      WHERE guest_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [guestId],
  );
  const { captured_at, created_at } = row.rows[0]!;
  console.log(`  captured_at=${captured_at}  created_at=${created_at}`);

  // ⚖ Without this assertion every check in the file above would still pass for
  // a resolver that answered now() unconditionally — which IS the defect.
  assert.ok(
    minutesApart(captured_at, shutter) < 1,
    `captured_at must be the shutter (${shutter}), got ${captured_at}`,
  );
  // And the upload minute is not lost — it is a different fact, still recorded.
  assert.ok(
    minutesApart(created_at, new Date()) < 5,
    'created_at must stay the upload minute',
  );
  assert.ok(
    minutesApart(created_at, captured_at) > 300,
    'captured_at and created_at must be able to disagree — that is the whole point',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · THE CLAIM ITSELF — a late upload does not move a bar.
// ═══════════════════════════════════════════════════════════════════════════

test('a capture uploaded six hours late does not move a bar', async () => {
  const eventId = await seedEvent();
  const guestId = await seedGuest(eventId);

  // Three shots taken inside one ten-minute window. Two upload at once; the
  // third is the one whose phone found no signal until the guests went home.
  const base = new Date(Date.now() - 6 * 3_600_000);
  const taken = [0, 5, 9].map((m) => new Date(base.getTime() + m * 60_000).toISOString());
  for (const t of taken) assert.equal((await guestCapture(guestId, t)).status, 'ok');

  const bars = await db.query<{ bar: string; shots: string }>(
    `SELECT date_trunc('hour', captured_at)::text AS bar, COUNT(*)::text AS shots
       FROM public.papic_guest_captures WHERE guest_id = $1
      GROUP BY 1 ORDER BY 1`,
    [guestId],
  );
  const uploadBars = await db.query<{ bar: string; shots: string }>(
    `SELECT date_trunc('hour', created_at)::text AS bar, COUNT(*)::text AS shots
       FROM public.papic_guest_captures WHERE guest_id = $1
      GROUP BY 1 ORDER BY 1`,
    [guestId],
  );
  console.log('  bars by SHUTTER:', JSON.stringify(bars.rows));
  console.log('  bars by UPLOAD :', JSON.stringify(uploadBars.rows));

  assert.equal(bars.rows.length, 1, 'all three shots belong to one bar on the dial');
  assert.equal(bars.rows[0]!.shots, '3');
  assert.ok(
    minutesApart(bars.rows[0]!.bar, base) < 60,
    'the bar is the hour the shots were TAKEN',
  );
  // The same rows, bucketed the way the product did it before this migration,
  // land on a different bar entirely. That difference is the defect, measured.
  assert.ok(
    minutesApart(uploadBars.rows[0]!.bar, bars.rows[0]!.bar) > 300,
    'the upload bar and the shutter bar must differ — otherwise this test proves nothing',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · THE SEAT PATH — the same rule, the other writer.
// ═══════════════════════════════════════════════════════════════════════════

test('the seat writer files a photograph under its shutter too', async () => {
  const eventId = await seedEvent();
  const seat = await seedSeat(eventId);

  const shutter = new Date(Date.now() - 4 * 3_600_000).toISOString();
  const ok = await seatCapture(seat, eventId, shutter);
  assert.equal(ok.status, 'ok');

  const row = await db.query<{ captured_at: string; created_at: string }>(
    `SELECT captured_at, created_at FROM public.papic_photos
      WHERE paparazzi_seat_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [seat.seatId],
  );
  const { captured_at, created_at } = row.rows[0]!;
  console.log(`  seat captured_at=${captured_at}  created_at=${created_at}`);
  assert.ok(minutesApart(captured_at, shutter) < 1, 'the seat shutter was dropped');
  assert.ok(minutesApart(created_at, new Date()) < 5, 'created_at is the upload minute');

  // And the refusal path, on this writer too.
  const future = await seatCapture(
    seat,
    eventId,
    new Date(Date.now() + 3 * 86_400_000).toISOString(),
  );
  assert.equal(future.status, 'ok', 'a wrong clock must not refuse a seat capture');
  const strayed = await one<string>(
    `SELECT COUNT(*)::text FROM public.papic_photos
      WHERE paparazzi_seat_id = $1 AND captured_at > now() + INTERVAL '2 minutes'`,
    [seat.seatId],
  );
  assert.equal(strayed, '0', 'a future shutter time was written to papic_photos');
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 · THE SHAPE — one writer, one gate.
// ═══════════════════════════════════════════════════════════════════════════

test('neither writer gained an overload, and both consult the resolver', async () => {
  for (const fn of ['papic_record_guest_capture', 'papic_record_seat_capture']) {
    const count = await one<string>(
      `SELECT COUNT(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = $1`,
      [fn],
    );
    console.log(`  ${fn}: ${count} overload(s)`);
    // Two arities both fully defaulted make every named call fail 42725, and
    // the guest route's fallback ladder matches that error — it would silently
    // retry a shorter shape and record every clip as a photo (20271184624871).
    assert.equal(count, '1', `${fn} must have exactly one signature`);

    const args = await one<string>(
      `SELECT pg_get_function_identity_arguments(p.oid)
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = $1`,
      [fn],
    );
    assert.ok(
      args.endsWith(', p_captured_at timestamp with time zone'),
      `${fn} must take p_captured_at LAST, so every positional caller keeps its meaning`,
    );

    const def = await one<string>(
      `SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = $1`,
      [fn],
    );
    assert.ok(
      def.includes('papic_capture_minute'),
      `${fn} accepts p_captured_at without consulting the resolver — the argument is decoration`,
    );
  }
});
