/**
 * THE COVER PAIR MUST AGREE, AND AN ANNOUNCEMENT MUST CREATE NOTHING.
 *
 * `02` §6 + §7 · 08 steps 1.5 and 1.7. Two rules that only the database can
 * prove, attacked here the way a hand-made request would attack them: plain
 * SQL, no application code anywhere.
 *
 * 🔑 WHY THE PAIRING PROOF IS HERE AND NOT IN THE MIGRATION. Probing a CHECK
 * with an INSERT inside a migration means an unrelated NOT NULL on the
 * throwaway row can abort a production deploy — the guard would break the thing
 * it protects. The migration asserts only that the constraint exists AND is
 * validated (a `NOT VALID` constraint admits every existing row, which for this
 * rule is the same as not having written it); what it actually REFUSES is
 * measured here, where a failure is a red test.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let n = 0;

async function newEvent(): Promise<string> {
  n += 1;
  const res = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Cover test ${n}', 'birthday', CURRENT_DATE - 1) RETURNING event_id`,
  );
  return res.rows[0]!.event_id;
}

async function setCover(eventId: string, kind: string | null, ref: string | null) {
  await db.query(
    `UPDATE public.events SET story_cover_kind = $2, story_cover_ref = $3 WHERE event_id = $1`,
    [eventId, kind, ref],
  );
}

test('1 · the constraint exists and is VALIDATED', async () => {
  const res = await db.query<{ convalidated: boolean }>(
    `SELECT convalidated FROM pg_constraint
      WHERE conname = 'events_story_cover_pairing_check'
        AND conrelid = 'public.events'::regclass`,
  );
  assert.equal(res.rows.length, 1, 'events_story_cover_pairing_check is missing');
  assert.equal(res.rows[0]!.convalidated, true, 'the pairing CHECK was left NOT VALID');
});

/**
 * ⚠ EVERY KIND, BOTH WAYS ROUND — never a floor like "at least three are
 * refused". A threshold guard in this repo went green while a sabotage deleted
 * one of four arms; deriving the arms and checking each one is the only shape
 * that catches that. Five kinds × the pointer present and absent = ten cases,
 * and each one names which half it is testing.
 */
const KINDS: Array<{ kind: string; needsRef: boolean }> = [
  { kind: 'hero', needsRef: false },
  { kind: 'monogram', needsRef: false },
  { kind: 'capture', needsRef: true },
  { kind: 'vendor_frame', needsRef: true },
  { kind: 'upload', needsRef: true },
];

test('2 · every kind that needs a pointer is refused without one', async () => {
  for (const { kind, needsRef } of KINDS) {
    if (!needsRef) continue;
    const eventId = await newEvent();
    await assert.rejects(
      () => setCover(eventId, kind, null),
      /violates check constraint/i,
      `kind='${kind}' was stored with a NULL ref — an unrenderable cover`,
    );
    // A refused write must leave the row untouched, not half-applied. An RLS
    // refusal returns zero rows and a PIN trigger overwrites; a CHECK throws.
    // The three have been confused in this repo before, so it is asserted.
    const after = await db.query<{ story_cover_kind: string | null }>(
      `SELECT story_cover_kind FROM public.events WHERE event_id = $1`,
      [eventId],
    );
    assert.equal(after.rows[0]!.story_cover_kind, null);
  }
});

test('3 · every kind that needs a pointer is accepted with one', async () => {
  for (const { kind, needsRef } of KINDS) {
    if (!needsRef) continue;
    const eventId = await newEvent();
    await setCover(eventId, kind, 'r2://some/where.jpg');
    const res = await db.query<{ story_cover_kind: string; story_cover_ref: string }>(
      `SELECT story_cover_kind, story_cover_ref FROM public.events WHERE event_id = $1`,
      [eventId],
    );
    assert.equal(res.rows[0]!.story_cover_kind, kind);
    assert.equal(res.rows[0]!.story_cover_ref, 'r2://some/where.jpg');
  }
});

test('4 · hero and monogram are refused WITH a pointer, and accepted without', async () => {
  for (const { kind, needsRef } of KINDS) {
    if (needsRef) continue;
    const orphan = await newEvent();
    await assert.rejects(
      () => setCover(orphan, kind, 'r2://orphan.jpg'),
      /violates check constraint/i,
      `kind='${kind}' kept an orphan pointer — two readers could disagree about which half to believe`,
    );

    const clean = await newEvent();
    await setCover(clean, kind, null);
    const res = await db.query<{ story_cover_kind: string }>(
      `SELECT story_cover_kind FROM public.events WHERE event_id = $1`,
      [clean],
    );
    assert.equal(res.rows[0]!.story_cover_kind, kind);
  }
});

test('5 · a kind outside the five is refused (the vocabulary is closed)', async () => {
  const eventId = await newEvent();
  await assert.rejects(
    () => setCover(eventId, 'hero_video', null),
    /violates check constraint/i,
    'an invented cover kind was stored — a typo would become a silent no-cover',
  );
});

test('6 · no cover at all stays legal — it is the resting state', async () => {
  const eventId = await newEvent();
  await setCover(eventId, null, null);
  const res = await db.query<{ story_cover_kind: string | null; story_cover_ref: string | null }>(
    `SELECT story_cover_kind, story_cover_ref FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(res.rows[0]!.story_cover_kind, null);
  assert.equal(res.rows[0]!.story_cover_ref, null);
});

/**
 * ═══ "ANNOUNCE IT ONLY" CREATES NOTHING ═══════════════════════════════════
 *
 * 🔑 THE COUNT IS THE ASSERTION, NOT THE CODE. The acceptance criterion is
 * "provably creates no row", so this counts `events` before and after the write
 * an announcement actually performs — one `event_editorial.draft_json` key on a
 * row that already exists — rather than reading `whats-next-actions.ts` and
 * concluding it looks safe.
 *
 * ⚠ AND IT COUNTS THE WHOLE TABLE, not "no event with this name". A creation
 * bug that minted a row under any name at all would walk past a narrower query,
 * and minting the wrong row is exactly the failure the owner ruled against.
 */
test('7 · announcing what comes next leaves the events count unchanged', async () => {
  const eventId = await newEvent();
  // ⚠ THE ROW IS ALREADY THERE. Creating an event mints its `event_editorial`
  // row, so this seeds the host's words with an UPSERT rather than an INSERT —
  // measured here, not assumed: a plain INSERT fails on
  // `event_editorial_event_id_key`. It also means "announce" never needs to
  // create even THAT row in the normal case.
  await db.query(
    `INSERT INTO public.event_editorial (event_id, draft_json)
     VALUES ($1, '{"headline":"Ours"}'::jsonb)
     ON CONFLICT (event_id) DO UPDATE SET draft_json = EXCLUDED.draft_json`,
    [eventId],
  );

  const countEvents = async (): Promise<number> => {
    const res = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.events`);
    return Number(res.rows[0]!.n);
  };

  const before = await countEvents();

  // The announcement, exactly as the action writes it: one merged key.
  await db.query(
    `UPDATE public.event_editorial
        SET draft_json = draft_json || '{"whatsNext":{"kind":"anniversary"}}'::jsonb
      WHERE event_id = $1`,
    [eventId],
  );

  const after = await countEvents();
  assert.equal(after, before, `announcing created ${after - before} event row(s)`);

  // …and it is on the back cover, so the test cannot pass by writing nothing.
  const saved = await db.query<{ kind: string | null }>(
    `SELECT draft_json #>> '{whatsNext,kind}' AS kind
       FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(saved.rows[0]!.kind, 'anniversary');

  // …and the host's own words survived the merge — a blind overwrite of
  // draft_json would take the headline with it.
  const headline = await db.query<{ headline: string | null }>(
    `SELECT draft_json #>> '{headline}' AS headline
       FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(headline.rows[0]!.headline, 'Ours');
});

/**
 * ═══ AND THE LINK IS ONLY EVER A LINK ═════════════════════════════════════
 * `previous_event_id` is written on the go-signal tap and nowhere else. The
 * structural rules that make that safe are the database's, so they are checked
 * as the database's.
 */
test('8 · an event cannot be its own predecessor, and a predecessor may vanish', async () => {
  const first = await newEvent();
  await assert.rejects(
    () =>
      db.query(`UPDATE public.events SET previous_event_id = $1 WHERE event_id = $1`, [first]),
    /violates check constraint/i,
    'an event was allowed to continue itself',
  );

  const second = await newEvent();
  await db.query(`UPDATE public.events SET previous_event_id = $2 WHERE event_id = $1`, [
    second,
    first,
  ]);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [first]);

  // ON DELETE SET NULL, never CASCADE: an actor leaving keeps the record. The
  // successor survives, having simply forgotten its predecessor.
  const survivor = await db.query<{ previous_event_id: string | null }>(
    `SELECT previous_event_id FROM public.events WHERE event_id = $1`,
    [second],
  );
  assert.equal(survivor.rows.length, 1, 'deleting the predecessor deleted its successor');
  assert.equal(survivor.rows[0]!.previous_event_id, null);
});
