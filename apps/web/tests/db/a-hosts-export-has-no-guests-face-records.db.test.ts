/**
 * A HOST'S "DOWNLOAD MY DATA" CARRIES ONLY THEIR OWN FACE-TAGGING RECORDS.
 *
 * Owner 2026-10-01, on the controller's finding, verbatim: "yes fix it now".
 * The self-serve export read `guest_face_enrollments` with no subject filter
 * and let RLS decide — and RLS on that table admits a HOST every guest's row at
 * the events they run. So a couple's own RA 10173 data file carried the
 * face-tagging records of every guest who gave a selfie at their wedding.
 *
 * This runs the REAL read the route issues (lib/export-own-face-enrollments)
 * against the replayed schema, under the host's real RLS session, through the
 * PostgREST-shaped adapter — not a SQL re-statement of it.
 *
 * Fixture: a host runs a wedding where two guests (each with an account)
 * enrolled a selfie; the host is also a guest at a friend's party and enrolled
 * there. Expected export: exactly 1 row — the host's own — and 0 of the guests'.
 *
 * ⚠ The first test is the META-check that keeps the second honest: it proves
 * RLS really does hand the host all three rows. If it ever reads 1, the policy
 * changed and the fixture no longer exercises the leak; re-reason before
 * trusting a green second test.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { createPgliteRestClient } from './pglite-postgrest';
import { readOwnFaceEnrollments } from '../../lib/export-own-face-enrollments';

let replay: ReplayResult;
let db: PGlite;

const F = {
  host: '',
  guestA: '',
  guestB: '',
  friend: '',
  wedding: '',
  party: '',
  hostOwnGuestId: '',
  guestEnrollments: [] as string[],
  hostEnrollment: '',
};

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role','',false)`).catch(() => {});
  }
}

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function newEvent(name: string, coupleId: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1,'birthday', DATE '2026-12-12') RETURNING event_id`,
    [name],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleId],
  );
  return eventId;
}

/** A guest row at `eventId`, linked to `userId`'s account the way the app links it. */
async function linkedGuest(eventId: string, userId: string, first: string): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests
       (event_id, first_name, last_name, side, group_category, role, rsvp_status,
        meal_preference, invited_to_blocks, entry_source, photo_consent)
     VALUES ($1,$2,'Export','both','other','guest','attending','no_preference',
             ARRAY['ceremony','reception'],'host_seeded',true)
     RETURNING guest_id`,
    [eventId, first],
  );
  const guestId = g.rows[0]!.guest_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id)
     VALUES ($1,$2,'guest',$3)`,
    [eventId, userId, guestId],
  );
  return guestId;
}

async function enroll(eventId: string, guestId: string): Promise<string> {
  const r = await db.query<{ enrollment_id: string }>(
    `INSERT INTO public.guest_face_enrollments
       (event_id, guest_id, asset_url, source, consent_at)
     VALUES ($1,$2,$3,'rsvp_selfie',NOW()) RETURNING enrollment_id`,
    [eventId, guestId, `r2://setnayan-media/event-${eventId}/selfie/${guestId}.jpg`],
  );
  return r.rows[0]!.enrollment_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.host = await newUser('export-host@example.com');
  F.guestA = await newUser('export-guest-a@example.com');
  F.guestB = await newUser('export-guest-b@example.com');
  F.friend = await newUser('export-friend@example.com');

  F.wedding = await newEvent('The host’s wedding', F.host);
  F.party = await newEvent('A friend’s party', F.friend);

  // Two guests at the host's wedding, each enrolled.
  F.guestEnrollments.push(await enroll(F.wedding, await linkedGuest(F.wedding, F.guestA, 'Ana')));
  F.guestEnrollments.push(await enroll(F.wedding, await linkedGuest(F.wedding, F.guestB, 'Ben')));
  // The host, as a guest elsewhere, enrolled there.
  F.hostOwnGuestId = await linkedGuest(F.party, F.host, 'Host');
  F.hostEnrollment = await enroll(F.party, F.hostOwnGuestId);
});

after(async () => {
  await db?.close();
});

test('META · RLS alone hands the host every guest’s face record (the leak this fixes)', async () => {
  const seen = await asUser(F.host, async () => {
    const r = await db.query<{ enrollment_id: string }>(
      `SELECT enrollment_id FROM public.guest_face_enrollments`,
    );
    return r.rows.map((x) => x.enrollment_id).sort();
  });
  assert.deepEqual(
    seen,
    [...F.guestEnrollments, F.hostEnrollment].sort(),
    'the fixture no longer reproduces the host arm — the next test would pass vacuously',
  );
});

test('the host’s export holds exactly ONE face record — their own — and none of their guests’', async () => {
  const rest = await createPgliteRestClient(db);
  const res = await asUser(F.host, () =>
    readOwnFaceEnrollments(rest as unknown as SupabaseClient, F.host),
  );
  assert.equal(res.error, null, `the read failed: ${res.error?.message}`);
  const ids = (res.data as Array<{ enrollment_id: string }>).map((r) => r.enrollment_id);
  const guestsLeaked = ids.filter((id) => F.guestEnrollments.includes(id));
  console.log(`host export: ${ids.length} face record(s), ${guestsLeaked.length} belonging to their guests`);
  assert.equal(guestsLeaked.length, 0, 'the host’s export carries their guests’ face-tagging records');
  assert.deepEqual(ids, [F.hostEnrollment], 'the host’s own face record is missing from their export');
  // The biometric itself never leaves.
  for (const row of res.data as Array<Record<string, unknown>>) {
    assert.ok(!('face_vector' in row), 'face_vector must never be exported');
    assert.ok(!('asset_url' in row), 'the selfie itself must never be exported');
  }
});

test('a guest’s export holds their own record and nothing of the host’s or the other guest’s', async () => {
  const rest = await createPgliteRestClient(db);
  const res = await asUser(F.guestA, () =>
    readOwnFaceEnrollments(rest as unknown as SupabaseClient, F.guestA),
  );
  assert.equal(res.error, null);
  const ids = (res.data as Array<{ enrollment_id: string }>).map((r) => r.enrollment_id);
  assert.deepEqual(ids, [F.guestEnrollments[0]]);
});
