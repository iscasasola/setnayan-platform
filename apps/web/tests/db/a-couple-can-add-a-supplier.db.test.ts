/**
 * A COUPLE CAN ADD A SUPPLIER — and still cannot forge one that arrives done.
 *
 * ── THE DEFECT THIS PINS ───────────────────────────────────────────────────
 * `guard_event_vendor_completion` (20271105038066) refused a session-role
 * INSERT whose `NEW.completion_status IS NOT NULL`. That column is
 * `NOT NULL DEFAULT 'awaiting_vendor'`, and a column default is applied when
 * the tuple is FORMED — before any BEFORE ROW trigger runs. So the condition
 * was true on every insert by anybody, and **every couple-authored booking was
 * refused** for roughly five weeks: `createVendor`,
 * `attachManualVendorToCategory`, `attachMarketplaceVendorToCategory` and
 * BA7's own "name a supplier" fork, all of them session-client inserts.
 *
 * Measured in production 2026-09-03: 45 rows in `event_vendors`, the newest
 * created 2026-07-30, ZERO created since. An `authenticated` INSERT naming no
 * completion column at all, run against prod inside a rolled-back transaction,
 * came back `INSERT REFUSED`.
 *
 * ── WHY IT NEEDS A DB TEST AND NOT A SOURCE ONE ────────────────────────────
 * 🔑 EVERY SERVER ACTION SPELLED THE INSERT CORRECTLY. Typecheck, lint, a
 * source scan and a code review all pass on a feature that cannot write a row,
 * because the refusal lives in the schema. The only assertion that can see it
 * is one that PERFORMS the write as the couple.
 *
 * ── BOTH HALVES, OR THIS IS JUST A HOLE ────────────────────────────────────
 * A test that only proved the insert lands would be satisfied by deleting the
 * guard. So the forged values are asserted too: a booking that ARRIVES marked
 * `confirmed` is still refused, and the column still cannot be changed on
 * UPDATE. The fix permits exactly one more value than before — the column's own
 * default, which the guard's own HINT calls the correct starting state.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function setAuthRole(role: string | null) {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function reset() {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function asCouple(uid: string) {
  await reset();
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

async function seed(tag: string): Promise<{ couple: string; eventId: string }> {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`add-supplier-${tag}@example.com`],
  );
  const couple = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ($1,'wedding','civil','garden') RETURNING event_id`,
    [`Add Supplier ${tag}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, couple],
  );
  return { couple, eventId };
}

/** Attempt the insert as the couple. Returns 'ok' or the refusal message. */
async function tryAddVendor(
  couple: string,
  eventId: string,
  extraCols = '',
  extraVals = '',
): Promise<string> {
  await asCouple(couple);
  const out = await db
    .query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status${extraCols})
       VALUES ($1,'rings','Ilaya Jewellers','contracted'${extraVals})`,
      [eventId],
    )
    .then(() => 'ok')
    .catch((e: Error) => e.message);
  await reset();
  return out;
}

test('the column default is real — this test would be vacuous without it', () => {
  return (async () => {
    await reset();
    const r = await db.query<{ column_default: string | null; is_nullable: string }>(
      `SELECT column_default, is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='event_vendors'
         AND column_name='completion_status'`,
    );
    // If this ever stops being a NOT NULL column with a default, the guard's
    // condition must be re-read — the whole defect below is a consequence of
    // these two facts.
    assert.equal(r.rows[0]!.is_nullable, 'NO');
    assert.match(String(r.rows[0]!.column_default), /awaiting_vendor/);
  })();
});

test('a couple can add a supplier at all — the five-week outage', () => {
  return (async () => {
    const w = await seed('lands');
    const out = await tryAddVendor(w.couple, w.eventId);
    assert.equal(
      out,
      'ok',
      `a couple still cannot add a supplier to their own wedding: ${out}`,
    );

    await reset();
    const row = await db.query<{ status: string; completion_status: string }>(
      `SELECT status, completion_status FROM public.event_vendors WHERE event_id = $1`,
      [w.eventId],
    );
    assert.equal(row.rows[0]!.status, 'contracted');
    // The row starts with no completion state, which is the whole point — the
    // guard's own HINT calls this the correct starting value.
    assert.equal(row.rows[0]!.completion_status, 'awaiting_vendor');
  })();
});

test('a booking that ARRIVES already confirmed is still refused', () => {
  return (async () => {
    const w = await seed('forged');
    // Each of the four columns, forged on INSERT. All four must still bounce —
    // otherwise the fix above is a hole, not a repair.
    for (const [cols, vals] of [
      [', completion_status', `, 'confirmed'`],
      [', completion_status', `, 'auto_confirmed'`],
      [', service_marked_complete_at', ', NOW()'],
      [', customer_confirmed_received_at', ', NOW()'],
      [', completion_disputed_at', ', NOW()'],
    ] as const) {
      const out = await tryAddVendor(w.couple, w.eventId, cols, vals);
      assert.match(
        out,
        /completion columns record who did what/,
        `a couple forged${cols} on insert: ${out}`,
      );
    }

    await reset();
    const n = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM public.event_vendors WHERE event_id = $1`,
      [w.eventId],
    );
    assert.equal(n.rows[0]!.n, 0, 'a forged booking landed anyway');
  })();
});

test('the couple still cannot change completion state on UPDATE', () => {
  return (async () => {
    const w = await seed('update');
    assert.equal(await tryAddVendor(w.couple, w.eventId), 'ok');

    await asCouple(w.couple);
    const out = await db
      .query(
        `UPDATE public.event_vendors SET completion_status = 'confirmed' WHERE event_id = $1`,
        [w.eventId],
      )
      .then(() => 'ok')
      .catch((e: Error) => e.message);
    await reset();
    assert.match(
      out,
      /completion columns record who did what/,
      `a couple marked their own booking confirmed: ${out}`,
    );

    // And it really did not move — the UPDATE branch is untouched by the fix.
    const row = await db.query<{ completion_status: string }>(
      `SELECT completion_status FROM public.event_vendors WHERE event_id = $1`,
      [w.eventId],
    );
    assert.equal(row.rows[0]!.completion_status, 'awaiting_vendor');
  })();
});

test('the guard is still SECURITY INVOKER — a DEFINER one is permanently inert', () => {
  return (async () => {
    await reset();
    const r = await db.query<{ prosecdef: boolean }>(
      `SELECT prosecdef FROM pg_proc WHERE proname = 'guard_event_vendor_completion'`,
    );
    // Inside a SECURITY DEFINER function `current_user` is the function's
    // OWNER, so `current_user IN ('authenticated','anon')` could never match
    // and the guard would refuse nothing while looking correct.
    assert.equal(r.rows[0]!.prosecdef, false, 'the guard was "hardened" into inertness');
  })();
});
