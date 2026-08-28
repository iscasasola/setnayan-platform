/**
 * A PAPIC SEAT CAPTURE'S CREDIT AND ITS PHOTOGRAPH COMMIT TOGETHER, OR NEITHER.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * `recordSeatCapture` used to reserve the credits and then write the row in two
 * round trips. The application unwind covered the ordinary failure — an insert
 * that came back with an error while the same process was still alive to put the
 * credits back. It could not cover a death, a timeout, a container eviction or a
 * deploy landing between the two calls, each of which left the couple charged for
 * a photograph that does not exist.
 *
 * `no-photo-without-a-credit.db.test.ts` says, in its own words, that it does NOT
 * assert this and that "nobody should read this file as proof of an invariant it
 * does not test". This is the file that tests it.
 *
 * ── WHY THE ROLLBACK IS PROVEN AND NOT ASSUMED ─────────────────────────────
 * 🔑 "IT IS ALL ONE FUNCTION" IS NOT EVIDENCE. plpgsql runs in the caller's
 * transaction, which is what makes this work — but a future edit could add an
 * EXCEPTION block around the insert, and an exception handler is an implicit
 * subtransaction: the reserve would then COMMIT while the row is discarded, and
 * every structural test still passes. So rule 4 forces a real failure through the
 * real function and reads the meter afterwards.
 *
 * ⚠ THE REPLAY RUNS AS SUPERUSER, so nothing here proves a browser is actually
 * refused at runtime — it proves the GRANTS say so. That distinction has cost
 * this project before (a `REVOKE UPDATE (cols)` that was inert against a
 * table-level grant passed its own test). Rules 1–3 ask the catalog, per role and
 * per column, which is the strongest thing available in this harness.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  // ⚠ `replay?.close?.()` — the shape written first in the sibling file —
  // TYPECHECKED AS AN ERROR and ran as a no-op, so that suite passed while never
  // releasing the database. The rest of this directory calls `db.close()`.
  await db?.close();
});

const CALLER_ROLES = ['authenticated', 'anon'] as const;

test('1 · the record function exists, and it is SECURITY DEFINER', async () => {
  const { rows } = await db.query<{ prosecdef: boolean; n: number }>(
    `SELECT p.prosecdef, count(*) OVER () AS n
       FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = 'papic_record_seat_capture'`,
  );
  assert.equal(
    rows.length,
    1,
    `expected exactly one papic_record_seat_capture, found ${rows.length}. Two ` +
      `overloads means PostgREST resolves by the exact set of NAMED arguments — ` +
      `and the caller would silently reach whichever one matches.`,
  );
  assert.equal(
    rows[0]?.prosecdef,
    true,
    'papic_record_seat_capture is SECURITY INVOKER. INSERT on papic_photos is ' +
      'revoked from every browser role, so an invoker function cannot write the ' +
      'row — the camera would stop recording.',
  );
});

test('2 · no browser role can EXECUTE it — that is the whole reason the gates upstairs still mean anything', async () => {
  /*
    ⛔ IF `authenticated` COULD CALL THIS, a signed-in claimer would name their
    own id and walk past the five gates that stayed in the server action: the
    burst limiter, the 10-second clip cap, the capture window, the paid-order
    gate and the put-away gate. That is precisely the hole 20271169487222 closed
    by revoking INSERT, reopened one door over.

    ⚠ ASKED OF THE ROLES, NOT OF `PUBLIC`. A fresh function is created with
    EXECUTE granted to PUBLIC; revoking the two roles by name leaves that
    standing, and `has_function_privilege` is what notices, because it resolves
    the grant a role actually holds however it holds it.
  */
  const { rows: fns } = await db.query<{ oid: number }>(
    `SELECT p.oid FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.proname = 'papic_record_seat_capture'`,
  );
  assert.equal(fns.length, 1, 'the function census read nothing — the rule below is vacuous');

  const open: string[] = [];
  for (const role of CALLER_ROLES) {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT has_function_privilege($1, $2::oid, 'EXECUTE') AS ok`,
      [role, fns[0]!.oid],
    );
    if (rows[0]?.ok) open.push(role);
  }
  assert.deepEqual(
    open,
    [],
    `${open.join(', ')} can EXECUTE papic_record_seat_capture. Revoke from ` +
      `PUBLIC — revoking the named roles alone leaves the PUBLIC grant, and ` +
      `every role created later arrives holding it.`,
  );

  const { rows: svc } = await db.query<{ ok: boolean }>(
    `SELECT has_function_privilege('service_role', $1::oid, 'EXECUTE') AS ok`,
    [fns[0]!.oid],
  );
  assert.equal(
    svc[0]?.ok,
    true,
    'service_role cannot EXECUTE the record function — every camera in the ' +
      'product stops recording, silently, since the action returns a soft error',
  );
});

test('3 · …and INSERT on papic_photos is still shut, per COLUMN', async () => {
  /*
    🔑 THE SIBLING FILE ASKS THIS TOO, AND IT IS ASKED AGAIN HERE ON PURPOSE.
    This migration adds a new writer of that table. The failure mode it could
    introduce is handing the grant back "so the RPC can insert" — which it never
    needs, being SECURITY DEFINER — and that would undo the earlier fix from a
    file nobody would think to re-read.

    ⚠ PER COLUMN. `has_table_privilege(…,'INSERT')` answered FALSE while the
    privilege was held on all 39 grantable columns; a table-level audit read a
    wide-open table as closed.
  */
  const { rows: cols } = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'papic_photos'`,
  );
  assert.ok(
    cols.length >= 20,
    `only ${cols.length} columns found on papic_photos — the census read ` +
      `nothing, so the check below is vacuous`,
  );

  const open: string[] = [];
  for (const role of CALLER_ROLES) {
    for (const { column_name } of cols) {
      const { rows } = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege($1, 'public.papic_photos', $2, 'INSERT') AS ok`,
        [role, column_name],
      );
      if (rows[0]?.ok) open.push(`${role}.${column_name}`);
    }
  }
  assert.deepEqual(
    open,
    [],
    `column-level INSERT is back on papic_photos: ${open.join(', ')}. The record ` +
      `function is SECURITY DEFINER and needs no grant — handing one back makes ` +
      `every gate in recordSeatCapture optional again.`,
  );
});

let seatCounter = 0;

type Fixture = {
  eventId: string;
  seatId: string;
  userId: string;
  /** The camera's own unshared balance, READ BACK rather than assumed. */
  dedicated: number;
  /** What is left in the event's shared pot, READ BACK. */
  poolLeft: number;
};

/**
 * One event, one claimed camera, some credits dedicated to it.
 *
 * ⚠ BOTH BALANCES ARE READ BACK, NEVER ASSUMED. Every event is armed with a free
 * grant the moment it exists, so a seed of 20 does not mean the pot holds 20 —
 * and a test pinned to an absolute number would fail the day that free grant
 * moves, while telling you nothing about atomicity. Every assertion below is a
 * delta or is computed from these two figures.
 */
async function seedFundedSeat(dedicatedPoints: number): Promise<Fixture> {
  seatCounter += 1;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [`atomicity-claimer-${seatCounter}@example.test`],
  );
  const userId = u.rows[0]!.id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Atomicity test', 'birthday', CURRENT_DATE + 30) RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;

  // The claim token is UNIQUE across every event, so it has to vary per seed or
  // the second fixture in a test collides on it rather than on anything real.
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats
       (event_id, seat_index, sku_code, claim_qr_token, tier, claimer_user_id)
     VALUES ($1, 700, 'PAPIC_CAMERA_FREE', $2, 'free', $3)
     RETURNING seat_id`,
    [eventId, `atomicity-seat-${seatCounter}`, userId],
  );
  const seatId = seat.rows[0]!.seat_id;

  if (dedicatedPoints > 0) {
    // An allocation, not a grant: `papic_event_pool_status` counts only SHARED
    // grants (seat_id IS NULL) and subtracts allocations, so this is what moves
    // credits out of the pot and onto this camera — zero-sum, exactly as the
    // hand-out screen does it.
    await db.query(
      `INSERT INTO public.papic_seat_allocations (seat_id, event_id, points)
       VALUES ($1, $2, $3)`,
      [seatId, eventId, dedicatedPoints],
    );
  }

  return {
    eventId,
    seatId,
    userId,
    dedicated: await dedicatedPointsOf(seatId),
    poolLeft: await poolRemaining(eventId),
  };
}

async function dedicatedPointsOf(seatId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT public.papic_seat_dedicated_points($1) AS n`,
    [seatId],
  );
  return Number(rows[0]?.n ?? 0);
}

async function poolRemaining(eventId: string): Promise<number> {
  const { rows } = await db.query<{ remaining_points: number }>(
    `SELECT remaining_points FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  return Number(rows[0]?.remaining_points ?? 0);
}

async function seatPointsUsed(seatId: string): Promise<number> {
  const { rows } = await db.query<{ points_used: number }>(
    `SELECT COALESCE(points_used, 0) AS points_used
       FROM public.papic_seat_point_usage WHERE seat_id = $1`,
    [seatId],
  );
  return Number(rows[0]?.points_used ?? 0);
}

test('4 · 🚨 a failing INSERT takes the credit spend down with it', async () => {
  /*
    THE RULE THIS WHOLE FILE EXISTS FOR.

    The capture has to fail AFTER the reserve has moved the meter, and the
    failure has to be one the function cannot normalize away — it launders
    `photo_type` and the poster key on the way in, so a bad argument is not
    enough. A CHECK constraint the insert must violate is added for the duration
    of this test and dropped in a `finally`, so the rest of the suite sees the
    schema it expects.

    🔑 THE MEASUREMENT IS THE METER BEFORE AND AFTER. If the reserve committed
    while the row was discarded, the count moves and this fails. That is not a
    hypothetical failure mode: an EXCEPTION block added around the insert would
    cause exactly it, because a handler is an implicit subtransaction — and every
    structural rule in this file would still pass.
  */
  const { eventId, seatId, userId, dedicated } = await seedFundedSeat(10);
  assert.ok(dedicated >= 5, `the fixture gave the camera ${dedicated} credits — it needs at least 5`);

  const before = await seatPointsUsed(seatId);
  const poolBefore = await poolRemaining(eventId);
  assert.equal(before, 0, 'the fixture seat has already spent credits — the delta below means nothing');

  await db.query(
    `ALTER TABLE public.papic_photos
       ADD CONSTRAINT papic_photos_atomicity_probe
       CHECK (r2_object_key <> 'r2://atomicity-probe')`,
  );
  try {
    let threw = false;
    try {
      await db.query(
        `SELECT public.papic_record_seat_capture(
           $1::uuid, $2::uuid, $3::uuid, 'r2://atomicity-probe', 'photo', NULL, 5)`,
        [seatId, eventId, userId],
      );
    } catch {
      threw = true;
    }
    // ⚠ ANTI-VACUITY. If the probe constraint stopped biting, the capture would
    // SUCCEED and the "meter did not move" assertion below would be false for a
    // completely different reason — so the failure itself is asserted first.
    assert.equal(
      threw,
      true,
      'the probe capture was accepted — the constraint did not bite, so the ' +
        'rollback measured below proves nothing',
    );
  } finally {
    await db.query(
      `ALTER TABLE public.papic_photos DROP CONSTRAINT papic_photos_atomicity_probe`,
    );
  }

  const after = await seatPointsUsed(seatId);
  assert.equal(
    after,
    before,
    `the credit spend SURVIVED a failed insert (${before} → ${after}). The ` +
      `reserve and the row are not in one transaction any more — most likely an ` +
      `EXCEPTION block was added around the insert, which is an implicit ` +
      `subtransaction and commits the reserve while discarding the row. A couple ` +
      `is now charged for a photograph that does not exist.`,
  );
  assert.equal(
    await poolRemaining(eventId),
    poolBefore,
    'the shared pot moved on a failed insert — the other half of the same spend',
  );

  const { rows: photos } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_photos WHERE paparazzi_seat_id = $1`,
    [seatId],
  );
  assert.equal(photos[0]?.n, 0, 'a photo row survived the failed insert');
});

test('5 · a successful capture spends exactly once and returns its row', async () => {
  const { eventId, seatId, userId, dedicated } = await seedFundedSeat(10);
  assert.ok(dedicated >= 3, `the fixture gave the camera ${dedicated} credits — it needs at least 3`);

  const { rows } = await db.query<{ result: { status?: string; photo_id?: string } }>(
    `SELECT public.papic_record_seat_capture(
       $1::uuid, $2::uuid, $3::uuid, 'r2://ok.jpg', 'photo', NULL, 3) AS result`,
    [seatId, eventId, userId],
  );
  assert.equal(rows[0]?.result?.status, 'ok', 'a legitimate capture was refused');
  assert.ok(
    rows[0]?.result?.photo_id,
    'the capture returned no photo id — tagging is then unavailable on the shot just taken',
  );
  assert.equal(
    await seatPointsUsed(seatId),
    3,
    "the capture did not spend from the camera's own credits, or spent twice",
  );

  const { rows: photos } = await db.query<{ n: number; kind: string }>(
    `SELECT count(*)::int AS n, max(photo_type) AS kind
       FROM public.papic_photos WHERE paparazzi_seat_id = $1`,
    [seatId],
  );
  assert.equal(photos[0]?.n, 1, 'the photo row is missing after an ok capture');
  assert.equal(photos[0]?.kind, 'photo', 'the capture was written as the wrong kind');
});

test('6 · an exhausted meter spends NOTHING and writes NOTHING', async () => {
  const { eventId, seatId, userId, dedicated, poolLeft } = await seedFundedSeat(4);

  // 🔑 THE COST IS COMPUTED FROM WHAT IS ACTUALLY THERE, not a number chosen by
  // hand. One credit past everything the camera and the pot hold between them is
  // the only cost that is guaranteed to be refused whatever the free grant is
  // set to this month — and the camera's own leg is deliberately affordable, so
  // this also proves the refusal does not consume it on the way to failing.
  const cost = dedicated + poolLeft + 1;
  assert.ok(dedicated > 0, 'the camera holds no credits of its own — the leg below is not exercised');

  const { rows } = await db.query<{ result: { status?: string } }>(
    `SELECT public.papic_record_seat_capture(
       $1::uuid, $2::uuid, $3::uuid, 'r2://too-dear.mp4', 'clip', 'r2://p.jpg', $4::int) AS result`,
    [seatId, eventId, userId, cost],
  );
  assert.equal(rows[0]?.result?.status, 'exhausted', 'a capture beyond the balance was accepted');
  assert.equal(
    await seatPointsUsed(seatId),
    0,
    "a refused capture consumed the camera's own credits — the pool leg runs " +
      'first precisely so that cannot happen',
  );
  assert.equal(await poolRemaining(eventId), poolLeft, 'a refused capture moved the shared pot');

  const { rows: photos } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_photos WHERE paparazzi_seat_id = $1`,
    [seatId],
  );
  assert.equal(photos[0]?.n, 0, 'a refused capture still wrote a photo');
});

test('7 · 🚨 the caller identity is CHECKED, not trusted', async () => {
  /*
    The action resolves the seat under the caller's own session, so RLS scopes
    the lookup — but a SECURITY DEFINER function that trusts its arguments has no
    fence of its own beyond the discipline of its callers. Each of these three is
    a real way a wrong argument could arrive: a stranger's id, another
    celebration's pot, a camera that was handed on.
  */
  const a = await seedFundedSeat(10);
  const b = await seedFundedSeat(10);

  const wrongPerson = await db.query<{ result: { status?: string } }>(
    `SELECT public.papic_record_seat_capture(
       $1::uuid, $2::uuid, $3::uuid, 'r2://forged.jpg', 'photo', NULL, 1) AS result`,
    [a.seatId, a.eventId, b.userId],
  );
  assert.equal(
    wrongPerson.rows[0]?.result?.status,
    'not_your_seat',
    "somebody else's account recorded a capture on this seat",
  );

  const wrongEvent = await db.query<{ result: { status?: string } }>(
    `SELECT public.papic_record_seat_capture(
       $1::uuid, $2::uuid, $3::uuid, 'r2://cross.jpg', 'photo', NULL, 1) AS result`,
    [a.seatId, b.eventId, a.userId],
  );
  assert.equal(
    wrongEvent.rows[0]?.result?.status,
    'not_your_seat',
    "one celebration's camera charged another celebration's pot — a seat id is " +
      'not a capability',
  );

  await db.query(`UPDATE public.paparazzi_seats SET revoked_at = NOW() WHERE seat_id = $1`, [
    a.seatId,
  ]);
  const revoked = await db.query<{ result: { status?: string } }>(
    `SELECT public.papic_record_seat_capture(
       $1::uuid, $2::uuid, $3::uuid, 'r2://revoked.jpg', 'photo', NULL, 1) AS result`,
    [a.seatId, a.eventId, a.userId],
  );
  assert.equal(
    revoked.rows[0]?.result?.status,
    'revoked',
    'a revoked camera kept shooting — the host took it back and it did not stop',
  );

  assert.equal(await seatPointsUsed(a.seatId), 0, 'a refused capture moved the meter');
});

test('8 · 🪤 the function never asks `current_user` who the caller is', () => {
  /*
    `current_user` inside a SECURITY DEFINER function is the function's OWNER,
    never the caller — so a gate written with it can never be true about the
    person shooting. `tg_stamp_capturer_person` shipped exactly that bug in its
    first cut: the gate could not fire, and the forgery test moved the photo while
    the trigger watched. Second time this project has paid for it.

    ⚠ READ OFF THE MIGRATION FILE, not out of the replay: what is being defended
    is the text somebody will edit.

    🪤 AND SCOPED TO THE DOLLAR-QUOTED BODY, WHICH THE FIRST CUT WAS NOT — it
    went red on its own explanation. Stripping `--` comments is not enough here,
    because the `COMMENT ON FUNCTION` beside it is a SQL *string literal* saying
    "never current_user, which inside a SECURITY DEFINER function is this
    function's OWNER". Prose that describes a rule is not a violation of it, and
    a guard that cannot tell the difference teaches you to skim past the one time
    it is right.
  */
  const src = readFileSync(
    new URL(
      '../../../../supabase/migrations/20271170528490_seat_capture_is_one_transaction.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const body = /\$function\$([\s\S]*?)\$function\$/.exec(src)?.[1] ?? '';
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '');

  assert.ok(
    stripped.includes('papic_reserve_capture_split'),
    'the function body could not be located in the migration — this rule is vacuous',
  );
  assert.equal(
    /\bcurrent_user\b/.test(stripped),
    false,
    'papic_record_seat_capture uses current_user. Inside a SECURITY DEFINER ' +
      "function that is the function's OWNER, never the caller — a gate written " +
      'with it silently never fires. Identity arrives as p_claimer_user_id.',
  );
  assert.equal(
    /\bauth\.uid\(\)/.test(stripped),
    false,
    'papic_record_seat_capture reads auth.uid(). It is called with the SERVICE ' +
      'ROLE, where there is no JWT — the value is NULL and every capture would ' +
      'be refused.',
  );
});
