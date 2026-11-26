/**
 * A6-48 (final check 25 Nov, area 6) — THE BRIEF SAYS WHICH GUESTS THE HOSTS COUNT
 * (migration the_brief_says_how_the_hosts_count).
 *
 * A supplier cannot read `events`, so their Headcount card drew "attending of invited" whatever the hosts count by.
 * `get_vendor_event_brief` now hands `pax.headcount_basis` (events.headcount_basis — the basis a supplier's pax follows);
 * the page counts it with `briefHeadcount` → `headcountForBasis`. Counts are unchanged.
 *
 * 🛡 Sabotage: drop the `'headcount_basis'` key → the first assert is red.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { briefHeadcount } from '../../lib/brief-headcount';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let supplier = '';

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{ v: T }>(sql, params)).rows[0]!.v;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const couple = await one<string>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('bhc-c@t.test', '{"account_type":"customer"}') RETURNING id AS v`);
  supplier = await one<string>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('bhc-s@t.test', '{"account_type":"customer"}') RETURNING id AS v`);
  const vpid = await one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Count Co', 'Manila', ARRAY['catering']::text[], 'verified', NOW(), 'verified') RETURNING vendor_profile_id AS v`,
    [supplier],
  );
  eventId = await one<string>(`INSERT INTO public.events (display_name, event_type, event_date) VALUES ('Basis', 'birthday', '2099-06-06') RETURNING event_id AS v`);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'catering', 'Count Co', 'contracted', $2)`,
    [eventId, vpid],
  );
  for (const [first, rsvp] of [['Ana', 'attending'], ['Ben', 'attending'], ['Cy', 'maybe'], ['Di', 'pending'], ['Ed', 'declined']] as const) {
    await db.query(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status) VALUES ($1, $2, 'Cruz', 'both', 'friends', $3::public.rsvp_status)`,
      [eventId, first, rsvp],
    );
  }
});

after(async () => {
  await replay?.db.close();
});

type Pax = { invited: number; attending: number; maybe: number; pending: number; declined: number; headcount_basis?: string };

async function briefPax(): Promise<Pax> {
  await setAuthUid(db, supplier);
  try {
    return (await db.query<{ r: { pax: Pax } }>(`SELECT public.get_vendor_event_brief($1) AS r`, [eventId])).rows[0]!.r.pax;
  } finally {
    await setAuthUid(db, null);
  }
}

test('the brief hands the hosts’ basis, and the card’s count follows it', async () => {
  let pax = await briefPax();
  assert.equal(pax.headcount_basis, 'attending', 'the owner-locked default');
  assert.equal(briefHeadcount(pax as Parameters<typeof briefHeadcount>[0]), 2);

  await db.query(`UPDATE public.events SET headcount_basis = 'attending_plus_maybe' WHERE event_id = $1`, [eventId]);
  pax = await briefPax();
  assert.equal(pax.headcount_basis, 'attending_plus_maybe');
  assert.equal(briefHeadcount(pax as Parameters<typeof briefHeadcount>[0]), 3);

  await db.query(`UPDATE public.events SET headcount_basis = 'invited' WHERE event_id = $1`, [eventId]);
  pax = await briefPax();
  assert.equal(briefHeadcount(pax as Parameters<typeof briefHeadcount>[0]), 4, 'everyone not declined');
  assert.deepEqual([pax.invited, pax.attending, pax.maybe, pax.pending, pax.declined], [5, 2, 1, 1, 1], 'the counts themselves are unchanged');
});
