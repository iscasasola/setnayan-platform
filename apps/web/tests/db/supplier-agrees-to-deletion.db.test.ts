/**
 * GUARD — a supplier you have paid can agree to the deletion, and only they can.
 *
 * Owner 2026-08-21: *"they can only delete it if the vendors with paid purchase
 * accepts that this deletion."*
 *
 * Mirrors the lock handshake's shape. The load-bearing property is the one the
 * lock handshake learned the hard way: the ask and the answer are different
 * people, and the ASKER must not be able to write the ANSWER.
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

test('a session role cannot write the supplier’s answer', async () => {
  /*
    🔒 "THE ROW IS YOURS, THE FIELD IS NOT." Without a guard a couple could write
    delete_request_state='agreed' and answer on their supplier's behalf — the
    entire thing this handshake exists to prevent.

    🪤 TWO TRAPS IN WRITING THIS TEST, BOTH HIT:
    1. `REVOKE UPDATE (cols)` is INERT here — `authenticated` holds TABLE-LEVEL
       UPDATE and a column revoke cannot subtract from it. The control is a
       trigger. (The first cut of the migration used the revoke.)
    2. ASSERTING A THROW IS WRONG. Under RLS the UPDATE is filtered to zero rows
       and resolves happily — an RLS denial and a no-op are the same value — so
       `assert.rejects` failed with "missing expected rejection" while the data
       was perfectly safe. The test now asserts THE OUTCOME: the field did not
       move. That holds whichever mechanism refuses it, which is what we
       actually care about.
  */
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (slug, event_type, display_name)
     VALUES ('forge-probe', 'birthday', 'Forge Probe') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  const vend = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, vendor_name, status, category)
     VALUES ($1, 'Forge Supplier', 'deposit_paid', 'misc') RETURNING vendor_id`,
    [eventId],
  );
  const vendorId = vend.rows[0]!.vendor_id;

  /*
    🚨 THE ROLE ALONE IS NOT AN IDENTITY, AND WITHOUT ONE THIS TEST IS VACUOUS.
    The first cut only did `SET ROLE authenticated`. With no `auth.uid()`, the
    couple's RLS policy matched nothing, the UPDATE hit zero rows, and the test
    passed — but it passed because RLS denied an ANONYMOUS caller, not because
    the trigger works. Measured: deleting the trigger entirely left this GREEN.

    A forgery test has to be run by somebody RLS would otherwise ADMIT. This
    seeds a real couple member and speaks as them, so the trigger is the only
    thing left standing between them and their supplier's answer.
  */
  const uid = '00000000-0000-4000-8000-00000000f0f0';
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
    uid,
    'forge@probe.test',
  ]);
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
    uid,
    'forge@probe.test',
  ]);
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [eventId, uid],
  );

  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);

  const who = await db.query<{ u: string; uid: string | null }>(
    `SELECT current_user AS u, auth.uid()::text AS uid`,
  );
  assert.equal(who.rows[0]!.u, 'authenticated', 'the role switch did not take');
  assert.equal(
    who.rows[0]!.uid,
    uid,
    'auth.uid() is not the seeded couple member — RLS would refuse for the ' +
      'wrong reason and the trigger would never be exercised',
  );

  /*
    🪤 THIS BLOCK WAS ACCIDENTALLY DELETED BY AN EARLIER EDIT, and the test then
    passed while attempting NO FORGERY AT ALL — it read a value nobody had tried
    to change. Caught by a mutation: disabling the trigger left it green, and a
    direct probe proved the forgery then succeeds (STATE_AFTER=agreed).
    A test that asserts an outcome must first perform the ACT.
  */
  try {
    await db
      .query(
        `UPDATE public.event_vendors SET delete_request_state = 'agreed'
          WHERE vendor_id = $1`,
        [vendorId],
      )
      .catch(() => undefined); // refused by the trigger — the outcome is asserted below
    await db
      .query(
        `INSERT INTO public.event_vendors
           (event_id, vendor_name, status, category, delete_request_state)
         VALUES ($1, 'Born Agreed', 'deposit_paid', 'misc', 'agreed')`,
        [eventId],
      )
      .catch(() => undefined);
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db
      .query(`SELECT set_config('request.jwt.claim.role', '', false)`)
      .catch(() => {});
  }

  const after = await db.query<{ delete_request_state: string | null }>(
    `SELECT delete_request_state FROM public.event_vendors WHERE vendor_id = $1`,
    [vendorId],
  );
  assert.equal(
    after.rows[0]!.delete_request_state,
    null,
    'a session role moved the supplier’s answer to agreed — the couple could ' +
      'now delete the celebration on a consent they manufactured',
  );

  const born = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendors
      WHERE event_id = $1 AND delete_request_state IS NOT NULL`,
    [eventId],
  );
  /*
    ⚠ THIS HALF IS DEFENCE IN DEPTH, AND THE MUTATION CANNOT ISOLATE IT.
    Measured: a session INSERT into event_vendors is refused by a PRE-EXISTING
    guard first — "completion columns record who did what and are written only
    by the app backend" — so disabling MY insert branch leaves this assertion
    green. It is not decoration and it is not proven either: it is a second lock
    behind somebody else's door.

    It is kept because the lock handshake's own guard carries the identical
    branch and says why: `event_vendors_couple_write` is FOR ALL with no column
    list, so if that other guard is ever narrowed, a row BORN 'agreed' becomes
    reachable and manufactures a supplier's consent without an ask. Removing
    this because today's test cannot see it would be trading a real protection
    for a tidier mutation table.
  */
  assert.equal(
    born.rows[0]!.n,
    0,
    'a booking was created already carrying the supplier’s answer — a FOR ALL ' +
      'policy admits INSERT, so the answer can be manufactured without an ask',
  );
});

test('all three handshake functions exist and are SECURITY DEFINER', async () => {
  const { rows } = await db.query<{ proname: string; secdef: boolean }>(
    `SELECT proname, prosecdef AS secdef FROM pg_proc
      WHERE proname IN ('request_event_deletion',
                        'vendor_answer_event_deletion',
                        'cancel_event_deletion_request')
      ORDER BY proname`,
  );
  assert.equal(rows.length, 3, `expected 3 handshake functions, found ${rows.length}`);
  for (const r of rows) {
    assert.equal(r.secdef, true, `${r.proname} is not SECURITY DEFINER — the ` +
      'revoked columns are exactly what it needs definer rights to write');
  }
});

test('the ask has an inverse, and the app can reach both', async () => {
  // 🔑 A FORWARD PRIMITIVE WITH NO INVERSE. cancel_vendor_lock_request was
  // granted, commented, db-tested — and had ZERO CALLERS for its whole life, so
  // a couple could not un-ask. This pins that the withdraw exists and that
  // `authenticated` may actually call all three.
  for (const fn of [
    'request_event_deletion(uuid)',
    'vendor_answer_event_deletion(uuid, boolean, text)',
    'cancel_event_deletion_request(uuid)',
  ]) {
    const { rows } = await db.query<{ can: boolean }>(
      `SELECT has_function_privilege('authenticated', $1, 'EXECUTE') AS can`,
      [fn],
    );
    assert.equal(rows[0]!.can, true, `authenticated cannot EXECUTE ${fn}`);
  }
  const { rows: anon } = await db.query<{ can: boolean }>(
    `SELECT has_function_privilege('anon', 'request_event_deletion(uuid)', 'EXECUTE') AS can`,
  );
  assert.equal(anon[0]!.can, false, 'anon can start a deletion ask');
});

test('the state machine admits only the four real answers', async () => {
  /* These tests share one connection, so a role left set by an earlier test
     leaks into this one — it failed with an RLS refusal on `events` before this
     reset was added. Cheap insurance, and it names why. */
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (slug, event_type, display_name)
     VALUES ('handshake-probe', 'birthday', 'Handshake Probe') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  const vend = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, vendor_name, status, category)
     VALUES ($1, 'Probe Supplier', 'deposit_paid', 'misc') RETURNING vendor_id`,
    [eventId],
  );
  const vendorId = vend.rows[0]!.vendor_id;

  for (const good of ['pending', 'agreed', 'declined', 'cancelled']) {
    await db.query(
      `UPDATE public.event_vendors SET delete_request_state = $1 WHERE vendor_id = $2`,
      [good, vendorId],
    );
  }
  await assert.rejects(
    db.query(
      `UPDATE public.event_vendors SET delete_request_state = 'maybe' WHERE vendor_id = $1`,
      [vendorId],
    ),
    'an unrecognised state was accepted — the gate reads this column to decide ' +
      'whether a celebration may be destroyed',
  );
});
