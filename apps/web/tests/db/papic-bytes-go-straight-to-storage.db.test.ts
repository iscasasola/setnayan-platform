/**
 * PAPIC: THE BYTES GO STRAIGHT TO STORAGE — migration 20271285508020, against
 * the REPLAYED schema.
 *
 *   • papic_upload_intents is service-role only: a signed-in user and an anon
 *     visitor can neither read nor write it (it names every key we signed).
 *   • it refuses a ref outside `r2://<bucket>/papic/…`, an unknown lane or tier,
 *     and a second row for the same key (a re-sign upserts).
 *   • a supplier's shutter lands once: vendor_papic_captures.client_capture_id is
 *     UNIQUE per supplier — a replayed record cannot add a second row (and so
 *     cannot meter twice: the supplier's meter counts rows).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('bytes straight to storage', 'birthday') RETURNING event_id`,
  );
  eventId = r.rows[0]!.event_id;
});
after(async () => {
  await db?.close();
});

const OWNER = '2d8f4c6e-3b5f-4a7c-9d9e-0f1a2b3c4d5e';
const CCID = '3e9a5d7f-4c6a-4b8d-8e0f-1a2b3c4d5e6f';
const ref = (tier: string) => `r2://setnayan-media/papic/guest/${OWNER}/incoming/cap-${CCID}-${tier}.webp`;

async function insertIntent(over: Record<string, unknown> = {}): Promise<string | null> {
  const row = {
    lane: 'guest',
    event_id: eventId,
    owner_id: OWNER,
    client_capture_id: CCID,
    tier: 'thumb',
    r2_ref: ref('thumb'),
    size_bytes: 30000,
    content_type: 'image/webp',
    ...over,
  };
  try {
    await db.query(
      `INSERT INTO public.papic_upload_intents (lane, event_id, owner_id, client_capture_id, tier, r2_ref, size_bytes, content_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [row.lane, row.event_id, row.owner_id, row.client_capture_id, row.tier, row.r2_ref, row.size_bytes, row.content_type],
    );
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

test('the service role records an intent; the same key twice is refused (a re-sign upserts)', async () => {
  assert.equal(await insertIntent(), null);
  assert.match((await insertIntent()) ?? '', /duplicate key|unique/i);
});

test('it refuses a ref outside papic/, an unknown lane, an unknown tier, a size over 40 MB', async () => {
  assert.match((await insertIntent({ r2_ref: 'r2://setnayan-media/events/x/cover.jpg' })) ?? '', /papic_upload_intents_ref_chk/);
  assert.match((await insertIntent({ r2_ref: ref('tile'), lane: 'seat' })) ?? '', /papic_upload_intents_lane_chk/);
  assert.match((await insertIntent({ r2_ref: ref('tile'), tier: 'banner' })) ?? '', /papic_upload_intents_tier_chk/);
  assert.match((await insertIntent({ r2_ref: ref('tile'), size_bytes: 40_000_001 })) ?? '', /papic_upload_intents_size_chk/);
});

test('🔒 a signed-in user and an anon visitor can neither read nor write it', async () => {
  for (const role of ['authenticated', 'anon']) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(db.query(`SELECT count(*) FROM public.papic_upload_intents`), /permission denied/i, `${role} read the intents`);
      await assert.rejects(
        db.query(`DELETE FROM public.papic_upload_intents`),
        /permission denied/i,
        `${role} could delete the intents (the sweep's only memory of what to clean)`,
      );
    } finally {
      await db.exec(`RESET ROLE`);
    }
  }
});

test('a supplier shutter lands once — client_capture_id is unique per supplier', async () => {
  const vendorA = '4f0b6e8a-5d7b-4c9e-9f1a-2b3c4d5e6f70';
  const vendorB = '5a1c7f9b-6e8c-4d0f-8a2b-3c4d5e6f7081';
  const insert = (vendor: string, id: string | null, n: number) =>
    db.query(
      `INSERT INTO public.vendor_papic_captures (vendor_profile_id, event_id, r2_object_key, media_type, consent_basis, client_capture_id)
       VALUES ($1, $2, $3, 'photo', 'event_consent', $4::uuid)`,
      [vendor, eventId, `r2://setnayan-media/papic/vendor-${vendor}/event-${eventId}/cap-${n}-thumb.webp`, id],
    );
  await insert(vendorA, CCID, 1);
  await assert.rejects(insert(vendorA, CCID, 2), /vendor_papic_captures_client_capture_uniq|duplicate key/i);
  await insert(vendorB, CCID, 3); // another supplier's phone may mint the same id
  await insert(vendorA, null, 4); // rows from before the column are unconstrained
  await insert(vendorA, null, 5);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_papic_captures WHERE vendor_profile_id = $1`,
    [vendorA],
  );
  assert.equal(r.rows[0]!.n, 3);
});
