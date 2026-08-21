/**
 * THE CONTRACT STAYS WITH WHO SIGNED IT — slice 3 of "vendors get to keep it"
 *
 * Owner named this one explicitly: signed contracts resolve to the VENDOR.
 *
 * Simpler than slice 2 on purpose. `event_vendors` needed three conditions
 * because it holds the couple's private shortlist in the same rows; a contract
 * has no such ambiguity — the supplier authored it, so every row survives.
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
const uniq = () => `contract-${++seq}-${Date.now()}`;

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
     VALUES ($1, 'Paperwork Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1, 'birthday', DATE '2026-05-06') RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

async function newContract(eventId: string, vendorProfileId: string, status = 'fully_signed'): Promise<string> {
  const r = await db.query<{ contract_id: string }>(
    /* Every NOT NULL column without a default, read off the live schema rather
       than guessed — the first cut omitted `title` and failed four tests at
       once for a fixture reason, which proves nothing about the change. */
    `INSERT INTO public.vendor_contracts
       (event_id, vendor_profile_id, title, file_url, file_name, file_size_bytes, status)
     VALUES ($1, $2, 'Photography agreement', 'r2://contracts/agreement.pdf',
             'agreement.pdf', 12345, $3)
     RETURNING contract_id`,
    [eventId, vendorProfileId, status],
  );
  return r.rows[0]!.contract_id;
}

async function readContract(contractId: string) {
  const r = await db.query<{
    contract_id: string;
    event_id: string | null;
    client_name_at_delete: string | null;
    file_name: string | null;
  }>(
    `SELECT contract_id, event_id, client_name_at_delete, file_name
       FROM public.vendor_contracts WHERE contract_id = $1`,
    [contractId],
  );
  return r.rows[0] ?? null;
}

const deleteEvent = (id: string) => db.query(`DELETE FROM public.events WHERE event_id = $1`, [id]);

test('a signed contract survives the couple deleting the celebration', async () => {
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent('Dina & Ramon');
  const contractId = await newContract(eventId, vendorProfileId);

  const before = await readContract(contractId);
  assert.ok(before, 'Fixture is wrong: the contract was never created.');
  assert.equal(before.event_id, eventId, 'Fixture is wrong: not attached.');

  await deleteEvent(eventId);

  const after = await readContract(contractId);
  assert.ok(after, 'THE BREAK: the supplier’s signed contract died with the celebration.');
  assert.equal(after.event_id, null, 'Survived but still points at a deleted celebration.');
  assert.equal(after.file_name, 'agreement.pdf', 'Survived as an empty husk.');
});

test('the surviving contract still names who the supplier signed with', async () => {
  /* 🚨 SLICE 2'S LESSON, IN ITS OTHER COSTUME. There the row VANISHED from a
     view that inner-joined the event. Here it survives and goes ANONYMOUS: the
     supplier's list looks the event up separately and falls back to the literal
     'Unknown event'. A signed contract that cannot name its counterparty is its
     own kind of useless, so the name is stamped while the event still exists. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent('Ana & Marco');
  const contractId = await newContract(eventId, vendorProfileId);

  assert.equal(
    (await readContract(contractId))?.client_name_at_delete,
    null,
    'The name must NOT be stamped while the celebration still exists — read it live then.',
  );

  await deleteEvent(eventId);

  assert.equal(
    (await readContract(contractId))?.client_name_at_delete,
    'Ana & Marco',
    'The supplier’s contract forgot who they signed with.',
  );
});

test('a draft the supplier never sent is kept too — they authored it', async () => {
  /* No status test here, deliberately. Slice 2 needed one because that table
     holds the couple's shortlist; a contract is the supplier's own document at
     every status, and their own policy already keys on their profile. Copying
     slice 2's conditions here would be cargo. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent('Bea & Carlo');
  const draft = await newContract(eventId, vendorProfileId, 'draft');

  await deleteEvent(eventId);

  assert.ok(await readContract(draft), 'The supplier lost a document they wrote themselves.');
});

test('the supplier can still read their contract afterwards; the couple cannot', async () => {
  /* The promise is not that the row exists — it is that the SUPPLIER still has
     it. Their policy keys on their own profile, the couple's keys on the event
     through event_members, so orphaning should land on exactly the right side
     of that line. Asserted from both directions. */
  const { vendorProfileId, userId: vendorUserId } = await newVendor();
  const coupleU = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [`${uniq()}-c@test.local`],
  );
  const coupleId = coupleU.rows[0]!.id;
  const eventId = await newEvent('Elle & Jun');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, coupleId],
  );
  const contractId = await newContract(eventId, vendorProfileId);

  const canSee = async (uid: string): Promise<number> => {
    await setAuthUid(db, uid);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
    await db.exec(`SET ROLE authenticated`);
    try {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM public.vendor_contracts WHERE contract_id = $1`,
        [contractId],
      );
      return Number(r.rows[0]!.n);
    } finally {
      await db.exec(`RESET ROLE`).catch(() => {});
      await setAuthUid(db, null).catch(() => {});
      await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
    }
  };

  assert.equal(await canSee(vendorUserId), 1, 'Fixture is wrong: the supplier could not see it to begin with.');
  assert.equal(await canSee(coupleId), 1, 'Fixture is wrong: the couple could not see it to begin with.');

  await deleteEvent(eventId);

  assert.equal(await canSee(vendorUserId), 1, 'The supplier lost sight of their own signed contract.');
  assert.equal(await canSee(coupleId), 0, 'The couple still reaches a contract for a celebration they deleted.');
});

test('an already-stamped name is not overwritten by a later deletion', async () => {
  /* COALESCE, not a blind assignment. The trigger fires for every contract
     matching the event, and a contract can only be stamped once meaningfully —
     if a value is somehow already there it is the earlier, truer one. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent('Later Name');
  const contractId = await newContract(eventId, vendorProfileId);
  await db.query(
    `UPDATE public.vendor_contracts SET client_name_at_delete = 'Earlier Name' WHERE contract_id = $1`,
    [contractId],
  );

  await deleteEvent(eventId);

  assert.equal(
    (await readContract(contractId))?.client_name_at_delete,
    'Earlier Name',
    'A later deletion overwrote a name that was already recorded.',
  );
});

test('a couple cannot write a false client name onto a supplier’s contract', async () => {
  /* The baseline lists this column as writable by session roles, and this
     trigger uses COALESCE — so unlike slice 2, a pre-written value would
     SURVIVE rather than be overwritten. That makes "who can write it" the whole
     control, and it must be asserted rather than reasoned about.

     Measured: `vendor_contracts` gives the couple a SELECT policy only
     (`vendor_contracts_event_member_read`); every write policy keys on the
     vendor's own profile. So the couple cannot reach the column at all.

     🔑 ASSERT THE OUTCOME, NOT A THROW — under RLS the UPDATE is filtered to
     zero rows and resolves happily. */
  const { vendorProfileId } = await newVendor();
  const coupleU = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [`${uniq()}-forge@test.local`],
  );
  const coupleId = coupleU.rows[0]!.id;
  const eventId = await newEvent('Real Client');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, coupleId],
  );
  const contractId = await newContract(eventId, vendorProfileId);

  await setAuthUid(db, coupleId);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  const who = await db.query<{ uid: string | null }>(`SELECT auth.uid()::text AS uid`);
  assert.equal(
    who.rows[0]?.uid,
    coupleId,
    'The test has no identity — without auth.uid() every policy matches nothing and this passes for the wrong reason.',
  );
  try {
    await db.query(
      `UPDATE public.vendor_contracts SET client_name_at_delete = 'Somebody Else' WHERE contract_id = $1`,
      [contractId],
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }

  assert.equal(
    (await readContract(contractId))?.client_name_at_delete,
    null,
    'A couple wrote onto the supplier’s contract.',
  );

  await deleteEvent(eventId);
  assert.equal(
    (await readContract(contractId))?.client_name_at_delete,
    'Real Client',
    'The stamped name is not the real one.',
  );
});
