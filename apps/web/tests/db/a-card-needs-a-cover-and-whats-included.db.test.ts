/**
 * A CARD NEEDS A COVER AND "WHAT'S INCLUDED" TO GO LIVE — H2, against a
 * replayed schema (20271222415682).
 *
 * ⚖ Owner 2026-09-09: *"the cover-photo · title · inclusions requirements
 * stay"*. The trigger fires for every role (superuser included), so what passes
 * here passes in production for the same reason — see a-card-that-can-be-found.
 *
 * Each case asserts a VALUE both ways: a refusal names the missing thing, an
 * acceptance leaves a live row. And the two production-shaped cards — live, no
 * inclusions, one without a cover — are proved to STAY live and STILL SAVE.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { PUBLISH_REFUSAL_MESSAGE } from '../../lib/service-publish-gate';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const VP = '22222222-2222-4222-8222-222222222222';
const COVER = 'r2://media/vendors/h2/cover.webp';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(
    `INSERT INTO vendor_profiles (vendor_profile_id, business_name, verification_state, last_verified_at)
     VALUES ($1, 'Saysay Live Band', 'verified', NOW())
     ON CONFLICT (vendor_profile_id) DO NOTHING`,
    [VP],
  );
});
after(async () => {
  await db?.close();
});

async function refused(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function row(id: string) {
  const r = await db.query<{ is_active: boolean; title: string | null; starting_price_php: number | null }>(
    `SELECT is_active, title, starting_price_php FROM vendor_services WHERE vendor_service_id = $1`,
    [id],
  );
  assert.equal(r.rows.length, 1, 'the row under test does not exist — the case proved nothing');
  return r.rows[0]!;
}

async function draft(fields: Record<string, unknown> = {}): Promise<string> {
  const cols = ['vendor_profile_id', 'category', 'is_active', ...Object.keys(fields)];
  const vals = [VP, 'live_band', false, ...Object.values(fields)];
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO vendor_services (${cols.join(', ')})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING vendor_service_id`,
    vals,
  );
  return r.rows[0]!.vendor_service_id;
}

async function include(id: string, label = 'Sound system'): Promise<void> {
  await db.query(
    `INSERT INTO vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
     VALUES ($1, $2, $3, 0, 0)`,
    [id, VP, label],
  );
}

/** Call the atomic writer the way `commitVendorService` does. */
async function save(
  serviceId: string | null,
  fields: Record<string, unknown>,
  inclusions: { label: string; worth_php?: number }[],
  publish: boolean,
): Promise<string> {
  const r = await db.query<{ save_vendor_service: string }>(
    `SELECT public.save_vendor_service(
       $1::uuid, $2::uuid, $3::jsonb,
       '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $4::jsonb, $5::boolean)`,
    [VP, serviceId, JSON.stringify(fields), JSON.stringify(inclusions), publish],
  );
  return r.rows[0]!.save_vendor_service;
}

// ── the trigger: a card inserted live, or flipped live ──────────────────────

test('inserted live with NO COVER → refused, with the app’s sentence', async () => {
  const err = await refused(
    `INSERT INTO vendor_services (vendor_profile_id, category, is_active, starting_price_php)
     VALUES ($1, 'live_band', true, 40001)`,
    [VP],
  );
  assert.equal(err, PUBLISH_REFUSAL_MESSAGE.cover);
});

test('inserted live with a cover and a price but NOTHING INCLUDED → refused at commit', async () => {
  const err = await refused(
    `INSERT INTO vendor_services (vendor_profile_id, category, is_active, starting_price_php, primary_photo_r2_key)
     VALUES ($1, 'live_band', true, 40002, $2)`,
    [VP, COVER],
  );
  assert.equal(err, PUBLISH_REFUSAL_MESSAGE.inclusions);
  const left = await db.query(`SELECT 1 FROM vendor_services WHERE starting_price_php = 40002`);
  assert.equal(left.rows.length, 0, 'the refused card was left behind');
});

test('inserted live WITH what’s included in the same statement → live', async () => {
  const r = await db.query<{ vendor_service_id: string }>(
    `WITH s AS (
       INSERT INTO vendor_services (vendor_profile_id, category, is_active, starting_price_php, primary_photo_r2_key)
       VALUES ($1, 'live_band', true, 40003, $2)
       RETURNING vendor_service_id, vendor_profile_id
     ), i AS (
       INSERT INTO vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
       SELECT vendor_service_id, vendor_profile_id, 'Sound system' FROM s
     )
     SELECT vendor_service_id FROM s`,
    [VP, COVER],
  );
  assert.equal((await row(r.rows[0]!.vendor_service_id)).is_active, true);
});

test('a blank inclusion line cannot exist — the table refuses it, so it can never satisfy the gate', async () => {
  // `vendor_service_inclusions_label_check` already refuses a blank label, so a
  // blank row can never be the thing that lets a card go live. (The RPC's own
  // blank-label case — which answers with the gate's sentence before any row
  // is written — is in the RPC test below.)
  const id = await draft({ starting_price_php: 40004, primary_photo_r2_key: COVER });
  const err = await refused(
    `INSERT INTO vendor_service_inclusions (vendor_service_id, vendor_profile_id, label) VALUES ($1, $2, '   ')`,
    [id, VP],
  );
  assert.match(err ?? '', /vendor_service_inclusions_label_check/);
  assert.equal(
    await refused(`UPDATE vendor_services SET is_active = true WHERE vendor_service_id = $1`, [id]),
    PUBLISH_REFUSAL_MESSAGE.inclusions,
  );
  assert.equal((await row(id)).is_active, false);
});

test('draft → live: no cover refused, then nothing included refused, then complete goes live', async () => {
  const id = await draft({ starting_price_php: 40005 });
  assert.equal(
    await refused(`UPDATE vendor_services SET is_active = true WHERE vendor_service_id = $1`, [id]),
    PUBLISH_REFUSAL_MESSAGE.cover,
  );
  await db.query(`UPDATE vendor_services SET primary_photo_r2_key = $2 WHERE vendor_service_id = $1`, [id, COVER]);
  assert.equal(
    await refused(`UPDATE vendor_services SET is_active = true WHERE vendor_service_id = $1`, [id]),
    PUBLISH_REFUSAL_MESSAGE.inclusions,
  );
  assert.equal((await row(id)).is_active, false);
  await include(id);
  await db.query(`UPDATE vendor_services SET is_active = true WHERE vendor_service_id = $1`, [id]);
  assert.equal((await row(id)).is_active, true);
});

test('published and taken back to draft in ONE transaction → nothing is refused', async () => {
  const id = await draft({ starting_price_php: 40006, primary_photo_r2_key: COVER });
  await db.exec('BEGIN');
  try {
    await db.query(`UPDATE vendor_services SET is_active = true WHERE vendor_service_id = $1`, [id]);
    await db.query(`UPDATE vendor_services SET is_active = false WHERE vendor_service_id = $1`, [id]);
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK').catch(() => {});
    throw e;
  }
  assert.equal((await row(id)).is_active, false);
});

test('the price keeps its rule: a coverful, included card with no price is still refused', async () => {
  const id = await draft({ primary_photo_r2_key: COVER });
  await include(id);
  assert.equal(
    await refused(`UPDATE vendor_services SET is_active = true WHERE vendor_service_id = $1`, [id]),
    PUBLISH_REFUSAL_MESSAGE.price,
  );
});

// ── the two production-shaped cards: live, missing, and still fine ──────────

/** A card live since before H2: made complete, then stripped (child rows and
 *  the cover are not re-judged on a live card — they are FLAGGED). */
async function grandfatheredLiveCard(price: number): Promise<string> {
  const id = await draft({ starting_price_php: price, primary_photo_r2_key: COVER });
  await include(id);
  await db.query(`UPDATE vendor_services SET is_active = true WHERE vendor_service_id = $1`, [id]);
  await db.query(`DELETE FROM vendor_service_inclusions WHERE vendor_service_id = $1`, [id]);
  await db.query(`UPDATE vendor_services SET primary_photo_r2_key = NULL WHERE vendor_service_id = $1`, [id]);
  return id;
}

test('a card ALREADY live with no cover and nothing included STAYS live and still saves', async () => {
  const id = await grandfatheredLiveCard(40007);
  assert.equal((await row(id)).is_active, true, 'the live card was taken down');

  // A plain edit (the legacy editor's shape) — price change on a live card.
  await db.query(`UPDATE vendor_services SET starting_price_php = 40107 WHERE vendor_service_id = $1`, [id]);
  assert.equal((await row(id)).starting_price_php, 40107);

  // The atomic writer, staying live, with no cover and no inclusions → saves.
  await save(
    id,
    { category: 'live_band', starting_price_php: 40207, pricing_basis: 'fixed' },
    [],
    true,
  );
  const after = await row(id);
  assert.equal(after.is_active, true, 'a save of a live card unpublished it');
  assert.equal(after.starting_price_php, 40207, 'a save of a live card was refused');
});

test('…but a live card may still not EMPTY its price (the older rule stands)', async () => {
  const id = await grandfatheredLiveCard(40008);
  assert.equal(
    await refused(`UPDATE vendor_services SET starting_price_php = NULL WHERE vendor_service_id = $1`, [id]),
    PUBLISH_REFUSAL_MESSAGE.price,
  );
});

// ── save_vendor_service: the same three, from the payload ───────────────────

test('the RPC refuses a NEW card published without a cover, a price, or anything included', async () => {
  const base = { category: 'live_band', pricing_basis: 'fixed' };
  const cases: Array<[string, Record<string, unknown>, { label: string }[], string]> = [
    ['no cover', { ...base, starting_price_php: 40009 }, [{ label: 'Sound' }], PUBLISH_REFUSAL_MESSAGE.cover],
    ['no price', { ...base, primary_photo_r2_key: COVER }, [{ label: 'Sound' }], PUBLISH_REFUSAL_MESSAGE.price],
    ['nothing included', { ...base, starting_price_php: 40010, primary_photo_r2_key: COVER }, [], PUBLISH_REFUSAL_MESSAGE.inclusions],
    ['a blank inclusion', { ...base, starting_price_php: 40011, primary_photo_r2_key: COVER }, [{ label: '  ' }], PUBLISH_REFUSAL_MESSAGE.inclusions],
  ];
  for (const [label, fields, inc, message] of cases) {
    let err: string | null = null;
    try {
      await save(null, fields, inc, true);
    } catch (e) {
      err = (e as Error).message;
    }
    assert.equal(err, message, label);
  }
  // …and a DRAFT with none of them saves (the escape is never refused).
  const d = await save(null, { ...base }, [], false);
  assert.equal((await row(d)).is_active, false);
});

test('the RPC publishes a complete new card, and publishes a draft once it is complete', async () => {
  const base = { category: 'live_band', pricing_basis: 'fixed', primary_photo_r2_key: COVER };
  const id = await save(null, { ...base, starting_price_php: 40012 }, [{ label: 'Sound system' }], true);
  assert.equal((await row(id)).is_active, true);

  const d = await save(null, { ...base, starting_price_php: 40013 }, [], false);
  let err: string | null = null;
  try {
    await save(d, { ...base, starting_price_php: 40013 }, [], true);
  } catch (e) {
    err = (e as Error).message;
  }
  assert.equal(err, PUBLISH_REFUSAL_MESSAGE.inclusions, 'a draft went live with nothing included');
  await save(d, { ...base, starting_price_php: 40013 }, [{ label: 'Two sets' }], true);
  assert.equal((await row(d)).is_active, true);
});

// ── host_mc gets its real name ──────────────────────────────────────────────

test('a blank host card is named "Host / MC by …", not "Host Mc by …"', async () => {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO vendor_services (vendor_profile_id, category, title, is_active)
     VALUES ($1, 'host_mc', NULL, false) RETURNING vendor_service_id`,
    [VP],
  );
  assert.equal((await row(r.rows[0]!.vendor_service_id)).title, 'Host / MC by Saysay Live Band');
  // A kind neither the schema table nor the tree knows still falls to the
  // humanised key — never a raw database key.
  const u = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO vendor_services (vendor_profile_id, category, title, is_active)
     VALUES ($1, 'a_kind_nobody_mapped', NULL, false) RETURNING vendor_service_id`,
    [VP],
  );
  assert.equal((await row(u.rows[0]!.vendor_service_id)).title, 'A Kind Nobody Mapped by Saysay Live Band');
});
