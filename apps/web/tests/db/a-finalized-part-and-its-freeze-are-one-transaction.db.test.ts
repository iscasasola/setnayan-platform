/**
 * A FINALIZED PART AND ITS FREEZE ARE ONE TRANSACTION — IN BOTH DIRECTIONS (MB12).
 *
 * MB12's brief asked for the WIRING to be guarded, not only the pieces: "find
 * the seam where a part could be finalized without freezing, or frozen without
 * being finalized, and pin THAT specifically." This is that pin, plus the
 * state machine every transition of it can reach.
 *
 * ── THE SEAM, AND WHY IT IS NOT A HYPOTHETICAL ────────────────────────────
 * "The supplier agreed" and "that part stops re-deriving from the couple's
 * five main colours" are two writes to two tables. Split them and both
 * failures are invisible:
 *
 *   · AGREED, NOT FROZEN — the couple edits a major, every untouched role
 *     re-derives, and the design the supplier signed off on quietly becomes a
 *     different design. Nothing renders differently. The supplier builds what
 *     they agreed to and it is wrong on the day.
 *   · FROZEN, NOT AGREED — a role stops following the majors and no surface
 *     anywhere can say why. The couple's "Match my main colours again" does
 *     nothing and looks broken.
 *
 * `vendor_agree_to_part` closes both by doing the pair in ONE function body,
 * i.e. one transaction. `vendor_answer_part_reopen` welds the release the same
 * way. And `events_hold_part_finalization_freeze` is the backstop for the
 * OTHER writers of `events.role_palette` — the board's own debounced save, a
 * theme apply, the wizard, an admin repair — because a guard on one writer is
 * a guard on one writer.
 *
 * ⚠ WHY THIS IS A `*.db.test.ts` AND NOT A UNIT TEST. Every claim here is about
 * transaction boundaries, triggers and RLS. DDL that PARSES is not DDL that
 * BEHAVES, and no amount of TypeScript can observe that a palette write was
 * rewritten on its way into the table. `ugat-schema-claims` proves these
 * objects EXIST, which is exactly why it cannot notice that one of them agrees
 * without freezing.
 */

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

const SNAPSHOT = {
  palette: { bride: ['#AA1122'], wedding_party: ['#334455'] },
  room_dressing: { linens: '#C0FFEE' },
};

async function newUser(email: string, type = 'customer'): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, type],
  );
  return u.rows[0]!.id;
}

async function newShop(email: string): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Bloom & Vine', 'Manila', ARRAY['florist']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

async function newEvent(label: string): Promise<{ eventId: string; coupleUid: string }> {
  const coupleUid = await newUser(`couple-${label}@mb12.test`);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1,'celebration')
     RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUid],
  );
  return { eventId, coupleUid };
}

async function newBooking(
  eventId: string,
  vpid: string,
  status: string,
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'florist'::public.vendor_category,'Bloom & Vine',
             $2::public.vendor_status, $3)
     RETURNING vendor_id`,
    [eventId, status, vpid],
  );
  return r.rows[0]!.vendor_id;
}

async function ask(
  eventId: string,
  vendorId: string,
  partId = 'people:bride',
): Promise<{ status?: string; finalization_id?: string; current?: string }> {
  const r = await db.query<{ out: { status?: string; finalization_id?: string; current?: string } }>(
    `SELECT public.request_part_finalization($1,$2,$3,$4::jsonb) AS out`,
    [eventId, partId, vendorId, JSON.stringify(SNAPSHOT)],
  );
  return r.rows[0]!.out;
}

async function readRow(id: string) {
  const r = await db.query<{
    state: string;
    expires_at: string | null;
    agreed_at: string | null;
    reopen_state: string | null;
    frozen_palette_keys: string[];
    frozen_dressing_fields: string[];
    decline_reason: string | null;
  }>(
    `SELECT state, expires_at, agreed_at, reopen_state, frozen_palette_keys,
            frozen_dressing_fields, decline_reason
       FROM public.moodboard_part_finalizations WHERE finalization_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

async function readPalette(eventId: string): Promise<Record<string, unknown>> {
  const r = await db.query<{ p: Record<string, unknown> }>(
    `SELECT role_palette AS p FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  return r.rows[0]!.p ?? {};
}

/** Age the ask past its own 48-hour fuse, without touching state. */
async function lapse(id: string, column = 'expires_at'): Promise<void> {
  await db.query(
    `UPDATE public.moodboard_part_finalizations
        SET ${column} = NOW() - INTERVAL '1 minute' WHERE finalization_id = $1`,
    [id],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

/* ═══════════════════════════════════════════════════════════════════════════
   1 · NO FINALIZE WITHOUT A BOOKED SUPPLIER — AT THE DATABASE
   ═══════════════════════════════════════════════════════════════════════════ */

test('a supplier who is merely being considered cannot be asked to agree, and nothing is written', async () => {
  const { eventId, coupleUid } = await newEvent('unbooked');
  const { vpid } = await newShop('unbooked@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'considering');
  await setAuthUid(db, coupleUid);

  const out = await ask(eventId, vendorId);
  assert.equal(out.status, 'not_booked', 'a shortlisted shop must not be askable');
  assert.equal(out.current, 'considering');

  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.moodboard_part_finalizations`,
  );
  assert.equal(n.rows[0]!.c, '0', 'a refused ask must leave no row behind');
});

test('the couple cannot INSERT a finalization by hand — the refusal is not only in the action', async () => {
  const { eventId, coupleUid } = await newEvent('noinsert');
  const { vpid } = await newShop('noinsert@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'considering');

  // 🔑 THE POINT OF THIS ASSERTION. If the couple held an INSERT grant, every
  // check in `request_part_finalization` would be advisory: a client could
  // simply write the row it wanted, including one that says the supplier
  // already agreed. `authenticated` holds no INSERT on this table at all.
  await db.exec(`SET ROLE authenticated`);
  await setAuthUid(db, coupleUid);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.moodboard_part_finalizations
           (event_id, part_id, vendor_id, state, design_snapshot, agreed_at)
         VALUES ($1,'people:bride',$2,'agreed','{}'::jsonb, NOW())`,
        [eventId, vendorId],
      ),
    /permission denied|violates row-level security/i,
    'a couple must not be able to manufacture a supplier’s agreement',
  );
  await db.exec('RESET ROLE');
});

test('a booking on somebody else’s celebration cannot be aimed at this board', async () => {
  const a = await newEvent('mine');
  const b = await newEvent('theirs');
  const { vpid } = await newShop('crossevent@mb12.test');
  const theirBooking = await newBooking(b.eventId, vpid, 'contracted');
  await setAuthUid(db, a.coupleUid);

  await assert.rejects(
    () => ask(a.eventId, theirBooking),
    /booking_not_on_this_event/,
    'a couple must not be able to ask a supplier who is not on their event',
  );
});

test('all four CONFIRMED statuses may be asked, and only those four', async () => {
  for (const status of ['contracted', 'deposit_paid', 'delivered', 'complete']) {
    const { eventId, coupleUid } = await newEvent(`ok-${status}`);
    const { vpid } = await newShop(`ok-${status}@mb12.test`);
    const vendorId = await newBooking(eventId, vpid, status);
    await setAuthUid(db, coupleUid);
    const out = await ask(eventId, vendorId);
    assert.equal(out.status, 'ok', `${status} is a real booking and must be askable`);
  }
  // The other two members of the enum, exhaustively — 'considering' and
  // 'shortlisted' are the whole of \`vendor_status\` outside CONFIRMED_VENDOR_STATUSES.
  for (const status of ['considering', 'shortlisted']) {
    const { eventId, coupleUid } = await newEvent(`no-${status}`);
    const { vpid } = await newShop(`no-${status}@mb12.test`);
    const vendorId = await newBooking(eventId, vpid, status);
    await setAuthUid(db, coupleUid);
    const out = await ask(eventId, vendorId);
    assert.equal(out.status, 'not_booked', `${status} is not a booking and must be refused`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · THE WELD — agreeing freezes, in one act
   ═══════════════════════════════════════════════════════════════════════════ */

test('agreeing flips the row AND freezes the palette, and neither half is reachable alone', async () => {
  const { eventId, coupleUid } = await newEvent('weld');
  const { vpid, uid } = await newShop('weld@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');

  await setAuthUid(db, coupleUid);
  const asked = await ask(eventId, vendorId);
  const id = asked.finalization_id!;

  // Before the answer: asked, and NOTHING frozen. An ask is not an agreement.
  let palette = await readPalette(eventId);
  assert.equal(palette.touched_roles, undefined, 'an ask must freeze nothing');

  await setAuthUid(db, uid);
  const agreed = await db.query<{ out: { status?: string } }>(
    `SELECT public.vendor_agree_to_part($1) AS out`,
    [id],
  );
  assert.equal(agreed.rows[0]!.out.status, 'ok');

  const row = await readRow(id);
  assert.equal(row.state, 'agreed');
  assert.ok(row.agreed_at, 'an agreed row with no agreed_at is a row nothing can date');

  palette = await readPalette(eventId);
  const touched = palette.touched_roles as string[];
  assert.ok(touched.includes('bride'), 'the agreed role must be frozen');
  assert.ok(touched.includes('wedding_party'), 'every key in the snapshot must be frozen');
  assert.deepEqual(
    (palette.bride as string[]) ?? [],
    ['#AA1122'],
    'the frozen role must carry the colours that were AGREED, not whatever is on the board now',
  );
  assert.equal(
    (palette.room_dressing as Record<string, string>).linens,
    '#C0FFEE',
    'the room-dressing override is the other half of the freeze',
  );
  assert.deepEqual(
    [...row.frozen_palette_keys].sort(),
    ['bride', 'wedding_party'],
    'the row must record what IT froze, so a re-open releases exactly that',
  );
  assert.deepEqual(row.frozen_dressing_fields, ['linens']);
});

test('a role the couple already touched by hand is NOT recorded as ours, so a re-open cannot discard it', async () => {
  const { eventId, coupleUid } = await newEvent('theirs-stays');
  const { vpid, uid } = await newShop('theirs@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');

  // The couple hand-edited `bride` long before anybody was asked.
  await db.query(
    `UPDATE public.events
        SET role_palette = '{"bride":["#FFFFFF"],"touched_roles":["bride"]}'::jsonb
      WHERE event_id = $1`,
    [eventId],
  );

  await setAuthUid(db, coupleUid);
  const id = (await ask(eventId, vendorId)).finalization_id!;
  await setAuthUid(db, uid);
  await db.query(`SELECT public.vendor_agree_to_part($1)`, [id]);

  const row = await readRow(id);
  assert.deepEqual(
    row.frozen_palette_keys,
    ['wedding_party'],
    'bride was already the couple’s own — claiming it would let a re-open delete their edit',
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   3 · THE BACKSTOP — no other writer can drop the freeze
   ═══════════════════════════════════════════════════════════════════════════ */

test('a palette write that forgets the freeze has it put back, from any path', async () => {
  const { eventId, coupleUid } = await newEvent('backstop');
  const { vpid, uid } = await newShop('backstop@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  const id = (await ask(eventId, vendorId)).finalization_id!;
  await setAuthUid(db, uid);
  await db.query(`SELECT public.vendor_agree_to_part($1)`, [id]);

  // 🔑 THE WRITE THE BOARD'S DEBOUNCED SAVE ACTUALLY MAKES: the WHOLE blob,
  // replaced. A client that has never heard of finalization sends exactly this.
  await db.query(
    `UPDATE public.events
        SET role_palette = '{"bride":["#000000"],"reception":["#123456"]}'::jsonb
      WHERE event_id = $1`,
    [eventId],
  );

  const palette = await readPalette(eventId);
  assert.ok(
    (palette.touched_roles as string[]).includes('bride'),
    'the freeze marker must survive a writer that dropped it',
  );
  assert.deepEqual(
    palette.bride,
    ['#AA1122'],
    'and so must the AGREED colours — restoring the marker while letting the colour be overwritten ' +
      'would freeze the role at whatever the last writer happened to say',
  );
  assert.equal(
    (palette.reception as string[])[0],
    '#123456',
    'everything NOT frozen still writes normally — the backstop must not be a wall',
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   4 · THE STATE MACHINE — every transition, including expiry
   ═══════════════════════════════════════════════════════════════════════════ */

test('the fuse is materialized, and it is 48 hours', async () => {
  const { eventId, coupleUid } = await newEvent('fuse');
  const { vpid } = await newShop('fuse@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  const id = (await ask(eventId, vendorId)).finalization_id!;

  const r = await db.query<{ h: string }>(
    `SELECT EXTRACT(EPOCH FROM (expires_at - requested_at))/3600 AS h
       FROM public.moodboard_part_finalizations WHERE finalization_id = $1`,
    [id],
  );
  assert.equal(
    Math.round(Number(r.rows[0]!.h)),
    48,
    'the window a person is SHOWN must be the window that is enforced',
  );
});

test('a lapsed ask expires on the answer path, refuses, and frees the slot for a fresh one', async () => {
  const { eventId, coupleUid } = await newEvent('expiry');
  const { vpid, uid } = await newShop('expiry@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  const id = (await ask(eventId, vendorId)).finalization_id!;
  await lapse(id);

  await setAuthUid(db, uid);
  const out = await db.query<{ out: { status?: string } }>(
    `SELECT public.vendor_agree_to_part($1) AS out`,
    [id],
  );
  assert.equal(out.rows[0]!.out.status, 'expired', 'answering too late must refuse');
  assert.equal((await readRow(id)).state, 'expired', 'and must FLIP the row, not merely refuse');

  const palette = await readPalette(eventId);
  assert.equal(palette.touched_roles, undefined, 'an expired ask must freeze nothing');

  // 🔑 FLIPPING RATHER THAN REFUSING IS WHAT MAKES A RE-ASK POSSIBLE — the
  // one-live-handshake index only counts pending and agreed rows.
  await setAuthUid(db, coupleUid);
  const again = await ask(eventId, vendorId);
  assert.equal(again.status, 'ok', 'a lapsed round must not block the part forever');
});

test('a re-ask gets a FRESH fuse rather than inheriting the dead one', async () => {
  const { eventId, coupleUid } = await newEvent('refuse');
  const { vpid, uid } = await newShop('refuse@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  const first = (await ask(eventId, vendorId)).finalization_id!;
  await setAuthUid(db, uid);
  await db.query(`SELECT public.vendor_decline_part($1,'not in November')`, [first]);

  await setAuthUid(db, coupleUid);
  const second = (await ask(eventId, vendorId)).finalization_id!;
  const r = await db.query<{ fresh: boolean }>(
    `SELECT expires_at > NOW() + INTERVAL '47 hours' AS fresh
       FROM public.moodboard_part_finalizations WHERE finalization_id = $1`,
    [second],
  );
  assert.equal(
    r.rows[0]!.fresh,
    true,
    'a second round born already expired would give the supplier no chance at all',
  );
});

test('declining records the supplier’s own words, freezes nothing, and frees the slot', async () => {
  const { eventId, coupleUid } = await newEvent('decline');
  const { vpid, uid } = await newShop('decline@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  const id = (await ask(eventId, vendorId)).finalization_id!;

  await setAuthUid(db, uid);
  const out = await db.query<{ out: { status?: string } }>(
    `SELECT public.vendor_decline_part($1,'We cannot source that peony in November') AS out`,
    [id],
  );
  assert.equal(out.rows[0]!.out.status, 'ok');
  const row = await readRow(id);
  assert.equal(row.state, 'declined');
  assert.equal(row.decline_reason, 'We cannot source that peony in November');
  assert.equal((await readPalette(eventId)).touched_roles, undefined);
});

test('the couple may withdraw a QUESTION and may never withdraw an ANSWER', async () => {
  const { eventId, coupleUid } = await newEvent('withdraw');
  const { vpid, uid } = await newShop('withdraw@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');

  await setAuthUid(db, coupleUid);
  const pending = (await ask(eventId, vendorId)).finalization_id!;
  const w = await db.query<{ out: { status?: string } }>(
    `SELECT public.cancel_part_finalization_request($1) AS out`,
    [pending],
  );
  assert.equal(w.rows[0]!.out.status, 'ok');
  assert.equal((await readRow(pending)).state, 'cancelled');

  const agreedId = (await ask(eventId, vendorId)).finalization_id!;
  await setAuthUid(db, uid);
  await db.query(`SELECT public.vendor_agree_to_part($1)`, [agreedId]);
  await setAuthUid(db, coupleUid);

  // 🔑 IF THIS SUCCEEDED, THE COUNTER-HANDSHAKE WOULD BE DECORATIVE.
  const nope = await db.query<{ out: { status?: string; current?: string } }>(
    `SELECT public.cancel_part_finalization_request($1) AS out`,
    [agreedId],
  );
  assert.equal(nope.rows[0]!.out.status, 'not_pending');
  assert.equal(nope.rows[0]!.out.current, 'agreed');
  assert.equal((await readRow(agreedId)).state, 'agreed', 'the agreement must still stand');
  assert.ok(
    ((await readPalette(eventId)).touched_roles as string[]).includes('bride'),
    'and the freeze with it',
  );
});

test('a stranger cannot answer somebody else’s ask', async () => {
  const { eventId, coupleUid } = await newEvent('stranger');
  const { vpid } = await newShop('owner@mb12.test');
  const other = await newShop('stranger@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  const id = (await ask(eventId, vendorId)).finalization_id!;

  await setAuthUid(db, other.uid);
  await assert.rejects(
    () => db.query(`SELECT public.vendor_agree_to_part($1)`, [id]),
    /not_your_booking/,
  );
  await assert.rejects(
    () => db.query(`SELECT public.request_part_reopen($1)`, [id]),
    /not_your_event/,
  );
});

test('one part holds at most one live handshake', async () => {
  const { eventId, coupleUid } = await newEvent('onelive');
  const { vpid } = await newShop('onelive@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  await ask(eventId, vendorId);
  const second = await ask(eventId, vendorId);
  assert.equal(second.status, 'already');
  assert.equal(second.current, 'pending');
});

/* ═══════════════════════════════════════════════════════════════════════════
   5 · THE COUNTER-HANDSHAKE — re-open, and the release welded to it
   ═══════════════════════════════════════════════════════════════════════════ */

async function agreedFixture(label: string) {
  const { eventId, coupleUid } = await newEvent(label);
  const { vpid, uid } = await newShop(`${label}@mb12.test`);
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  const id = (await ask(eventId, vendorId)).finalization_id!;
  await setAuthUid(db, uid);
  await db.query(`SELECT public.vendor_agree_to_part($1)`, [id]);
  return { eventId, coupleUid, vendorUid: uid, id };
}

test('asking to re-open releases NOTHING by itself', async () => {
  const f = await agreedFixture('reopen-ask');
  await setAuthUid(db, f.coupleUid);
  const out = await db.query<{ out: { status?: string } }>(
    `SELECT public.request_part_reopen($1) AS out`,
    [f.id],
  );
  assert.equal(out.rows[0]!.out.status, 'ok');
  assert.equal((await readRow(f.id)).state, 'agreed', 'the part stays finalized while they wait');
  assert.ok(((await readPalette(f.eventId)).touched_roles as string[]).includes('bride'));
});

test('the supplier saying yes to a re-open releases the freeze and closes the finalization, together', async () => {
  const f = await agreedFixture('reopen-yes');
  await setAuthUid(db, f.coupleUid);
  await db.query(`SELECT public.request_part_reopen($1)`, [f.id]);
  await setAuthUid(db, f.vendorUid);
  const out = await db.query<{ out: { status?: string; reopened?: boolean } }>(
    `SELECT public.vendor_answer_part_reopen($1, TRUE, NULL) AS out`,
    [f.id],
  );
  assert.equal(out.rows[0]!.out.status, 'ok');
  assert.equal(out.rows[0]!.out.reopened, true);

  const row = await readRow(f.id);
  assert.equal(row.state, 'cancelled', 'the finalization is over');
  assert.equal(row.reopen_state, 'agreed', 'and the receipt says how');
  assert.deepEqual(row.frozen_palette_keys, [], 'it holds nothing any more');

  const palette = await readPalette(f.eventId);
  assert.deepEqual(palette.touched_roles, [], 'the roles follow the majors again');
  assert.equal(
    (palette.room_dressing as Record<string, string>).linens,
    undefined,
    'and so does the room dressing',
  );
  assert.deepEqual(
    palette.bride,
    ['#AA1122'],
    'the stored colours stay — releasing a role must not blank its swatches, and the record of ' +
      'what was agreed is worth keeping',
  );

  // The slot is free, so the couple can redesign and ask again.
  await setAuthUid(db, f.coupleUid);
  const again = await db.query<{ out: { status?: string } }>(
    `SELECT public.request_part_finalization($1,'people:bride',
       (SELECT vendor_id FROM public.moodboard_part_finalizations WHERE finalization_id=$2),
       '{}'::jsonb) AS out`,
    [f.eventId, f.id],
  );
  assert.equal(again.rows[0]!.out.status, 'ok');
});

test('the supplier saying no leaves the part frozen, in their own words', async () => {
  const f = await agreedFixture('reopen-no');
  await setAuthUid(db, f.coupleUid);
  await db.query(`SELECT public.request_part_reopen($1)`, [f.id]);
  await setAuthUid(db, f.vendorUid);
  await db.query(`SELECT public.vendor_answer_part_reopen($1, FALSE, 'It is already cut')`, [f.id]);

  const row = await readRow(f.id);
  assert.equal(row.state, 'agreed');
  assert.equal(row.reopen_state, 'declined');
  assert.ok(((await readPalette(f.eventId)).touched_roles as string[]).includes('bride'));
});

test('an unanswered re-open EXPIRES and the part stays frozen — silence is not consent either way', async () => {
  const f = await agreedFixture('reopen-expiry');
  await setAuthUid(db, f.coupleUid);
  await db.query(`SELECT public.request_part_reopen($1)`, [f.id]);
  await lapse(f.id, 'reopen_expires_at');

  await setAuthUid(db, f.vendorUid);
  const out = await db.query<{ out: { status?: string } }>(
    `SELECT public.vendor_answer_part_reopen($1, TRUE, NULL) AS out`,
    [f.id],
  );
  assert.equal(out.rows[0]!.out.status, 'expired');

  const row = await readRow(f.id);
  assert.equal(row.state, 'agreed', 'nobody answering must not release work somebody planned around');
  assert.equal(row.reopen_state, 'expired');
  assert.ok(((await readPalette(f.eventId)).touched_roles as string[]).includes('bride'));

  // …and the couple may ask again: the expired round frees reopen_state.
  await setAuthUid(db, f.coupleUid);
  const again = await db.query<{ out: { status?: string } }>(
    `SELECT public.request_part_reopen($1) AS out`,
    [f.id],
  );
  assert.equal(again.rows[0]!.out.status, 'ok');
});

test('the couple can withdraw a re-open, and the agreement survives it', async () => {
  const f = await agreedFixture('reopen-withdraw');
  await setAuthUid(db, f.coupleUid);
  await db.query(`SELECT public.request_part_reopen($1)`, [f.id]);
  const out = await db.query<{ out: { status?: string } }>(
    `SELECT public.cancel_part_reopen_request($1) AS out`,
    [f.id],
  );
  assert.equal(out.rows[0]!.out.status, 'ok');
  const row = await readRow(f.id);
  assert.equal(row.reopen_state, 'cancelled');
  assert.equal(row.state, 'agreed');
});

test('a re-open cannot be asked for on a part nobody has agreed to', async () => {
  const { eventId, coupleUid } = await newEvent('reopen-never');
  const { vpid } = await newShop('reopen-never@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  const id = (await ask(eventId, vendorId)).finalization_id!;
  const out = await db.query<{ out: { status?: string; current?: string } }>(
    `SELECT public.request_part_reopen($1) AS out`,
    [id],
  );
  assert.equal(out.rows[0]!.out.status, 'not_finalized');
  assert.equal(out.rows[0]!.out.current, 'pending');
});

/* ═══════════════════════════════════════════════════════════════════════════
   6 · IDEMPOTENCE — a double-click is not a second act
   ═══════════════════════════════════════════════════════════════════════════ */

test('answering twice reports "already" and changes nothing', async () => {
  const f = await agreedFixture('idem');
  await setAuthUid(db, f.vendorUid);
  const out = await db.query<{ out: { status?: string } }>(
    `SELECT public.vendor_agree_to_part($1) AS out`,
    [f.id],
  );
  assert.equal(out.rows[0]!.out.status, 'already');
  assert.deepEqual((await readRow(f.id)).frozen_palette_keys.sort(), ['bride', 'wedding_party']);
});

test('a declined round cannot be revived by answering it again', async () => {
  const { eventId, coupleUid } = await newEvent('revive');
  const { vpid, uid } = await newShop('revive@mb12.test');
  const vendorId = await newBooking(eventId, vpid, 'contracted');
  await setAuthUid(db, coupleUid);
  const id = (await ask(eventId, vendorId)).finalization_id!;
  await setAuthUid(db, uid);
  await db.query(`SELECT public.vendor_decline_part($1,'no')`, [id]);

  const out = await db.query<{ out: { status?: string; current?: string } }>(
    `SELECT public.vendor_agree_to_part($1) AS out`,
    [id],
  );
  assert.equal(out.rows[0]!.out.status, 'not_pending');
  assert.equal(out.rows[0]!.out.current, 'declined');
  assert.equal((await readPalette(eventId)).touched_roles, undefined, 'and nothing froze');
});
