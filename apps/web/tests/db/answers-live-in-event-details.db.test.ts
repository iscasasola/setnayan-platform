/**
 * tests/db/answers-live-in-event-details.db.test.ts — the onboarding's last four
 * answers move out of `style_preferences.setup` into one column each, and the
 * host can change them (owner 2026-10-02, DECISION_LOG "EVERY ANSWER ABOUT AN
 * EVENT LIVES IN EVENT DETAILS ("YOUR INFO") — ONE HOME, MAPPED"; migration
 * `20271260666366_answers_live_in_event_details.sql`).
 *
 * Method: replay every migration EXCEPT this one, write events the way the
 * onboarding commit used to (the four answers inside `style_preferences.setup`),
 * apply the migration's own file, then:
 *   1. ROUND TRIP — every answer reads back from its column as it was given
 *      (papic No → false, gifts Yes → true, logo Yes → true, photo "theme" → false);
 *   2. NO COPY — the four keys are gone from the blob; every other key stays;
 *   3. an event that was never asked stays NULL (never a "No" nobody gave);
 *   4. the couple's own session can read AND change each column (Apply writes
 *      a drafted answer through that session), and a guest's cannot;
 *   5. a second application changes nothing.
 *
 * SABOTAGE (run 2026-10-02): deleting the strip UPDATE from the migration turns
 * test 2 red ("the papic answer is still copied in the blob"), and dropping the
 * `GRANT UPDATE (papic_on)` turns test 4 red (permission denied).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, MIGRATIONS_DIR, setAuthUid, versionOf, type ReplayResult } from './replay-migrations';

const MIGRATION = '20271260666366_answers_live_in_event_details.sql';
const COLUMNS = ['papic_on', 'gifts_on', 'logo_wanted', 'cover_photo_wanted'] as const;

let replay: ReplayResult;
let db: PGlite;
let couple: string;
let guest: string;
let answered: string;
let neverAsked: string;

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function newEvent(name: string, prefs: Record<string, unknown>): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, style_preferences)
     VALUES ($1, 'birthday', $2::jsonb) RETURNING event_id`,
    [name, JSON.stringify(prefs)],
  );
  return e.rows[0]!.event_id;
}

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

async function row(eventId: string): Promise<Record<string, unknown>> {
  const r = await db.query<Record<string, unknown>>(
    `SELECT papic_on, gifts_on, logo_wanted, cover_photo_wanted, style_preferences FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  return r.rows[0]!;
}

before(async () => {
  const all = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  assert.ok(all.includes(MIGRATION), `${MIGRATION} is missing — moved or renumbered`);
  const only = new Set(all.filter((f) => f !== MIGRATION).map(versionOf));
  replay = await createReplayedDb({ only });
  db = replay.db;

  couple = await newUser('answers-couple@example.test');
  guest = await newUser('answers-guest@example.test');
  // Exactly what the onboarding commit wrote before: every answer in the blob.
  answered = await newEvent('Answered', {
    guidance_opt_in: true,
    setup: { where: 'home', whereText: '', look: 'house', reply: 'yes', entry: 'one_qr', requests: false, guests: 'later', questions: 'defaults', papic: 'no', gifts: 'yes', logo: 'yes', photo: 'theme' },
  });
  neverAsked = await newEvent('Never asked', { guidance_opt_in: true });
  for (const [eventId, uid, type] of [
    [answered, couple, 'couple'],
    [answered, guest, 'guest'],
  ] as const) {
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,$3)`, [eventId, uid, type]);
  }

  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION), 'utf8'));
});

after(async () => {
  await replay?.db.close();
});

test('1 · round trip: each onboarding answer reads back from its own column', async () => {
  const r = await row(answered);
  assert.equal(r.papic_on, false, 'Photos from your guests? — No');
  assert.equal(r.gifts_on, true, 'Accept gifts? — Yes');
  assert.equal(r.logo_wanted, true, 'Do you want a logo? — Yes, make one');
  assert.equal(r.cover_photo_wanted, false, 'Event photo — a theme picture for now');
});

test('2 · no copy: the four answers leave the blob; every other answer stays', async () => {
  const setup = (await row(answered)).style_preferences as { setup: Record<string, unknown>; guidance_opt_in: boolean };
  for (const k of ['papic', 'gifts', 'logo', 'photo']) {
    assert.ok(!(k in setup.setup), `the ${k} answer is still copied in the blob`);
  }
  assert.equal(setup.setup.where, 'home');
  assert.equal(setup.setup.guests, 'later');
  assert.equal(setup.guidance_opt_in, true, 'a key outside setup was touched');
});

test('3 · an event never asked stays NULL — not a "No" nobody gave', async () => {
  const r = await row(neverAsked);
  for (const c of COLUMNS) assert.equal(r[c], null, `${c} was invented for an event that was never asked`);
});

test('4 · the couple reads and changes each answer through their own session; a guest cannot', async () => {
  for (const c of COLUMNS) {
    await asUser(couple, async () => {
      await db.query(`UPDATE public.events SET ${c} = NOT COALESCE(${c}, false) WHERE event_id = $1`, [answered]);
      const seen = await db.query<Record<string, unknown>>(`SELECT ${c} FROM public.events_host WHERE event_id = $1`, [answered]);
      assert.equal(seen.rows.length, 1, `events_host does not show ${c} to the couple`);
    });
  }
  const r = await row(answered);
  assert.deepEqual(
    COLUMNS.map((c) => r[c]),
    [true, false, false, true],
    'each answer flipped once, through the couple session',
  );
  const before = await row(answered);
  await asUser(guest, async () => {
    await db.query(`UPDATE public.events SET papic_on = false WHERE event_id = $1`, [answered]).catch(() => null);
  });
  assert.equal((await row(answered)).papic_on, before.papic_on, 'a guest changed the couple’s answer');
});

test('5 · a second application changes nothing', async () => {
  const before = await row(answered);
  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION), 'utf8'));
  assert.deepEqual(await row(answered), before);
});
