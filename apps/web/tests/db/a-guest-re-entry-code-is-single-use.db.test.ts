/**
 * A GUEST RE-ENTRY CODE IS SINGLE-USE, SHORT-LIVED AND HASHED AT REST — the
 * schema half, against the REPLAYED migrations (owner 2026-10-04, guest-flow
 * I9 + the in-app "Open in Safari" hop of I4). The logic half — mint, spend
 * once, expire — is lib/guest-reentry.test.ts.
 *
 *   1 · no browser role holds the table: anon and authenticated can neither
 *       read nor write it (RLS on at CREATE, every grant revoked);
 *   2 · only a sha256 can be stored — a raw code is refused by the CHECK;
 *   3 · the exchange's own statement (unused AND unexpired AND this event →
 *       used_at) wins ONCE: the second run touches no row, and an expired code
 *       is never spent;
 *   4 · a hard-deleted guest takes their codes with them.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let EVENT = '';
let GUEST = '';
let USER = '';

const hash = (code: string) => createHash('sha256').update(`setnayan-guest-reentry:${code}`).digest('hex');

/** The exchange's conditional UPDATE, as lib/guest-reentry.ts issues it through PostgREST. */
async function spend(code: string, eventId = EVENT): Promise<number> {
  const r = await db.query(
    `UPDATE public.guest_reentry_codes SET used_at = now()
      WHERE code_hash = $1 AND event_id = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING guest_id`,
    [hash(code), eventId],
  );
  return r.rows.length;
}

async function mint(code: string, expiresIn = '30 minutes', guestId = GUEST): Promise<void> {
  await db.query(
    `INSERT INTO public.guest_reentry_codes (code_hash, event_id, guest_id, purpose, created_at, expires_at)
     VALUES ($1, $2, $3, 'landing', now() - interval '1 hour', now() + $4::interval)`,
    [hash(code), EVENT, guestId, expiresIn],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ('couple@reentry.test', jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
  );
  USER = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ('Re-entry Party', 'birthday', '2027-07-07'::date, 'day', 'NCR') RETURNING event_id`,
  );
  EVENT = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [EVENT, USER],
  );
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Efren', 'Ramos', 'both', 'friends') RETURNING guest_id`,
    [EVENT],
  );
  GUEST = g.rows[0]!.guest_id;
});

after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});

test('1 · no browser role reads or writes the codes — not even the couple of the event', async () => {
  await mint('code-for-the-rls-check-0001');
  const rls = await db.query<{ relrowsecurity: boolean }>(
    `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.guest_reentry_codes'::regclass`,
  );
  assert.equal(rls.rows[0]!.relrowsecurity, true, 'RLS is off');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    if (role === 'authenticated') await setAuthUid(db, USER);
    try {
      await assert.rejects(db.query(`SELECT code_hash FROM public.guest_reentry_codes`), /permission denied/, `${role} can read the codes`);
      await assert.rejects(
        db.query(
          `INSERT INTO public.guest_reentry_codes (code_hash, event_id, guest_id, purpose, expires_at)
           VALUES ($1, $2, $3, 'tile', now() + interval '1 day')`,
          [hash(`forged-by-${role}-0000`), EVENT, GUEST],
        ),
        /permission denied/,
        `${role} can mint a code`,
      );
    } finally {
      await db.exec('RESET ROLE');
      await setAuthUid(db, null);
    }
  }
});

test('2 · only a sha256 can be stored — a raw code is refused', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.guest_reentry_codes (code_hash, event_id, guest_id, purpose, expires_at)
       VALUES (repeat('k', 43), $1, $2, 'tile', now() + interval '1 day')`,
      [EVENT, GUEST],
    ),
    /guest_reentry_codes_hash_chk/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.guest_reentry_codes (code_hash, event_id, guest_id, purpose, expires_at)
       VALUES ($1, $2, $3, 'forever', now() + interval '1 day')`,
      [hash('a-purpose-that-is-not-one'), EVENT, GUEST],
    ),
    /guest_reentry_codes_purpose_chk/,
  );
});

test('3 · the exchange statement wins ONCE, and never spends an expired code or another event\'s', async () => {
  await mint('spend-me-once-0000000001');
  assert.equal(await spend('spend-me-once-0000000001'), 1, 'a live code was refused');
  assert.equal(await spend('spend-me-once-0000000001'), 0, 'a code was spent twice');
  await mint('already-expired-00000001', '-1 second');
  assert.equal(await spend('already-expired-00000001'), 0, 'an expired code was spent');
  await mint('wrong-event-000000000001');
  assert.equal(await spend('wrong-event-000000000001', '00000000-0000-0000-0000-000000000000'), 0, 'another event spent the code');
});

test('4 · a hard-deleted guest takes their codes with them', async () => {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Cita', 'Ramos', 'both', 'friends') RETURNING guest_id`,
    [EVENT],
  );
  const gone = g.rows[0]!.guest_id;
  await mint('goes-with-the-guest-0001', '30 minutes', gone);
  await db.query(`DELETE FROM public.guests WHERE guest_id = $1`, [gone]);
  const left = await db.query(`SELECT 1 FROM public.guest_reentry_codes WHERE guest_id = $1`, [gone]);
  assert.equal(left.rows.length, 0, 'a deleted guest\'s code outlived them');
});
