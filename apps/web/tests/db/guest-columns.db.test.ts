/**
 * Guest Columns (BUILD ① · migration 20270917200000) — DB-machinery proof
 * against the FULL replayed prod schema (every migration, in order, in an
 * in-memory PGlite):
 *
 *   • guest_submit_column inserts a pending row with consent stamped;
 *   • ONE column per (event, guest): a second submit UPDATES the same row
 *     (edit-resets-moderation, edit_count++), never a second row;
 *   • rapid successive edits hit the burst guard (gcol:burst);
 *   • an approved column rejects further edits (gcol:already_published);
 *   • the EDITORIAL-PHASE cutoff: event_date far in the past →
 *     gcol:submissions_closed; future/near dates stay open;
 *   • guest_withdraw_column flips to user_deleted (TRUE), is honest about
 *     nothing-to-withdraw (FALSE), and the slot revives via submit;
 *   • the gcol_approved_needs_screen CHECK blocks approving an 'unscreened'
 *     row at the DB level.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let eventId: string;
let guestId: string;

/** The burst guard throttles edits <20s apart — backdate between test calls. */
async function coolDown(): Promise<void> {
  await db.query(
    `UPDATE public.guest_columns SET updated_at = NOW() - INTERVAL '1 minute'
     WHERE event_id = $1 AND guest_id = $2`,
    [eventId, guestId],
  );
}

async function submit(title: string, body: string, state = 'clean') {
  return db.query<{
    id: number;
    status: string;
    moderation_state: string;
    edit_count: number;
    consent_captured_at: string;
    user_deleted_at: string | null;
  }>(`SELECT * FROM public.guest_submit_column($1, $2, $3, $4, NULL)`, [
    guestId,
    title,
    body,
    state,
  ]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // operate as the migration owner

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Guest Columns Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  const guest = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Colum', 'Nist', 'both', 'friends') RETURNING guest_id`,
    [eventId],
  );
  guestId = guest.rows[0]!.guest_id;
});

after(async () => {
  await db?.close();
});

test('replay applied every migration (schema is the real prod shape)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('submit inserts ONE pending row with consent stamped', async () => {
  const r = await submit('A toast in print', 'The happiest day — from your loudest table.');
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.status, 'pending');
  assert.equal(r.rows[0]!.moderation_state, 'clean');
  assert.equal(r.rows[0]!.edit_count, 0);
  assert.ok(r.rows[0]!.consent_captured_at, 'RA 10173 consent stamped by the RPC');
});

test('immediate re-submit hits the burst guard', async () => {
  await assert.rejects(
    () => submit('Edited too fast', 'Slow down.'),
    /gcol:burst/,
  );
});

test('second submit EDITS the same row — one-per-guest upsert, moderation reset', async () => {
  await coolDown();
  const r = await submit('A toast in print, v2', 'Rewritten with feeling.', 'flagged');
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.status, 'pending');
  assert.equal(r.rows[0]!.moderation_state, 'flagged');
  assert.equal(r.rows[0]!.edit_count, 1);

  const count = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.guest_columns WHERE event_id = $1 AND guest_id = $2`,
    [eventId, guestId],
  );
  assert.equal(count.rows[0]!.n, 1, 'still exactly one row for this guest');
});

test('approved column: no further edits (edit-until-approved) + CHECK interlock', async () => {
  await db.query(
    `UPDATE public.guest_columns SET status = 'approved'
     WHERE event_id = $1 AND guest_id = $2`,
    [eventId, guestId],
  );
  await coolDown(); // clears the burst window only — status stays approved
  await assert.rejects(
    () => submit('Sneaky edit', 'After approval.'),
    /gcol:already_published/,
  );

  // DB interlock: an 'unscreened' row can never be approved.
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.guest_columns SET moderation_state = 'unscreened'
         WHERE event_id = $1 AND guest_id = $2`,
        [eventId, guestId],
      ),
    /gcol_approved_needs_screen/,
  );
});

test('withdraw flips to user_deleted; second withdraw is honestly FALSE; slot revives', async () => {
  const w1 = await db.query<{ guest_withdraw_column: boolean }>(
    `SELECT public.guest_withdraw_column($1)`,
    [guestId],
  );
  assert.equal(w1.rows[0]!.guest_withdraw_column, true);

  const row = await db.query<{ status: string; user_deleted_at: string | null }>(
    `SELECT status, user_deleted_at FROM public.guest_columns WHERE event_id = $1 AND guest_id = $2`,
    [eventId, guestId],
  );
  assert.equal(row.rows[0]!.status, 'user_deleted');
  assert.ok(row.rows[0]!.user_deleted_at);

  const w2 = await db.query<{ guest_withdraw_column: boolean }>(
    `SELECT public.guest_withdraw_column($1)`,
    [guestId],
  );
  assert.equal(w2.rows[0]!.guest_withdraw_column, false, 'nothing left to withdraw');

  // Revive through the same slot (the decline-returns-it loop shape).
  await coolDown();
  const r = await submit('Back in print', 'Second thoughts, better words.');
  assert.equal(r.rows[0]!.status, 'pending');
  assert.equal(r.rows[0]!.user_deleted_at, null, 'revive clears the tombstone');
});

test('editorial-phase cutoff: past event closes submissions; future stays open', async () => {
  // 10 days past → deep in the 'editorial' lifecycle phase (T+8h threshold).
  await db.query(`UPDATE public.events SET event_date = CURRENT_DATE - 10 WHERE event_id = $1`, [
    eventId,
  ]);
  await coolDown();
  await assert.rejects(
    () => submit('Too late', 'The paper has gone to print.'),
    /gcol:submissions_closed/,
  );

  // 10 days out → open again (same guest, edit path proves the gate is
  // phase-driven, not state-driven).
  await db.query(`UPDATE public.events SET event_date = CURRENT_DATE + 10 WHERE event_id = $1`, [
    eventId,
  ]);
  const r = await submit('Right on time', 'Presses still warm.');
  assert.equal(r.rows[0]!.status, 'pending');
});

test('title/body constraints enforced by the RPC', async () => {
  await coolDown();
  await assert.rejects(() => submit('', 'No title.'), /gcol:invalid_title/);
  await assert.rejects(() => submit('x'.repeat(61), 'Too long.'), /gcol:invalid_title/);
  await assert.rejects(() => submit('Fine title', ''), /gcol:invalid_body/);
  await assert.rejects(
    () => submit('Fine title', 'x'.repeat(281)),
    /gcol:invalid_body/,
  );
  await assert.rejects(
    () => submit('Fine title', 'Fine body.', 'blocked'),
    /gcol:invalid_state/,
  );
});
