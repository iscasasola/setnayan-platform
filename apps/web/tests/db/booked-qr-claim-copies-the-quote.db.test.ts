/**
 * A BOOKED QR CARRIES THE WHOLE PURCHASE — the claim copies the code's quote lines onto the couple's quotation
 * (Supplier Build 2 lane E, migration 20271328327292; DECISION_LOG 2026-11-03).
 *
 * WHAT IS ASSERTED
 *   1. A claimed code with lines leaves ONE accepted `vendor_proposals` row for that event × shop whose `line_items`
 *      are the token's lines BYTE FOR BYTE and whose total is the token's own `total_php` — nothing computed.
 *   2. Idempotent: a re-scan by the same couple (`already_claimed`) and a direct re-run of the insert write no copy.
 *   3. The shop's earlier live quotes on the event are superseded, so exactly one accepted quote states the deal.
 *   4. A code without lines (issued before #34) writes no quote — a quote nobody wrote is never invented.
 *   5. The couple reads the copied quote under their own session (the shipped `vendor_proposals_couple_read`).
 *   6. `client_name` is stored; a blank one is refused (NULL stays the "never said" answer).
 *   7. NEUTRALISED: put the claim back without step (c2) and case 1 finds no quote — it measures the step, not a fixture.
 *   8. Only the claim names a quote’s Booked QR: a shop’s browser UPDATE of `locked_qr_token_id` is refused (it would
 *      squat another code’s UNIQUE slot); the claim as `authenticated` still writes; neutralised by dropping the trigger.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let coupleUid = '';
let vendorUid = '';
let shop = '';

const LINES = [
  { label: 'Full-day coverage', detail: '10 hours · 2 shooters', amount_centavos: 6_500_000 },
  { label: 'Same-day edit', detail: null, amount_centavos: 1_500_000 },
];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  coupleUid = await createUser('bq-quote-couple@audit.test');
  vendorUid = await createUser('bq-quote-vendor@audit.test');
  shop = await createVendor(vendorUid, 'Quote Copy Studio');
});

after(async () => {
  await db.close();
});

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function createVendor(userId: string, name: string): Promise<string> {
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified'::public.vendor_verification_state, NOW())
     RETURNING vendor_profile_id`,
    [userId, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function newEvent(name: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ($1, 'wedding', 'catholic', 'garden') RETURNING event_id`,
    [name],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, coupleUid]);
  return eventId;
}

async function newToken(lines: unknown = LINES, clientName: string | null = 'Ana & Ben'): Promise<string> {
  const r = await db.query<{ token: string }>(
    `INSERT INTO public.vendor_locked_qr_tokens (
       vendor_profile_id, created_by_user_id, event_type, category, service_description, event_date,
       total_php, initial_paid_php, schedule_json, quote_line_items, client_name
     ) VALUES ($1, $2, 'wedding', 'photographer', 'Full-day coverage', '2027-06-19', 80000, 20000,
               '[{"seq":1,"label":"First payment","amount_value":20000,"due_date":"2026-12-01"}]'::jsonb, $3::jsonb, $4)
     RETURNING token`,
    [shop, vendorUid, lines === null ? null : JSON.stringify(lines), clientName],
  );
  return r.rows[0]!.token;
}

async function claim(token: string, eventId: string): Promise<{ status: string }> {
  await setAuthUid(db, coupleUid);
  try {
    return (await db.query<{ out: { status: string } }>(`SELECT public.vendor_claim_locked_qr($1, $2) AS out`, [token, eventId])).rows[0]!.out;
  } finally {
    await setAuthUid(db, null);
  }
}

type Quote = { status: string; line_items: unknown; total_centavos: string; locked_qr_token_id: string | null };
const quotesOf = async (eventId: string) =>
  (
    await db.query<Quote>(
      `SELECT status, line_items, total_centavos::text, locked_qr_token_id::text FROM public.vendor_proposals
        WHERE event_id = $1 AND vendor_profile_id = $2 ORDER BY created_at`,
      [eventId, shop],
    )
  ).rows;

test('1 · the claim copies the stored lines, byte for byte, into ONE accepted quote — total from the token', async () => {
  const eventId = await newEvent('Copy The Lines');
  assert.equal((await claim(await newToken(), eventId)).status, 'ok');
  const q = await quotesOf(eventId);
  assert.equal(q.length, 1, 'the claim did not write the quotation (or wrote two)');
  assert.equal(q[0]!.status, 'accepted');
  assert.deepEqual(q[0]!.line_items, LINES, 'the lines were not copied as stored');
  assert.equal(q[0]!.total_centavos, '8000000', 'the total is not the token’s own total_php');
});

test('2 · idempotent — a re-scan and a re-run of the insert write no second copy', async () => {
  const eventId = await newEvent('Scan Twice');
  const token = await newToken();
  assert.equal((await claim(token, eventId)).status, 'ok');
  assert.equal((await claim(token, eventId)).status, 'already_claimed');
  const tid = (await db.query<{ id: string }>(`SELECT id::text FROM public.vendor_locked_qr_tokens WHERE token = $1`, [token])).rows[0]!.id;
  // The UNIQUE key is the database's own guarantee, not the early return.
  await db.query(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, line_items, total_centavos, status, locked_qr_token_id)
     VALUES ($1, $2, 'again', '[]'::jsonb, 1, 'accepted', $3)
     ON CONFLICT (locked_qr_token_id) WHERE locked_qr_token_id IS NOT NULL DO NOTHING`,
    [shop, eventId, tid],
  );
  assert.equal((await quotesOf(eventId)).length, 1, 'a re-claim duplicated the lines');
});

test('3 · the shop’s earlier live quotes on the event are superseded — one accepted quote states the deal', async () => {
  const eventId = await newEvent('Had A Quote Before');
  await db.query(
    `INSERT INTO public.event_vendors (event_id, marketplace_vendor_id, linked_vendor_profile_id, category, vendor_name, status)
     VALUES ($1, $2, $2, 'photographer'::public.vendor_category, 'Quote Copy Studio', 'considering')`,
    [eventId, shop],
  );
  await db.query(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, line_items, total_centavos, status)
     VALUES ($1, $2, 'Old accepted', '[]'::jsonb, 100, 'accepted'), ($1, $2, 'Old sent', '[]'::jsonb, 100, 'sent')`,
    [shop, eventId],
  );
  assert.equal((await claim(await newToken(), eventId)).status, 'ok');
  const q = await quotesOf(eventId);
  assert.deepEqual(
    q.map((x) => x.status).sort(),
    ['accepted', 'superseded', 'superseded'],
    'two accepted quotes for one event × shop are read at random',
  );
  assert.ok(q.find((x) => x.status === 'accepted')!.locked_qr_token_id, 'the accepted one is not the Booked QR’s');
});

test('4 · a code without lines writes no quote — never a quote nobody wrote', async () => {
  const eventId = await newEvent('Old Code No Lines');
  assert.equal((await claim(await newToken(null), eventId)).status, 'ok');
  assert.equal((await quotesOf(eventId)).length, 0);
  const empty = await newEvent('Empty Lines');
  assert.equal((await claim(await newToken([]), empty)).status, 'ok');
  assert.equal((await quotesOf(empty)).length, 0);
});

test('5 · the couple reads the copied quote under their own session', async () => {
  const eventId = await newEvent('Couple Reads It');
  await claim(await newToken(), eventId);
  await setAuthUid(db, coupleUid);
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_proposals WHERE event_id = $1 AND status = 'accepted'`, [eventId]);
    assert.equal(r.rows[0]!.n, 1, 'the couple cannot see the quotation their scan made');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }
});

test('6 · client_name is stored; a blank one is refused', async () => {
  const t = await newToken(LINES, 'Ana & Ben');
  const r = await db.query<{ c: string | null }>(`SELECT client_name AS c FROM public.vendor_locked_qr_tokens WHERE token = $1`, [t]);
  assert.equal(r.rows[0]!.c, 'Ana & Ben');
  const legacy = await newToken(LINES, null);
  assert.equal((await db.query<{ c: string | null }>(`SELECT client_name AS c FROM public.vendor_locked_qr_tokens WHERE token = $1`, [legacy])).rows[0]!.c, null);
  await assert.rejects(newToken(LINES, '   '), /client_name_len/);
});

test('7 · NEUTRALISED: without step (c2) the claim writes no quote — case 1 measures the step', async () => {
  const def = (
    await db.query<{ def: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
    )
  ).rows[0]!.def;
  const start = def.indexOf('-- (c2)');
  const end = def.indexOf('-- (d) Backfill');
  assert.ok(start > 0 && end > start, 'step (c2) is not where this test expects it');
  await db.query('BEGIN');
  try {
    await db.exec(def.slice(0, start) + def.slice(end));
    const eventId = await newEvent('Neutralised');
    assert.equal((await claim(await newToken(), eventId)).status, 'ok');
    assert.equal((await quotesOf(eventId)).length, 0);
  } finally {
    await db.query('ROLLBACK');
  }
  const back = await newEvent('Back Again');
  await claim(await newToken(), back);
  assert.equal((await quotesOf(back)).length, 1, 'the step did not come back after the rollback');
});

test('8 · only the claim names a quote’s Booked QR — a shop cannot squat another code’s id from the browser', async () => {
  // A shop stamping a token id onto its own draft would make that code's real claim write NO quote (the UNIQUE
  // index + ON CONFLICT DO NOTHING). The guard trigger refuses it for browser roles; the SECURITY DEFINER claim,
  // called as `authenticated`, still writes.
  const eventId = await newEvent('Squat Attempt');
  const token = await newToken();
  const tid = (await db.query<{ id: string }>(`SELECT id::text FROM public.vendor_locked_qr_tokens WHERE token = $1`, [token])).rows[0]!.id;
  const draft = (
    await db.query<{ proposal_id: string }>(
      `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, line_items, total_centavos, status)
       VALUES ($1, $2, 'A draft', '[]'::jsonb, 100, 'draft') RETURNING proposal_id`,
      [shop, eventId],
    )
  ).rows[0]!.proposal_id;

  await setAuthUid(db, vendorUid);
  await db.exec(`SET ROLE authenticated`);
  try {
    await assert.rejects(
      db.query(`UPDATE public.vendor_proposals SET locked_qr_token_id = $1 WHERE proposal_id = $2`, [tid, draft]),
      /Only a Booked QR claim/,
      'a shop set a Booked QR id on its own draft from the browser',
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }

  // The claim, as the couple's browser role, is the one writer.
  await setAuthUid(db, coupleUid);
  await db.exec(`SET ROLE authenticated`);
  let out: { status: string };
  try {
    out = (await db.query<{ out: { status: string } }>(`SELECT public.vendor_claim_locked_qr($1, $2) AS out`, [token, eventId])).rows[0]!.out;
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }
  assert.equal(out.status, 'ok');
  const accepted = (await quotesOf(eventId)).filter((q) => q.status === 'accepted');
  assert.equal(accepted.length, 1, 'the claim (as authenticated, through SECURITY DEFINER) did not write its quote');
  assert.equal(accepted[0]!.locked_qr_token_id, tid);

  // NEUTRALISED: with the trigger dropped, the same browser UPDATE lands — the refusal above is the guard's.
  await db.query('BEGIN');
  try {
    await db.exec(`DROP TRIGGER a_quote_names_its_booked_qr_only_by_the_claim ON public.vendor_proposals`);
    const other = await newToken();
    const otherId = (await db.query<{ id: string }>(`SELECT id::text FROM public.vendor_locked_qr_tokens WHERE token = $1`, [other])).rows[0]!.id;
    await setAuthUid(db, vendorUid);
    await db.exec(`SET ROLE authenticated`);
    const r = await db.query(`UPDATE public.vendor_proposals SET locked_qr_token_id = $1 WHERE proposal_id = $2`, [otherId, draft]);
    assert.equal(r.affectedRows, 1, 'without the guard the shop’s UPDATE should land — the neutralisation measures nothing');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
    await db.query('ROLLBACK');
  }
});
