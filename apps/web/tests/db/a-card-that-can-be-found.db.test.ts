/**
 * A CARD THAT CAN BE FOUND — the publish gate, proved against a real schema.
 *
 * ── WHY THE FENCE IS IN THE DATABASE ───────────────────────────────────────
 * `vendor_services` carries a PERMISSIVE `FOR ALL` policy whose whole test is
 * "this row is yours" (`vendor_services_manage`), and `authenticated` holds
 * UPDATE on all 40 of its columns. So a signed-in shop can PATCH
 * `/rest/v1/vendor_services` with the public anon key, set `is_active = true`,
 * and meet no TypeScript in this repo. Every check in `services/actions.ts` is
 * the polite version of the refusal; `enforce_service_publish_gate` is the
 * refusal.
 *
 * ── WHY THIS TEST IS MEANINGFUL WHERE AN RLS TEST WOULD NOT BE ─────────────
 * The PGlite replay runs as superuser and `relrowsecurity` is vacuous in it, so
 * a policy assertion here can be true for the wrong reason. A TRIGGER is not a
 * policy: it fires for every role, superuser included, which is exactly why the
 * gate was put in one. What passes here therefore passes in production for the
 * same reason.
 *
 * ── AND WHY IT WAS ALSO DRY-RUN AGAINST PRODUCTION ─────────────────────────
 * All eight cases below were run against the live database inside a
 * self-rolling-back transaction before this shipped (transcript in the PR
 * body), and prod was verified afterwards to hold the same 2 rows, no trigger
 * and no function. The replay is the standing guard; the dry run is the proof
 * the DDL applies to the schema production actually has.
 *
 * ⚠ EVERY CASE ASSERTS A VALUE, in both directions. "The insert was refused"
 * and "the insert never ran" look identical from a row count alone.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { FIXTURE_COVER, FIXTURE_INCLUSION } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;

const VP = '11111111-1111-4111-8111-111111111111';
const CATEGORY = 'live_band';
const PERK = 'One extra set, free';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(
    `INSERT INTO vendor_profiles (vendor_profile_id, business_name)
     VALUES ($1, 'The Gate Test Band')
     ON CONFLICT (vendor_profile_id) DO NOTHING`,
    [VP],
  );
});
after(async () => {
  await db?.close();
});

/** Runs a statement and reports whether the database refused it. */
async function refused(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: string }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

/** Inserts a DRAFT and returns its id — the only way in that is never judged. */
async function draft(fields: Record<string, unknown> = {}): Promise<string> {
  const cols = ['vendor_profile_id', 'category', 'is_active', ...Object.keys(fields)];
  const vals = [VP, CATEGORY, false, ...Object.values(fields)];
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO vendor_services (${cols.join(', ')})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING vendor_service_id`,
    vals,
  );
  return r.rows[0]!.vendor_service_id;
}

test('the migration installed the gate as a trigger, not as advice', async () => {
  assert.equal(
    await count(
      `SELECT count(*) AS n FROM pg_trigger
        WHERE tgname = 'trg_enforce_service_publish_gate'
          AND tgrelid = 'public.vendor_services'::regclass`,
    ),
    1,
    'the publish gate trigger is missing',
  );
});

test('publishing with no price is REFUSED', async () => {
  const err = await refused(
    `WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, is_active, exclusive_perk_text, primary_photo_r2_key)
     VALUES ($1, $2, true, $3, '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT 1 FROM s LIMIT 0`,
    [VP, CATEGORY, PERK],
  );
  assert.ok(err, 'a priceless card was published');
  assert.match(err, /starting price/i);
});

test('ZERO IS NOT A PRICE — publishing at ₱0 is REFUSED', async () => {
  const err = await refused(
    `WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, is_active, starting_price_php, exclusive_perk_text, primary_photo_r2_key)
     VALUES ($1, $2, true, 0, $3, '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT 1 FROM s LIMIT 0`,
    [VP, CATEGORY, PERK],
  );
  assert.ok(err, '₱0 was accepted as a price');
  assert.match(err, /starting price/i);
});

test('the Setnayan Exclusive gate is GONE — a giftless card publishes', async () => {
  // ⚖ THIS TEST ASSERTED THE EXACT OPPOSITE UNTIL 2026-09-09, when the owner
  // ruled the gift optional: "exclusive setnayan gift then should be optional."
  // Compulsory was never a feature, it was a RATE — the gift is 40% of the
  // booking fee charged ON TOP of it, so requiring it took what a shop pays us
  // from 5% to 7% of the first PHP 100,000 and made the line we sell against
  // 25%-commission rivals with ("we only charge 5% and 1%") untrue.
  //
  // ⛔ PUTTING THE REFUSAL BACK IS AN OWNER DECISION, NOT A TIDY-UP.
  //
  // 🔑 DISTINCT PRICES, NOT 45000. These inserts SUCCEED now, and the next test
  // counts rows at 45000 — so reusing that figure would leave this test's rows
  // in that count and fail a test that is actually correct. That is precisely
  // how this file broke when the gate was relaxed: nothing cleans up between
  // tests, and a refusal that becomes an acceptance starts leaving rows behind.
  const err = await refused(
    `WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, is_active, starting_price_php, primary_photo_r2_key)
     VALUES ($1, $2, true, 45001, '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT 1 FROM s LIMIT 0`,
    [VP, CATEGORY],
  );
  assert.equal(err, null, `a giftless card was refused: ${err}`);
  assert.equal(
    await count(
      `SELECT count(*) AS n FROM vendor_services
        WHERE vendor_profile_id = $1 AND is_active AND starting_price_php = 45001`,
      [VP],
    ),
    1,
    'the giftless card is not in the table — refused, or never inserted',
  );

  // Whitespace is not an Exclusive, and no longer needs to be.
  const blank = await refused(
    `WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, is_active, starting_price_php, exclusive_perk_text, primary_photo_r2_key)
     VALUES ($1, $2, true, 45002, '   ', '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT 1 FROM s LIMIT 0`,
    [VP, CATEGORY],
  );
  assert.equal(blank, null, `a whitespace Exclusive was refused: ${blank}`);
});

test('the PRICE gate still bites — the requirement that did NOT move', async () => {
  // The other half of the same ruling: exactly one publish requirement is left,
  // and this test exists so relaxing the gift cannot be mistaken for relaxing
  // the gate. A card with no starting price is still refused, with the sentence
  // written for the shop rather than a raw Postgres error.
  const err = await refused(
    `WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, is_active, starting_price_php, primary_photo_r2_key)
     VALUES ($1, $2, true, NULL, '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT 1 FROM s LIMIT 0`,
    [VP, CATEGORY],
  );
  assert.ok(err, 'an unpriced card was published');
  assert.match(err, /starting price/i);
});

test('a complete card publishes — the gate is not simply refusing everything', async () => {
  const err = await refused(
    `WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, is_active, starting_price_php, exclusive_perk_text, primary_photo_r2_key)
     VALUES ($1, $2, true, 45000, $3, '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT 1 FROM s LIMIT 0`,
    [VP, CATEGORY, PERK],
  );
  assert.equal(err, null, `a complete card was refused: ${err}`);
  assert.equal(
    await count(
      `SELECT count(*) AS n FROM vendor_services
        WHERE vendor_profile_id = $1 AND is_active AND starting_price_php = 45000`,
      [VP],
    ),
    1,
    'the accepted card is not in the table',
  );
});

test('A DRAFT IS NEVER JUDGED — an empty card saves, and stays a draft', async () => {
  const id = await draft();
  assert.equal(
    await count(
      `SELECT count(*) AS n FROM vendor_services
        WHERE vendor_service_id = $1 AND NOT is_active`,
      [id],
    ),
    1,
    'an empty draft was refused — "save as a draft" is the escape and must never be',
  );
});

test('flipping a draft live without a price is REFUSED (the toggle path)', async () => {
  const id = await draft({ exclusive_perk_text: PERK });
  const err = await refused(
    `UPDATE vendor_services SET is_active = true WHERE vendor_service_id = $1`,
    [id],
  );
  assert.ok(err, 'a priceless draft was switched live');
  assert.equal(
    await count(
      `SELECT count(*) AS n FROM vendor_services WHERE vendor_service_id = $1 AND is_active`,
      [id],
    ),
    0,
    'the row went live anyway',
  );
});

test('A CONTROL HONOURED ONLY ON THE WAY IN IS NOT A CONTROL — the price cannot be removed from a live card', async () => {
  const r = await db.query<{ vendor_service_id: string }>(
    `WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, is_active, starting_price_php, exclusive_perk_text, primary_photo_r2_key)
     VALUES ($1, $2, true, 45000, $3, '${FIXTURE_COVER}')
     RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   )
   SELECT vendor_service_id FROM s`,
    [VP, CATEGORY, PERK],
  );
  const id = r.rows[0]!.vendor_service_id;
  assert.ok(
    await refused(
      `UPDATE vendor_services SET starting_price_php = NULL WHERE vendor_service_id = $1`,
      [id],
    ),
    'a live card was stripped of its price',
  );
  // ⚖ AND THE ONE THAT IS NO LONGER A CONTROL. Emptying the Setnayan Exclusive
  // on a LIVE card is allowed since 2026-09-09 — the gift is optional, so there
  // is nothing to strip. Asserted as a VALUE in both directions, per this
  // file's own rule: the update is accepted AND the column really is empty.
  assert.equal(
    await refused(
      `UPDATE vendor_services SET exclusive_perk_text = '' WHERE vendor_service_id = $1`,
      [id],
    ),
    null,
    'a live card was refused permission to drop its now-optional gift',
  );
  assert.equal(
    await count(
      `SELECT count(*) AS n FROM vendor_services
        WHERE vendor_service_id = $1 AND exclusive_perk_text = ''`,
      [id],
    ),
    1,
    'the Exclusive was not actually cleared',
  );
  assert.equal(
    await count(
      `SELECT count(*) AS n FROM vendor_services
        WHERE vendor_service_id = $1 AND starting_price_php = 45000`,
      [id],
    ),
    1,
    'the price is gone despite the refusal',
  );
});

test('NO CLIFF — an unrelated edit of a legacy live priceless card is allowed', async () => {
  // Production holds two of exactly these: live, no price, no Exclusive, seeded
  // straight into the table. `merge_canonical_service()` rewrites `category` on
  // every live card when an admin folds one trade into another, so a blanket
  // "every live row must be complete" rule would make an unrelated admin act
  // fail on somebody else's legacy row. The gate judges the act of publishing,
  // not the state of the table.
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO vendor_services (vendor_profile_id, category, is_active)
     VALUES ($1, $2, false) RETURNING vendor_service_id`,
    [VP, CATEGORY],
  );
  const id = r.rows[0]!.vendor_service_id;
  // Bypass the gate the only way a legacy row could have got here — directly,
  // with the trigger momentarily disabled, which is what "seeded before the
  // rule existed" looks like.
  // (H2, 2026-09-11: "what's included" is judged by a second, DEFERRED trigger —
  // disabled alongside, because a legacy row predates that rule too. Both of
  // production's live cards were exactly this when H2 landed: no inclusions.)
  await db.query(`ALTER TABLE vendor_services DISABLE TRIGGER trg_enforce_service_publish_gate`);
  await db.query(`ALTER TABLE vendor_services DISABLE TRIGGER trg_enforce_service_publish_gate_inclusions_upd`);
  await db.query(`UPDATE vendor_services SET is_active = true WHERE vendor_service_id = $1`, [id]);
  await db.query(`ALTER TABLE vendor_services ENABLE TRIGGER trg_enforce_service_publish_gate`);
  await db.query(`ALTER TABLE vendor_services ENABLE TRIGGER trg_enforce_service_publish_gate_inclusions_upd`);

  assert.equal(
    await refused(
      `UPDATE vendor_services SET crew_size = 6 WHERE vendor_service_id = $1`,
      [id],
    ),
    null,
    'an unrelated edit of a legacy live row was refused — that is the cliff',
  );
  assert.equal(
    await count(
      `SELECT count(*) AS n FROM vendor_services WHERE vendor_service_id = $1 AND crew_size = 6`,
      [id],
    ),
    1,
    'the unrelated edit did not land',
  );
});
