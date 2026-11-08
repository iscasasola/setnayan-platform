/**
 * 🪑 THE SEAT PLAN OPENS FOR GUEST BOOTHS, PERFORMERS AND AV PRODUCTION (owner, 6 Nov 2026 ·
 * migration 20271320476390_seat_plan_opens_for_booths_performers_and_av).
 *
 * DECISION_LOG 2026-11-06 "SUPPLIER ACCESS MAP (#6407): FOUR OWNER CALLS", call (2): add `guest_booth`,
 * `performers` and `av_production` to the seat-plan read. Call (3) keeps meal counts to the food categories.
 *
 * Against the replayed migrations, on one event whose plan is shown:
 *   · a booked guest booth, performer and AV crew each OPEN the plan, with its table, and get no meal counts;
 *   · a booked caterer still opens it WITH meal counts (control — the meal gate is unchanged);
 *   · a booked crew-meals supplier is still refused (`category_not_floor`) — the list grew by three, not to all.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
const uidOf = new Map<string, string>();

const OPENS = ['guest_booth', 'performers', 'av_production'] as const;

async function bookSupplier(category: string): Promise<void> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${category}@seat-plan-opens.test`],
  );
  const uid = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY[$3]::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid, `Shop ${category}`, category],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, $2::public.vendor_category, $3, 'contracted'::public.vendor_status, $4)`,
    [eventId, category, `Shop ${category}`, v.rows[0]!.vendor_profile_id],
  );
  uidOf.set(category, uid);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Lia & Paolo', 'birthday', ((now() AT TIME ZONE 'Asia/Manila')::date + 30), 'day') RETURNING event_id`,
  );
  eventId = e.rows[0]!.event_id;
  // A drawn plan the couple chose to show early, so only the category gate decides.
  await db.query(`INSERT INTO public.event_floor_plan (event_id, published_at) VALUES ($1, NOW())`, [eventId]);
  await db.query(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity, sort_order)
     VALUES ($1, 'Table 1', 'round_8', 8, 1)`,
    [eventId],
  );
  for (const c of [...OPENS, 'catering', 'crew_meals']) await bookSupplier(c);
});

after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});

type Plan = { tables: { meal_counts: unknown }[]; dietary_included: boolean };

/** The seat plan as this supplier sees it, or the error it is refused with. */
async function planFor(category: string): Promise<Plan | string> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uidOf.get(category)!);
  try {
    const r = await db.query<{ p: Plan }>(`SELECT public.get_vendor_seat_plan($1) AS p`, [eventId]);
    return r.rows[0]!.p;
  } catch (err) {
    return String((err as Error).message);
  } finally {
    await setAuthUid(db, null);
  }
}

for (const category of OPENS) {
  test(`a booked ${category} opens the seat plan, with its table, and no meal counts`, async () => {
    const plan = await planFor(category);
    assert.equal(typeof plan, 'object', `${category} was refused: ${String(plan)}`);
    const p = plan as Plan;
    assert.equal(p.tables.length, 1, 'the plan opens WITH its table — not an empty shell');
    assert.equal(p.dietary_included, false, `${category} was handed meal counts`);
    assert.equal(p.tables[0]!.meal_counts, null);
  });
}

test('a booked caterer still opens it WITH meal counts (the meal gate is unchanged)', async () => {
  const plan = await planFor('catering');
  assert.equal(typeof plan, 'object', `catering was refused: ${String(plan)}`);
  assert.equal((plan as Plan).dietary_included, true);
});

test('a booked crew-meals supplier is still refused — three were added, not everyone', async () => {
  const plan = await planFor('crew_meals');
  assert.equal(typeof plan, 'string', 'crew_meals opened the seat plan');
  assert.match(plan as string, /category_not_floor/);
});
