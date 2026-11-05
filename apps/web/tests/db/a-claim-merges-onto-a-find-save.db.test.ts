/**
 * A SHOP SAVED FROM FIND *AND* TYPED IN BY HAND CAN STILL CLAIM THE COUPLE'S
 * LINK (owner 2026-10-12, "fix the problems"; migration 20271268139017).
 *
 * Before: `applyClaimAutoLink` set `marketplace_vendor_id` on the hand-typed
 * record, and `event_vendors_unique_marketplace_pick_per_event` (one live row
 * per shop per event) refused it — the supplier's claim failed. Now
 * `claim_link_record_to_shop` merges the record onto the existing row:
 *   · the call succeeds and returns the SURVIVOR (the Find save);
 *   · the survivor takes the couple's contact card and, where it had none, the
 *     price and inclusions; it keeps its OWN status (a hand "booked" does not
 *     hold the supplier's date);
 *   · the claim link (and everything else pointing at the record) follows;
 *   · the record is archived, not deleted;
 *   · the earliest sourced fact survives — the pair still attributes sourced.
 * And the shipped paths hold: no other row → the record itself is linked; a
 * record bonded to a DIFFERENT shop is refused.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

const EARLY = '2026-09-20T12:00:00Z';
const LATER = '2026-10-01T12:00:00Z';

async function asServer<T>(fn: () => Promise<T>): Promise<T> {
  await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  try {
    return await fn();
  } finally {
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
}

async function newShop(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`shop-${++n}@claim-merge.test`],
  );
  const r = await db.query<{ v: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW()) RETURNING vendor_profile_id AS v`,
    [u.rows[0]!.id, `Kusina ${n}`],
  );
  return r.rows[0]!.v;
}

async function newEvent(): Promise<string> {
  const r = await db.query<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS e`,
    [`Claim merge ${++n}`],
  );
  return r.rows[0]!.e;
}

/** The couple's hand-typed record (manual row) — booked by hand at ₱197,000, made LATER. */
async function newRecord(eventId: string): Promise<{ rowId: string; manualId: string }> {
  const m = await db.query<{ id: string }>(
    `INSERT INTO public.event_manual_vendors (event_id, business_name, contact_person, contact_number, created_at)
     VALUES ($1, 'Kusina ni Lola', 'Lola', '09170000000', $2) RETURNING manual_vendor_id AS id`,
    [eventId, LATER],
  );
  const r = await db.query<{ id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, manual_vendor_id, total_cost_php, source, created_at)
     VALUES ($1, 'catering', 'Kusina ni Lola', 'contracted', $2, 197000, 'host_manual', $3) RETURNING vendor_id AS id`,
    [eventId, m.rows[0]!.id, LATER],
  );
  return { rowId: r.rows[0]!.id, manualId: m.rows[0]!.id };
}

async function newClaimLink(rowId: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO public.vendor_invites (vendor_id, business_name, service_category, claim_token, source, expires_at)
     VALUES ($1, 'Kusina ni Lola', 'catering', $2, 'auto_share_link', now() + interval '90 days') RETURNING invite_id AS id`,
    [rowId, `tok-${++n}`],
  );
  return r.rows[0]!.id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('a shop saved from Find and typed in by hand: the claim MERGES onto the Find save instead of failing', async () => {
  const shop = await newShop();
  const eventId = await newEvent();
  const save = await db.query<{ id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source, created_at)
     VALUES ($1, 'catering', 'Kusina ni Lola', 'considering', $2, 'host_marketplace_search', $3) RETURNING vendor_id AS id`,
    [eventId, shop, EARLY],
  );
  const saveId = save.rows[0]!.id;
  const { rowId, manualId } = await newRecord(eventId);
  const inviteId = await newClaimLink(rowId);

  // The shipped single UPDATE is what used to fail — prove the trap is real.
  await assert.rejects(
    db.query(`UPDATE public.event_vendors SET marketplace_vendor_id = $1 WHERE vendor_id = $2`, [shop, rowId]),
    /event_vendors_unique_marketplace_pick_per_event/,
    'the trap this fixes no longer exists — re-read the index before trusting this test',
  );

  const out = await asServer(() =>
    db.query<{ id: string }>(`SELECT public.claim_link_record_to_shop($1, $2) AS id`, [rowId, shop]),
  );
  assert.equal(out.rows[0]!.id, saveId, 'the survivor is the existing row');

  const s = await db.query<{ manual_vendor_id: string | null; total_cost_php: string | null; status: string; archived_at: string | null }>(
    `SELECT manual_vendor_id, total_cost_php::text, status::text, archived_at FROM public.event_vendors WHERE vendor_id = $1`,
    [saveId],
  );
  assert.equal(s.rows[0]!.manual_vendor_id, manualId, "the couple's contact card did not move onto the survivor");
  assert.equal(Number(s.rows[0]!.total_cost_php), 197000, 'the agreed price did not move onto a survivor that had none');
  assert.equal(s.rows[0]!.status, 'considering', 'a hand "booked" moved onto the supplier row — it would hold their date');
  assert.equal(s.rows[0]!.archived_at, null);

  const rec = await db.query<{ archived_at: string | null; marketplace_vendor_id: string | null }>(
    `SELECT archived_at, marketplace_vendor_id FROM public.event_vendors WHERE vendor_id = $1`,
    [rowId],
  );
  assert.ok(rec.rows[0], 'the record was deleted — it must be archived, never deleted');
  assert.notEqual(rec.rows[0]!.archived_at, null, 'the record was not archived');
  assert.equal(rec.rows[0]!.marketplace_vendor_id, null);

  const inv = await db.query<{ vendor_id: string }>(`SELECT vendor_id FROM public.vendor_invites WHERE invite_id = $1`, [inviteId]);
  assert.equal(inv.rows[0]!.vendor_id, saveId, 'the claim link did not follow the record onto the survivor');

  // One live row of the shop on the event — and the earliest sourced fact (the Find save) still counts.
  const live = await db.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM public.event_vendors WHERE event_id = $1 AND marketplace_vendor_id = $2 AND archived_at IS NULL`,
    [eventId, shop],
  );
  assert.equal(live.rows[0]!.c, 1);
  const a = await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId]);
  assert.equal(a.rows[0]!.a, 'sourced', 'the merge lost the earliest sourced fact');
});

test('no other row of the shop on the event: the record itself is linked (as shipped)', async () => {
  const shop = await newShop();
  const eventId = await newEvent();
  const { rowId } = await newRecord(eventId);
  const out = await asServer(() =>
    db.query<{ id: string }>(`SELECT public.claim_link_record_to_shop($1, $2) AS id`, [rowId, shop]),
  );
  assert.equal(out.rows[0]!.id, rowId);
  const r = await db.query<{ m: string | null; archived_at: string | null }>(
    `SELECT marketplace_vendor_id AS m, archived_at FROM public.event_vendors WHERE vendor_id = $1`,
    [rowId],
  );
  assert.equal(r.rows[0]!.m, shop);
  assert.equal(r.rows[0]!.archived_at, null);
});

test('a record already bonded to a DIFFERENT shop is never taken over', async () => {
  const shop = await newShop();
  const other = await newShop();
  const eventId = await newEvent();
  const { rowId } = await newRecord(eventId);
  await db.query(`UPDATE public.event_vendors SET marketplace_vendor_id = $1 WHERE vendor_id = $2`, [other, rowId]);
  await assert.rejects(
    asServer(() => db.query(`SELECT public.claim_link_record_to_shop($1, $2)`, [rowId, shop])),
    /already linked to another shop/,
  );
});

test('only the server may call it', async () => {
  const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
    `SELECT has_function_privilege('anon', 'public.claim_link_record_to_shop(uuid, uuid)', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.claim_link_record_to_shop(uuid, uuid)', 'EXECUTE') AS auth,
            has_function_privilege('service_role', 'public.claim_link_record_to_shop(uuid, uuid)', 'EXECUTE') AS svc`,
  );
  assert.deepEqual(r.rows[0], { anon: false, auth: false, svc: true });
});
