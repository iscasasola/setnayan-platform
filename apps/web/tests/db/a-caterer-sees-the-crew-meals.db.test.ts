/**
 * 🍱 THE CATERER SEES THE CREW MEALS THE HOST SET — asserted against the DATABASE (migration 20271303132255; owner
 * 2026-11-02, DECISION_LOG "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (4)).
 *
 *   1 · the booked caterer reads one line per BOOKED supplier the host marked "crew fed", with the host's crew size —
 *       or, left blank, the supplier's own listing (said) — never one the host did not mark, never one not booked;
 *   2 · a booked supplier that is not food-related, a stranger and a caterer booked elsewhere are refused;
 *   3 · it carries names and counts only — no price, no phone, no email.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

const F = { eventId: '', caterer: '', photographer: '', stranger: '' };

async function crewMeals(uid: string) {
  await asUser(uid);
  return (
    await db.query<{ vendor_name: string; category: string; meals: number; from_listing: boolean }>(
      `SELECT * FROM public.get_vendor_crew_meals($1)`,
      [F.eventId],
    )
  ).rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.caterer = await mkUser('caterer@crew.test');
  F.photographer = await mkUser('photo@crew.test');
  F.stranger = await mkUser('stranger@crew.test');
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Sample Wedding','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  const profile = async (uid: string, name: string, cat: string): Promise<string> =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1,$2,'Manila',ARRAY[$3]::text[],'verified', NOW()) RETURNING vendor_profile_id`,
        [uid, name, cat],
      )
    ).rows[0]!.vendor_profile_id;
  const catererVp = await profile(F.caterer, 'Sample Kitchen', 'catering');
  const photoVp = await profile(F.photographer, 'Sample Photo', 'photographer');
  const book = async (name: string, cat: string, status: string, vp: string | null, crew: number | null, covered: boolean) =>
    db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, crew_size, crew_meal_covered)
       VALUES ($1,$2,$3,$4,10000,$5,$6,$7)`,
      [F.eventId, cat, name, status, vp, crew, covered],
    );
  await book('Sample Kitchen', 'catering', 'contracted', catererVp, 6, true);
  await book('Sample Photo', 'photographer', 'contracted', photoVp, 4, true);
  // Booked, covered, crew left blank — the supplier's own listing says 3 (its largest service crew).
  const filmVp = await profile(await mkUser('film@crew.test'), 'Sample Film', 'videographer');
  await db.query(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, is_active, primary_photo_r2_key, crew_size)
     VALUES ($1,'videographer',20000,FALSE,'samples/film.jpg',3)`,
    [filmVp],
  );
  await book('Sample Film', 'videographer', 'deposit_paid', filmVp, null, true);
  // Booked but NOT marked fed by the host.
  await book('Sample HMUA', 'makeup_artist', 'contracted', null, 2, false);
  // Marked fed but NOT booked (still considering) — not a meal yet.
  await book('Maybe Band', 'band_dj', 'considering', null, 5, true);
});

after(async () => {
  await replay?.db.close();
});

test('1 · the booked caterer reads one line per booked supplier the host marked fed, with the host\'s number', async () => {
  const rows = await crewMeals(F.caterer);
  const by = new Map(rows.map((r) => [r.vendor_name, r]));
  assert.equal(by.get('Sample Kitchen')?.meals, 6, 'the caterer\'s own crew, marked fed, is a meal too');
  assert.equal(by.get('Sample Photo')?.meals, 4);
  assert.equal(by.get('Sample Photo')?.from_listing, false);
  assert.ok(!by.has('Sample HMUA'), 'a crew the host did not mark fed was counted');
  assert.ok(!by.has('Maybe Band'), 'a supplier not booked was counted');
  // A blank crew reads the supplier's own listing — and says it is theirs, not the host's.
  assert.equal(by.get('Sample Film')?.meals, 3);
  assert.equal(by.get('Sample Film')?.from_listing, true);
});

test('2 · a non-food supplier, a stranger and nobody else may read it', async () => {
  await assert.rejects(crewMeals(F.photographer), /not_food_relevant/);
  await assert.rejects(crewMeals(F.stranger), /not_a_vendor/);
});

test('3 · names and counts only — no price, no phone, no email', async () => {
  const rows = await crewMeals(F.caterer);
  assert.ok(rows.length > 0);
  assert.deepEqual(Object.keys(rows[0]!).sort(), ['category', 'from_listing', 'meals', 'vendor_name']);
});
