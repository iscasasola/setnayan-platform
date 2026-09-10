/**
 * THE ARRANGEMENT IS KEPT — the column, its one door, and the version check, against the real
 * migrations (`20271220820369_the_arrangement_is_kept.sql`).
 *
 * `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 3. What the unit tests cannot prove, because
 * they never touch Postgres: that a save naming a stale version writes NOTHING, that the same
 * document sent twice is not a conflict, and that a signed-in host cannot write the column
 * straight through PostgREST and skip the rules the save enforces.
 *
 * ⚠ WHAT THIS CANNOT PROVE: two saves at the SAME instant. PGlite is one connection, so the
 * second of two concurrent UPDATEs never waits on the first's row lock here. The guarantee that
 * covers it is Postgres's own — an UPDATE whose WHERE names the expected version re-checks that
 * WHERE against the row the other transaction committed — and the sequential cases below are
 * exactly what that re-check sees.
 *
 * 🔑 EVERY REFUSAL HAS A CONTROL BESIDE IT, the house rule from `the-two-doors-are-shut`: a
 * guard that only proves something fails cannot tell "the door is shut" from "the room is
 * bricked up".
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
}, { timeout: 600000 });
after(async () => {
  await db?.close();
});

let n = 0;

async function newEventWithStory(): Promise<{ eventId: string; hostUid: string }> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`arrangement-host-${n}@example.test`],
  );
  const hostUid = u.rows[0]!.id;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Arrangement test ${n}', 'birthday', CURRENT_DATE - 1) RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, hostUid],
  );
  // ⚠ The story row is created by a trigger on `events` — never insert one (unique key).
  const row = await db.query(`SELECT 1 FROM public.event_editorial WHERE event_id=$1`, [eventId]);
  assert.equal(row.rows.length, 1, 'expected the auto-created story row');
  return { eventId, hostUid };
}

const doc = (words: string) => ({
  shape: 1,
  mode: 'hand',
  handTouched: true,
  moments: [
    {
      id: 'own:the-day',
      name: 'The day',
      objects: [
        { id: 'words:1', kind: 'words', text: words, x: 20, y: 16, size: 19, color: 'ink', backing: false, turn: 0 },
      ],
    },
  ],
  sets: [],
});

async function save(eventId: string, expected: number, d: unknown) {
  const r = await db.query<{ outcome: string; saved_version: number | null }>(
    `SELECT * FROM public.save_story_arrangement($1::uuid, $2::int, $3::jsonb)`,
    [eventId, expected, JSON.stringify(d)],
  );
  return r.rows[0]!;
}

async function stored(eventId: string) {
  const r = await db.query<{ arrangement: unknown; arrangement_version: number }>(
    `SELECT arrangement, arrangement_version FROM public.event_editorial WHERE event_id=$1`,
    [eventId],
  );
  return r.rows[0]!;
}

async function asAuthenticated<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  // Both halves, or the couple policy matches zero rows and a refusal is a silent no-op.
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

test('1 · a story starts with nothing arranged, at version 0', async () => {
  const { eventId } = await newEventWithStory();
  const s = await stored(eventId);
  assert.equal(s.arrangement, null);
  assert.equal(s.arrangement_version, 0);
});

test('2 · save → read returns the document exactly, and the version counts up', async () => {
  const { eventId } = await newEventWithStory();
  const first = await save(eventId, 0, doc('She came down the path'));
  assert.deepEqual(first, { outcome: 'saved', saved_version: 1 });
  assert.deepEqual((await stored(eventId)).arrangement, doc('She came down the path'));

  const second = await save(eventId, 1, doc('and the rain stopped'));
  assert.deepEqual(second, { outcome: 'saved', saved_version: 2 });
  assert.deepEqual(await stored(eventId), { arrangement: doc('and the rain stopped'), arrangement_version: 2 });
});

test('3 · a save built on an OLD version writes nothing and says who won', async () => {
  const { eventId } = await newEventWithStory();
  await save(eventId, 0, doc('tab A'));
  // Tab B was opened at version 0 too.
  const lost = await save(eventId, 0, doc('tab B'));
  assert.deepEqual(lost, { outcome: 'conflict', saved_version: 1 });
  assert.deepEqual(
    (await stored(eventId)).arrangement,
    doc('tab A'),
    'the stale tab OVERWROTE the other tab\'s work',
  );
});

test('3b · CONTROL — the same stale tab, once it has reloaded, saves normally', async () => {
  const { eventId } = await newEventWithStory();
  await save(eventId, 0, doc('tab A'));
  assert.deepEqual(await save(eventId, 1, doc('tab B, after reloading')), { outcome: 'saved', saved_version: 2 });
});

test('4 · the same document sent twice is NOT a conflict — a retried autosave', async () => {
  const { eventId } = await newEventWithStory();
  await save(eventId, 0, doc('once'));
  const again = await save(eventId, 0, doc('once'));
  assert.deepEqual(again, { outcome: 'unchanged', saved_version: 1 });
  assert.equal((await stored(eventId)).arrangement_version, 1, 'a retry bumped the version');
});

test('4b · …even when the retry serialised its keys in a different order', async () => {
  const { eventId } = await newEventWithStory();
  await save(eventId, 0, doc('once'));
  const d = doc('once');
  const reordered = { sets: d.sets, moments: d.moments, handTouched: d.handTouched, mode: d.mode, shape: d.shape };
  assert.equal((await save(eventId, 0, reordered)).outcome, 'unchanged');
});

test('5 · a celebration with no story row is reported, not invented', async () => {
  const r = await save('00000000-0000-4000-8000-0000000000ff', 0, doc('x'));
  assert.deepEqual(r, { outcome: 'no_story', saved_version: null });
});

test('5b · a document that is not an object is refused by the function and by the column', async () => {
  const { eventId } = await newEventWithStory();
  await assert.rejects(() => save(eventId, 0, ['not', 'a', 'document']), /arrangement_must_be_a_document/);
  await assert.rejects(
    () => db.query(`UPDATE public.event_editorial SET arrangement='[1]'::jsonb WHERE event_id=$1`, [eventId]),
    /event_editorial_arrangement_is_a_document/,
  );
});

test('6 · THE ONE DOOR — a signed-in host cannot write the arrangement directly', async () => {
  const { eventId, hostUid } = await newEventWithStory();
  let threw = '';
  await asAuthenticated(hostUid, async () => {
    try {
      await db.query(
        `UPDATE public.event_editorial SET arrangement=$2::jsonb WHERE event_id=$1`,
        [eventId, JSON.stringify(doc('written around the save'))],
      );
    } catch (e) {
      threw = String(e);
    }
  });
  assert.match(threw, /arrangement_has_one_door/, `the direct write was not refused by the door: ${threw || 'ACCEPTED'}`);
  assert.equal((await stored(eventId)).arrangement, null);
});

test('6b · …nor bump the version to win a conflict', async () => {
  const { eventId, hostUid } = await newEventWithStory();
  let threw = '';
  await asAuthenticated(hostUid, async () => {
    try {
      await db.query(`UPDATE public.event_editorial SET arrangement_version=99 WHERE event_id=$1`, [eventId]);
    } catch (e) {
      threw = String(e);
    }
  });
  assert.match(threw, /arrangement_has_one_door/);
});

test('6c · CONTROL — the same host still writes every OTHER column of their story', async () => {
  const { eventId, hostUid } = await newEventWithStory();
  const touched = await asAuthenticated(hostUid, () =>
    db.query(
      `UPDATE public.event_editorial SET draft_json='{"headline":"Ours"}'::jsonb WHERE event_id=$1 RETURNING 1`,
      [eventId],
    ),
  );
  // Proves the policy really reached the row, so test 6 was refused by the TRIGGER, not RLS.
  assert.equal(touched.rows.length, 1, 'the host could not reach their own row — test 6 would be vacuous');
});

test('7 · only the service role may call the save — never a browser role', async () => {
  const r = await db.query<{ role: string; can: boolean }>(
    `SELECT r AS role, has_function_privilege(r, 'public.save_story_arrangement(uuid,integer,jsonb)', 'EXECUTE') AS can
       FROM unnest(ARRAY['anon','authenticated','service_role']) AS r`,
  );
  const can = Object.fromEntries(r.rows.map((x) => [x.role, x.can]));
  assert.deepEqual(can, { anon: false, authenticated: false, service_role: true });
});

test('7b · CONTROL — as the service role the save lands (the door lets its one caller through)', async () => {
  const { eventId } = await newEventWithStory();
  await db.exec(`SET ROLE service_role`);
  try {
    assert.equal((await save(eventId, 0, doc('through the door'))).outcome, 'saved');
  } finally {
    await db.exec(`RESET ROLE`);
  }
  assert.equal((await stored(eventId)).arrangement_version, 1);
});
