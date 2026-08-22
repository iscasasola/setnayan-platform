/**
 * How many captures a second can ONE event's credit pool absorb?
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The owner's own Papic plan (Papic_Build_Brief_2026-07-17 · Papic_v3_Whats_Next_
 * 2026-07-18) lists this under **"Open risks / must-hold invariants"**:
 *
 *   "Lite single-hot-row throughput (fast pre-read + accepts/sec limiter,
 *    not advisory-lock-per-event; load-test)"
 *
 * The fast pre-read shipped. The limiter was never put on a capture path. The
 * load test was never run. The owner then asked for a real number: Papic can see
 * **1–250 photos or clips per second per event**, and every capture that dips
 * into the shared pot must take its turn on ONE row —
 * `papic_event_pool_usage`, whose primary key is `event_id`.
 *
 * ── WHAT THIS MEASURES, AND WHAT IT CANNOT ──────────────────────────────────
 * It replays the REAL migrations into PGlite and calls the REAL
 * `papic_reserve_capture_split`, so the SQL under test is production's.
 *
 * ⚠ **PGlite IS ONE IN-PROCESS SESSION. THERE IS NO CONCURRENCY HERE, AND NO
 * NETWORK.** So this cannot measure lock CONTENTION — it measures how fast the
 * reservation can go when nothing is fighting it and nothing is on the wire.
 *
 * 🔑 **THAT MAKES EVERY NUMBER BELOW A CEILING, NEVER A FORECAST.** A hot row is
 * serialised by definition, so contention can only make production slower; the
 * network can only make it slower again. If the ceiling here is under 250/s, the
 * question is settled and no plan upgrade changes it. If it is comfortably over,
 * the answer is "not settled — measure it against a real instance", which is a
 * different and more expensive test.
 *
 * ⛔ **NEVER POINT THIS AT PRODUCTION.** A research fan-out against the live
 * database took setnayan.com down for 50 minutes on 2026-08-20. This script
 * talks to an in-memory database it creates and throws away.
 *
 * Run:  pnpm --filter @setnayan/web loadtest:hot-row
 */
import { createReplayedDb } from '../tests/db/replay-migrations';

const CAPTURES = Number(process.env.CAPTURES ?? 2_000);
const CAMERAS = Number(process.env.CAMERAS ?? 20);
/** A photo costs 1; a 10s clip costs 8 (PAPIC_CLIP_COST_BANDS). */
const COST = Number(process.env.COST ?? 1);

function rate(n: number, ms: number): string {
  return ms <= 0 ? '∞' : Math.round((n / ms) * 1000).toLocaleString();
}

async function main() {
  const { db } = await createReplayedDb();

  // One event, one very large pot, and CAMERAS seats holding NO dedicated
  // credits — so every single capture has to go through the shared row. That is
  // the worst case and the one being asked about.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Hot row load test', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, $2, 'admin', 'load test')`,
    [eventId, CAPTURES * COST + 1_000],
  );

  const seats: string[] = [];
  for (let i = 0; i < CAMERAS; i += 1) {
    const s = await db.query<{ seat_id: string }>(
      `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier)
       VALUES ($1, $2, 'PAPIC_CAMERA_FREE', $3, 'free') RETURNING seat_id`,
      [eventId, 900 + i, `loadtest-seat-${i}`],
    );
    seats.push(s.rows[0]!.seat_id);
  }

  // ── BASELINE. Without it a number is unreadable: is 300/s the reservation
  // being slow, or PGlite-in-WASM being slow at everything? ───────────────────
  const t0 = performance.now();
  for (let i = 0; i < CAPTURES; i += 1) await db.query(`SELECT 1`);
  const baseMs = performance.now() - t0;

  // ── THE PRE-READ that the capture path runs before reserving. ──────────────
  const t1 = performance.now();
  for (let i = 0; i < CAPTURES; i += 1) {
    await db.query(`SELECT public.papic_event_points_remaining($1)`, [eventId]);
  }
  const preMs = performance.now() - t1;

  // ── THE RESERVATION ITSELF — the hot row — MEASURED IN BLOCKS. ─────────────
  // 🔑 THE RATE MATTERS LESS THAN WHETHER IT HOLDS. A reception runs for hours:
  // 250/s for one hour is ~900,000 updates to a SINGLE row. Every update leaves
  // a dead tuple behind, and if autovacuum cannot keep up with one very hot row
  // the page grows a long version chain and each next update gets slower. A
  // one-shot average would hide that completely — so the block rates below are
  // the real result, and a falling curve is the finding.
  const BLOCK = Math.max(1, Math.floor(CAPTURES / 5));
  const blocks: Array<{ n: number; ms: number }> = [];
  let ok = 0;
  const t2 = performance.now();
  let blockStart = t2;
  for (let i = 0; i < CAPTURES; i += 1) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT ok FROM public.papic_reserve_capture_split($1,$2,$3)`,
      [seats[i % seats.length], eventId, COST],
    );
    if (r.rows[0]?.ok) ok += 1;
    if ((i + 1) % BLOCK === 0) {
      const now = performance.now();
      blocks.push({ n: BLOCK, ms: now - blockStart });
      blockStart = now;
    }
  }
  const resMs = performance.now() - t2;

  const remaining = await db.query<{ remaining_points: number }>(
    `SELECT remaining_points FROM public.papic_event_pool_status($1)`,
    [eventId],
  );

  console.log('');
  console.log('  PAPIC HOT-ROW CEILING — in-process, no contention, no network');
  console.log('  ────────────────────────────────────────────────────────────');
  console.log(`  captures fired ......... ${CAPTURES.toLocaleString()} across ${CAMERAS} cameras, cost ${COST} each`);
  console.log(`  accepted ............... ${ok.toLocaleString()}`);
  console.log(`  pot left ............... ${remaining.rows[0]?.remaining_points?.toLocaleString() ?? '?'}`);
  console.log('');
  console.log(`  SELECT 1 (baseline) .... ${rate(CAPTURES, baseMs)}/s   (${baseMs.toFixed(0)}ms)`);
  console.log(`  pre-read ............... ${rate(CAPTURES, preMs)}/s   (${preMs.toFixed(0)}ms)`);
  console.log(`  reserve (THE HOT ROW) .. ${rate(CAPTURES, resMs)}/s   (${resMs.toFixed(0)}ms)`);
  console.log('');
  console.log('  DOES IT HOLD? reservation rate per block, first → last:');
  blocks.forEach((b, i) => {
    console.log(`    block ${i + 1} (${(i * b.n + 1).toLocaleString()}–${((i + 1) * b.n).toLocaleString()}) ... ${rate(b.n, b.ms)}/s`);
  });
  if (blocks.length >= 2) {
    const first = blocks[0]!.n / blocks[0]!.ms;
    const last = blocks[blocks.length - 1]!.n / blocks[blocks.length - 1]!.ms;
    const drop = ((first - last) / first) * 100;
    console.log(`    → last block is ${drop >= 0 ? drop.toFixed(0) + '% SLOWER' : (-drop).toFixed(0) + '% faster'} than the first`);
  }
  console.log('');
  console.log(`  one capture costs ...... ${((preMs + resMs) / CAPTURES).toFixed(3)}ms of database work`);
  console.log(`  ⇒ ceiling .............. ${rate(CAPTURES, preMs + resMs)} captures/second`);
  console.log('');
  console.log('  ⚠ A CEILING, NOT A FORECAST. One session, no lock waiting, no network.');
  console.log('    Production can only be slower than this, never faster.');
  console.log('');

  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
