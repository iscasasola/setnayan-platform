/**
 * A QUOTE OUTLIVES THE EVENT — slice 5 of "vendors get to keep it"
 *
 * A proposal is a quote the SUPPLIER wrote and sent. Like a contract, every row
 * survives with no status test — a draft they never sent is still their own
 * document.
 *
 * ✅ This also closes the half-win slice 4 named: a booking fee raised at the
 * QUOTE stage is anchored on `proposal_id`, which cascaded. Money owed to
 * Setnayan by a supplier, deleted by a couple who is not party to the debt.
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

let seq = 0;
const uniq = () => `quote-${++seq}-${Date.now()}`;

async function newVendor(): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}-v@test.local`],
  );
  const userId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Quote Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newEvent(coupleUserId?: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration', 'birthday', DATE '2026-09-10') RETURNING event_id`,
  );
  const eventId = r.rows[0]!.event_id;
  if (coupleUserId) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
      [eventId, coupleUserId],
    );
  }
  return eventId;
}

async function newProposal(eventId: string, vendorProfileId: string, status = 'sent'): Promise<string> {
  const r = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals (event_id, vendor_profile_id, title, status)
     VALUES ($1, $2, 'Photography — full day', $3) RETURNING proposal_id`,
    [eventId, vendorProfileId, status],
  );
  return r.rows[0]!.proposal_id;
}

async function readProposal(proposalId: string) {
  const r = await db.query<{ proposal_id: string; event_id: string | null; title: string | null }>(
    `SELECT proposal_id, event_id, title FROM public.vendor_proposals WHERE proposal_id = $1`,
    [proposalId],
  );
  return r.rows[0] ?? null;
}

const deleteEvent = (id: string) => db.query(`DELETE FROM public.events WHERE event_id = $1`, [id]);

test('a quote the supplier sent survives the couple deleting the celebration', async () => {
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const proposalId = await newProposal(eventId, vendorProfileId);

  const before = await readProposal(proposalId);
  assert.ok(before, 'Fixture is wrong: no proposal.');
  assert.equal(before.event_id, eventId, 'Fixture is wrong: not attached.');

  await deleteEvent(eventId);

  const after = await readProposal(proposalId);
  assert.ok(after, 'THE BREAK: the supplier’s quote died with the celebration.');
  assert.equal(after.event_id, null, 'Survived but still points at a deleted celebration.');
  assert.equal(after.title, 'Photography — full day', 'Survived as an empty husk.');
});

test('a draft quote the supplier never sent is kept too', async () => {
  /* No status test, exactly as slice 3 and for the same reason: the supplier
     authored it. Copying slice 2's conditions onto a table that holds no couple
     planning is cargo. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const draft = await newProposal(eventId, vendorProfileId, 'draft');

  await deleteEvent(eventId);
  assert.ok(await readProposal(draft), 'The supplier lost a quote they wrote themselves.');
});

test('the supplier can still read the quote afterwards; the couple cannot', async () => {
  const { vendorProfileId, userId: vendorUserId } = await newVendor();
  const coupleU = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [`${uniq()}-c@test.local`],
  );
  const coupleId = coupleU.rows[0]!.id;
  const eventId = await newEvent(coupleId);
  const proposalId = await newProposal(eventId, vendorProfileId);

  const canSee = async (uid: string): Promise<number> => {
    await setAuthUid(db, uid);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
    await db.exec(`SET ROLE authenticated`);
    try {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM public.vendor_proposals WHERE proposal_id = $1`,
        [proposalId],
      );
      return Number(r.rows[0]!.n);
    } finally {
      await db.exec(`RESET ROLE`).catch(() => {});
      await setAuthUid(db, null).catch(() => {});
      await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
    }
  };

  assert.equal(await canSee(vendorUserId), 1, 'Fixture is wrong: the supplier could not see their own quote.');
  assert.equal(await canSee(coupleId), 1, 'Fixture is wrong: the couple could not see the sent quote.');

  await deleteEvent(eventId);

  assert.equal(await canSee(vendorUserId), 1, 'The supplier lost sight of their own quote.');
  assert.equal(await canSee(coupleId), 0, 'The couple still reaches a quote for a celebration they deleted.');
});

test('a booking fee raised at the QUOTE stage no longer disappears', async () => {
  /* ✅ CLOSES THE HALF-WIN SLICE 4 NAMED. `booking_fee_charges_anchor_ck`
     requires `proposal_id` OR `event_vendor_id`. Slice 2 made the second anchor
     survive; this makes the first. A `source='send'` charge is money a SUPPLIER
     owes SETNAYAN — the couple is not a party to it and must not be able to
     erase it by deleting their celebration. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const proposalId = await newProposal(eventId, vendorProfileId);

  const led = await db.query<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING ledger_id`,
    [eventId, vendorProfileId],
  );
  const chg = await db.query<{ charge_id: string }>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, proposal_id, kind, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     VALUES ($1, $2, $3, $4, 'primary', 'send', 'pending', 8000000, 400000, 400000, '2026-07-25')
     RETURNING charge_id`,
    [led.rows[0]!.ledger_id, eventId, vendorProfileId, proposalId],
  );
  const chargeId = chg.rows[0]!.charge_id;

  await deleteEvent(eventId);

  const c = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chargeId],
  );
  assert.equal(
    Number(c.rows[0]!.n),
    1,
    'A fee raised at the quote stage was erased by the couple deleting their celebration.',
  );
});

test('the quote-stage fee still satisfies its anchor after the deletion', async () => {
  /* The CHECK requires `proposal_id` OR `event_vendor_id` to be non-null. If
     the surviving charge came out with BOTH null it would be a row the database
     would refuse to accept — surviving in a shape nothing may ever update. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent();
  const proposalId = await newProposal(eventId, vendorProfileId);
  const led = await db.query<{ ledger_id: string }>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id)
     VALUES ($1, $2) RETURNING ledger_id`,
    [eventId, vendorProfileId],
  );
  const chg = await db.query<{ charge_id: string }>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, proposal_id, kind, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     VALUES ($1, $2, $3, $4, 'primary', 'send', 'pending', 8000000, 400000, 400000, '2026-07-25')
     RETURNING charge_id`,
    [led.rows[0]!.ledger_id, eventId, vendorProfileId, proposalId],
  );

  await deleteEvent(eventId);

  const r = await db.query<{ anchored: boolean }>(
    `SELECT (proposal_id IS NOT NULL OR event_vendor_id IS NOT NULL) AS anchored
       FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chg.rows[0]!.charge_id],
  );
  assert.equal(r.rows[0]?.anchored, true, 'The surviving charge lost both anchors and violates its own CHECK.');

  /* And prove the row is still writable — a charge nothing can ever mark paid
     is not a preserved debt, it is a tombstone. */
  await db.query(`UPDATE public.booking_fee_charges SET status = 'paid' WHERE charge_id = $1`, [
    chg.rows[0]!.charge_id,
  ]);
  const after = await db.query<{ status: string }>(
    `SELECT status FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chg.rows[0]!.charge_id],
  );
  assert.equal(after.rows[0]?.status, 'paid', 'The surviving charge can never be marked paid.');
});
