/**
 * A GUEST READS ONLY THE EVERYONE MOMENTS — the database's anonymous schedule
 * read keeps the same fence as the pages (migration 20271267138064).
 *
 * A moment can be "Only for · Entourage / Sponsors / Family / Suppliers"
 * (`event_schedule_blocks.audience`; NULL = Everyone). The pages ask
 * `onlyWhatGuestsMaySee` (lib/schedule.ts): public · for Everyone · released.
 * Before 20271267138064 the `anon` policy asked only the first and the last, so
 * anyone with the public key and an event id read a role-only moment straight
 * from PostgREST — label, times, location, tagged suppliers.
 *
 * Proved through REAL `anon` / `authenticated` sessions on the replayed schema:
 *   1. anon reads the public, released Everyone moment — and nothing else;
 *   2. anon reads no role-only moment, of any of the four roles;
 *   3. the host still reads EVERY moment of their event — role-only, hidden and
 *      (through event_schedule_blocks_couple_write, which is FOR ALL) even a
 *      coordinator's unreleased prep: exactly what they read before;
 *   4. a booked supplier still reads the same set (unchanged: _booked_vendor_read);
 *   5. the policy text asks all three conditions, and the other read policies
 *      were not touched by this file.
 *
 * Sabotage: drop `AND audience IS NULL` from the migration → tests 1, 2 and 5 go red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let eventId: string;
let otherEventId: string;
let coupleUid: string;
let supplierUid: string;

/** label → how the moment is kept (or not) from the room. */
const MOMENTS = [
  { label: 'Ceremony for everybody', is_public: true, audience: null, visibility: 'couple_visible' },
  { label: 'Entourage photos', is_public: true, audience: 'entourage', visibility: 'couple_visible' },
  { label: 'Sponsors signing', is_public: true, audience: 'sponsors', visibility: 'couple_visible' },
  { label: 'Family portrait', is_public: true, audience: 'family', visibility: 'couple_visible' },
  { label: 'Suppliers call time', is_public: true, audience: 'suppliers', visibility: 'couple_visible' },
  { label: 'Hidden rehearsal', is_public: false, audience: null, visibility: 'couple_visible' },
  { label: 'Coordinator prep', is_public: true, audience: null, visibility: 'coordinator_only' },
] as const;

const EVERYONE = ['Ceremony for everybody'];
const ROLE_ONLY = ['Entourage photos', 'Sponsors signing', 'Family portrait', 'Suppliers call time'];
/** What a booked supplier read before this migration, and must still read. */
const ALL_BUT_PREP = MOMENTS.filter((m) => m.visibility !== 'coordinator_only').map((m) => m.label).sort();

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function asOwner(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

async function asAnon(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('anon');
  await db.exec('SET ROLE anon');
}

async function asUser(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec('SET ROLE authenticated');
}

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [email]);
  return u.rows[0]!.id;
}

/** The labels this session reads for the event — the same request PostgREST makes. */
async function labels(ev: string = eventId): Promise<string[]> {
  const r = await db.query<{ label: string }>(
    `SELECT label FROM public.event_schedule_blocks WHERE event_id = $1 ORDER BY label`,
    [ev],
  );
  return r.rows.map((x) => x.label).sort();
}

async function newEvent(name: string): Promise<string> {
  return (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
       VALUES ($1, 'birthday', '2027-03-03'::date, 'day', 'NCR') RETURNING event_id`,
      [name],
    )
  ).rows[0]!.event_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.exec('BEGIN');
  await asOwner();

  coupleUid = await newUser('host@schedule-fence.test');
  supplierUid = await newUser('supplier@schedule-fence.test');

  eventId = await newEvent('Schedule fence');
  otherEventId = await newEvent('Someone else');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, coupleUid]);

  let order = 0;
  for (const ev of [eventId, otherEventId]) {
    for (const m of MOMENTS) {
      order += 1;
      await db.query(
        `INSERT INTO public.event_schedule_blocks
           (event_id, label, block_type, start_at, end_at, sort_order, is_public, audience, visibility, location)
         VALUES ($1, $2, 'custom', '2027-03-03T08:00:00Z', '2027-03-03T09:00:00Z', $3, $4, $5, $6, 'The garden')`,
        [ev, m.label, order, m.is_public, m.audience, m.visibility],
      );
    }
  }

  // A supplier booked on THIS event only.
  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1, 'Lights Co', 'Manila', ARRAY['catering']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
      [supplierUid],
    )
  ).rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, 'catering', 'Lights Co', 'contracted', 100000, $2)`,
    [eventId, vp],
  );
});

after(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await db.exec('ROLLBACK').catch(() => {});
  await setAuthUid(db, null);
  await db?.close();
});

test('META: every seeded moment is there, and the sessions are really anon / authenticated', async () => {
  await asOwner();
  assert.deepEqual(await labels(), MOMENTS.map((m) => m.label).sort(), 'without every row, a refusal proves nothing');
  await asAnon();
  const a = await db.query<{ cu: string }>(`SELECT current_user AS cu`);
  assert.equal(a.rows[0]!.cu, 'anon', 'SET ROLE anon did not take — every refusal below would be vacuous');
  await asUser(coupleUid);
  const u = await db.query<{ cu: string }>(`SELECT current_user AS cu`);
  assert.equal(u.rows[0]!.cu, 'authenticated');
});

test('anon reads the public, released Everyone moment — and nothing else', async () => {
  await asAnon();
  assert.deepEqual(await labels(), EVERYONE, 'a guest without a session read more (or less) than the Everyone moment');
  assert.deepEqual(await labels(otherEventId), EVERYONE, 'the fence holds on every event, not just one');
});

test('anon reads no role-only moment — of any of the four roles, by any column', async () => {
  await asAnon();
  for (const label of ROLE_ONLY) {
    const r = await db.query(
      `SELECT block_id, start_at, end_at, location, responsible_vendor_ids
         FROM public.event_schedule_blocks WHERE event_id = $1 AND label = $2`,
      [eventId, label],
    );
    assert.equal(r.rows.length, 0, `anon read the role-only moment "${label}" straight from the table`);
  }
  const byAudience = await db.query(
    `SELECT 1 FROM public.event_schedule_blocks WHERE audience IS NOT NULL`,
  );
  assert.equal(byAudience.rows.length, 0, 'anon can still find a moment for a role by asking for it');
});

test('the host still reads every moment of their event', async () => {
  await asUser(coupleUid);
  // Measured on the policy before this migration too: _couple_write is FOR ALL, so it admits the prep row as well.
  assert.deepEqual(await labels(), MOMENTS.map((m) => m.label).sort(), 'the host lost a moment of their own day');
  assert.deepEqual(await labels(otherEventId), [], 'the host reads another event');
});

test('a booked supplier still reads what it read before — the whole day but the prep', async () => {
  await asUser(supplierUid);
  assert.deepEqual(await labels(), ALL_BUT_PREP, 'a booked supplier lost a moment it could read');
  assert.deepEqual(await labels(otherEventId), [], 'a supplier reads an event it is not booked on');
});

test('the policy asks all three conditions, and is still the only anon read', async () => {
  await asOwner();
  const r = await db.query<{ policyname: string; roles: string; qual: string; cmd: string }>(
    `SELECT policyname, roles::text AS roles, qual, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'event_schedule_blocks'
      ORDER BY policyname`,
  );
  const anon = r.rows.filter((p) => p.roles.includes('anon') || p.roles.includes('public'));
  assert.deepEqual(anon.map((p) => p.policyname), ['event_schedule_blocks_public_read'], 'another policy opens the table to anon');
  const q = anon[0]!.qual;
  assert.equal(anon[0]!.cmd, 'SELECT');
  assert.match(q, /is_public = true/, 'the anon read lost "is public"');
  assert.match(q, /visibility <> 'coordinator_only'/, 'the anon read lost "released"');
  assert.match(q, /audience IS NULL/, 'the anon read lost "for Everyone"');

  // The other read policies are the ones 20270901120000 / 20271262573732 left — this file did not narrow them.
  const quals = Object.fromEntries(r.rows.map((p) => [p.policyname, p.qual]));
  for (const name of [
    'event_schedule_blocks_couple_read',
    'event_schedule_blocks_booked_vendor_read',
    'event_schedule_blocks_moderator_read',
  ]) {
    assert.ok(quals[name], `${name} is missing`);
    assert.doesNotMatch(quals[name]!, /audience/, `${name} was narrowed by audience — a host or supplier would lose a moment`);
  }
});
