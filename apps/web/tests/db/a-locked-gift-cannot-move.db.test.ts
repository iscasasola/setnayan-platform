/**
 * A LOCKED GIFT CANNOT MOVE (SUP-I) — against real SQL.
 *
 * ⚖ Owner 2026-09-15: freeze BOTH the promise and the number.
 * ⚖ Owner 2026-09-16, asked which of the two lock moments does it:
 *   **"both. the supplier needs to pay us before this becomes true."**
 *
 * ── WHAT WAS TRUE BEFORE, MEASURED AGAINST THE LIVE PROD TRIGGER ────────────
 * `setnayan_gift_offered` (the yes/no) was already frozen at charge-open, but
 * `gift_credits` was RE-DERIVED from the live catalogue on every UPDATE that
 * left the row `status='pending'` — freezing only at `paid`. So a couple could
 * be promised 1,429 photographs and be granted a different number.
 *
 * 🔑 AND AT THE LOCK THERE WAS NOTHING TO FREEZE ONTO. The charge row that
 * carries the gift is not INSERTed until the supplier ACKNOWLEDGES the couple's
 * deposit — two steps and an unbounded gap after the promise was made. The
 * promise therefore lives on `event_vendors`, which exists from the ask.
 *
 * ⚠ EVERY TEST HERE IS THE ONLY THING THAT HAS EVER RUN THIS PATH. Production
 * has 0 lock handshakes, 0 deposits, 0 charges and 0 cards with the gift on.
 * Nothing below is "confirming known-good behaviour".
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

/** The booking fee on a ₱50,000 booking, in centavos — the figure a charge carries. */
const FEE_ON_50K = 250_000;

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

/** A booking whose card says YES to the gift, priced at `php`. */
async function seedBooking(php: number, giftOn = true) {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday')
     RETURNING event_id`,
    [`lock gift ${n}`],
  );
  const vendorProfileId = await one<string>(
    `INSERT INTO public.vendor_profiles (business_name) VALUES ($1)
     RETURNING vendor_profile_id`,
    [`Shop ${n}`],
  );
  const serviceId = await one<string>(
    // is_active FALSE: an ACTIVE card must carry a cover photo (a real CHECK,
    // and the right one). `setnayan_gift_offered_on` does not read is_active —
    // it asks only that the card belongs to this supplier and says yes — so a
    // draft exercises exactly the join under test without seeding a photo.
    `INSERT INTO public.vendor_services (vendor_profile_id, category, includes_setnayan_gift, is_active)
     VALUES ($1, 'live_band', $2, FALSE) RETURNING vendor_service_id`,
    [vendorProfileId, giftOn],
  );
  const eventVendorId = await one<string>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, total_cost_php)
     VALUES ($1, 'band_dj', $2, 'considering', $3, $4, $5)
     RETURNING vendor_id`,
    [eventId, `Shop ${n}`, vendorProfileId, serviceId, php],
  );
  return { eventId, vendorProfileId, serviceId, eventVendorId };
}

/** A charge needs its ledger — one per (event, supplier). */
async function openCharge(b: { eventId: string; vendorProfileId: string; eventVendorId: string }, centavos: number) {
  const ledgerId = await one<string>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING ledger_id`,
    [b.eventId, b.vendorProfileId],
  );
  return one<string>(
    // Every NOT NULL column without a default, read from information_schema
    // rather than discovered one failure at a time.
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id,
        kind, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
        schedule_version)
     VALUES ($1, $2, $3, $4, 'primary', 'lock', 'pending', $5, $6, $6, 'test')
     RETURNING charge_id`,
    // proposal_amount_centavos is the BOOKING; amount_charged_centavos is the
    // FEE on it — the gift is 40% of the second, never of the first.
    [ledgerId, b.eventId, b.vendorProfileId, b.eventVendorId, 5_000_000, centavos],
  );
}

const stamp = (id: string, confirm: boolean) =>
  db.query('select public.stamp_setnayan_gift_at_lock($1, $2)', [id, confirm]);

const readStamp = async (id: string) =>
  (
    await db.query<{
      locked_at: string | null;
      confirmed_at: string | null;
      offered: boolean | null;
      credits: number | null;
      centavos: string | number | null;
      basis: string | number | null;
    }>(
      `select setnayan_gift_locked_at as locked_at,
              setnayan_gift_confirmed_at as confirmed_at,
              setnayan_gift_offered_at_lock as offered,
              setnayan_gift_credits_at_lock as credits,
              setnayan_gift_centavos_at_lock as centavos,
              setnayan_gift_fee_basis_centavos as basis
         from public.event_vendors where vendor_id = $1`,
      [id],
    )
  ).rows[0]!;

test('🚨 the ASK records the promise, and the SUPPLIER’S YES confirms it', async () => {
  const b = await seedBooking(50_000);

  await stamp(b.eventVendorId, false); // the couple presses Lock
  const asked = await readStamp(b.eventVendorId);
  assert.ok(asked.locked_at, 'the ask recorded nothing');
  assert.equal(asked.confirmed_at, null, 'the ask must NOT confirm — the supplier has not agreed');
  assert.equal(asked.offered, true);
  assert.ok(Number(asked.credits) > 0, 'a ₱50,000 booking on a yes card must carry photographs');
  assert.ok(Number(asked.basis) > 0, 'the fee the 40% came from must be recorded — a frozen number needs its source');

  await stamp(b.eventVendorId, true); // the supplier says yes
  const confirmed = await readStamp(b.eventVendorId);
  assert.ok(confirmed.confirmed_at, 'the supplier’s yes did not confirm the promise');
  assert.equal(confirmed.credits, asked.credits, 'the number moved between the two moments');
});

test('🔒 once CONFIRMED, nothing may change it — not even the platform', async () => {
  const b = await seedBooking(50_000);
  await stamp(b.eventVendorId, false);
  await stamp(b.eventVendorId, true);

  await assert.rejects(
    () =>
      db.query(
        `update public.event_vendors set setnayan_gift_credits_at_lock = 99999 where vendor_id = $1`,
        [b.eventVendorId],
      ),
    /cannot be changed/i,
    'a confirmed gift was editable by a direct write',
  );

  // …and a re-stamp is a silent no-op, not an error: both writers call it and a
  // supplier pressing yes twice must not raise.
  await stamp(b.eventVendorId, true);
  const after = await readStamp(b.eventVendorId);
  assert.notEqual(Number(after.credits), 99999);
});

test('⚖ between the two moments the couple keeps the BETTER number', async () => {
  // The price can be renegotiated after the ask. Taking the promise away
  // because the fee shrank would make it worthless exactly when it matters.
  const b = await seedBooking(50_000);
  await stamp(b.eventVendorId, false);
  const asked = await readStamp(b.eventVendorId);

  // The booking is renegotiated DOWN before the supplier agrees.
  await db.query('update public.event_vendors set total_cost_php = 10000 where vendor_id = $1', [
    b.eventVendorId,
  ]);
  await stamp(b.eventVendorId, true);
  const confirmed = await readStamp(b.eventVendorId);

  assert.equal(
    Number(confirmed.credits),
    Number(asked.credits),
    'a lower price after the ask took photographs away from the couple',
  );
  // 🔑 AND THE CHARGE RIDES WITH IT — the pair must never split across stamps,
  // or the supplier pays for one number while the couple is owed another.
  assert.equal(Number(confirmed.centavos), Number(asked.centavos));
});

test('🚨 THE POINT: the CHARGE honours the stamp instead of re-deriving', async () => {
  const b = await seedBooking(50_000);
  await stamp(b.eventVendorId, false);
  await stamp(b.eventVendorId, true);
  const promised = await readStamp(b.eventVendorId);

  const chargeId = await openCharge(b, FEE_ON_50K);
  const opened = await one<number>(
    'select gift_credits from public.booking_fee_charges where charge_id = $1',
    [chargeId],
  );
  assert.equal(
    Number(opened),
    Number(promised.credits),
    'the charge sized its own gift instead of honouring what the couple was promised',
  );

  // The defect this row exists for: a pending re-price used to move the number.
  // ⚠ Plain digits. A first cut wrote `1_000_000` inside the SQL string and
  // stripped underscores with .replace(/_/g,'') — which also ate them out of
  // `booking_fee_charges`, and the error blamed a table that never existed.
  await db.query(
    'update public.booking_fee_charges set amount_charged_centavos = 100000 where charge_id = $1',
    [chargeId],
  );
  const afterReprice = await one<number>(
    'select gift_credits from public.booking_fee_charges where charge_id = $1',
    [chargeId],
  );
  assert.equal(
    Number(afterReprice),
    Number(promised.credits),
    'a pending re-price moved a gift the couple had already been promised',
  );
});

test('an UNSTAMPED booking behaves exactly as before — no existing row changes', async () => {
  // Every booking in production predates SUP-I. None may change behaviour.
  const b = await seedBooking(50_000);
  const chargeId = await openCharge(b, FEE_ON_50K);
  const live = await one<number>(
    'select gift_credits from public.booking_fee_charges where charge_id = $1',
    [chargeId],
  );
  // ⚠ The charge's amount_charged_centavos IS THE FEE. A first cut wrapped it in
  // booking_fee_centavos() — taking a fee OF a fee — and expected 1,429 against
  // an actual 50,000 (the cap). The gift is 40% of the fee, full stop.
  const expected = await one<number>('select credits from public.setnayan_gift_for_fee($1)', [
    FEE_ON_50K,
  ]);
  assert.equal(Number(live), Number(expected), 'an unstamped booking stopped deriving live');
});

test('a card that says NO carries no promise — silence, never a zero-photo promise', async () => {
  const b = await seedBooking(50_000, false);
  await stamp(b.eventVendorId, false);
  const s = await readStamp(b.eventVendorId);
  assert.equal(s.offered, false);
  assert.equal(Number(s.credits), 0);
});

test('🔴 a CLIENT role cannot write the stamp — reached through RLS, not around it', async () => {
  // ⚠ WHY THIS TEST CARRIES THE WHOLE EXPOSURE ARGUMENT.
  //
  // `event_vendors` is granted at TABLE level, so these six columns inherit
  // anon=SIU authenticated=SIU, and a column-level REVOKE against a table grant
  // is a SILENT NO-OP — narrowing is not available without restructuring the
  // table's grants. The exposure baseline therefore records the widening, and
  // THIS is what makes that safe: the write is refused behaviourally.
  //
  // 🔑 AND IT MUST BE REACHED THROUGH RLS, NOT AROUND IT. A first version simply
  // switched role and wrote: RLS hid the row, the UPDATE matched NOTHING, and a
  // zero-row UPDATE RAISES NOTHING — so the test reported "no rejection" and
  // would have reported exactly the same on a codebase with no fence at all.
  // The couple is seeded as a real member here so the row IS visible and the
  // trigger is genuinely the thing that refuses.
  const b = await seedBooking(50_000);
  await stamp(b.eventVendorId, false);

  const userId = await one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`forger-${Date.now() % 100000}@test.local`],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [b.eventId, userId],
  );

  // ⚠ THE REPLAY'S auth.uid() READS `request.jwt.claim.sub` — dotted and
  // singular — not the `request.jwt.claims` JSON blob Supabase also accepts
  // (see tests/db/replay-migrations.ts). Setting the blob left auth.uid() NULL,
  // so `current_couple_event_ids()` returned nothing, the row stayed invisible,
  // and the UPDATE matched zero rows: a SILENT pass. The precondition below is
  // what caught that rather than letting it read as a working fence.
  await db.query(`select set_config('request.jwt.claim.sub', $1::text, false)`, [userId]);
  await db.query(`select set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.query('set role authenticated');

  // PRECONDITION — the row must be VISIBLE, or a refusal proves nothing.
  const visible = await one<number>(
    'select count(*)::int from public.event_vendors where vendor_id = $1',
    [b.eventVendorId],
  );

  let refused = false;
  try {
    await db.query(
      `update public.event_vendors set setnayan_gift_credits_at_lock = 50000 where vendor_id = $1`,
      [b.eventVendorId],
    );
  } catch (e) {
    refused = /written by the platform, not by a client/i.test((e as Error).message);
  }
  await db.query('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);

  assert.equal(Number(visible), 1, 'PRECONDITION: the couple must SEE the row, or this proves nothing');
  assert.ok(refused, 'a signed-in couple could forge the gift promise');

  const after = await readStamp(b.eventVendorId);
  assert.notEqual(Number(after.credits), 50000, 'the forged value landed');
});
