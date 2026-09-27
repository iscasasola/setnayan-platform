/**
 * `guest_reminder_email_log` — the lock under the 30 · 7 · 1 day guest
 * reminders (migration 20271250747828). What the DATABASE itself must refuse,
 * executed against the replayed schema rather than described:
 *
 *   · the same guest × milestone × event date twice → 23505. This is the whole
 *     idempotency: two windows racing the same send both INSERT and one loses;
 *   · a fourth milestone → CHECK violation (the owner named three);
 *   · a moved date is a NEW key (the reminder's content was about the old one);
 *   · RLS is on, anon holds no privilege, and deleting the guest deletes the lock.
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
  await db.close();
});

async function fixture(): Promise<{ eventId: string; guestId: string }> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Reminder lock test', 'birthday', '2026-12-18') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, email)
     VALUES ($1, 'Ana', 'Cruz', 'both', 'friends', 'ana@example.com') RETURNING guest_id`,
    [eventId],
  );
  return { eventId, guestId: g.rows[0]!.guest_id };
}

async function pgCode(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (e) {
    return String((e as { code?: string }).code ?? (e as Error).message);
  }
}

test('the table exists with RLS enabled and no anon privilege', async () => {
  const cls = await db.query<{ relrowsecurity: boolean }>(
    `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.guest_reminder_email_log'::regclass`,
  );
  assert.equal(cls.rows[0]?.relrowsecurity, true, 'RLS must be ON');
  for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('anon', 'public.guest_reminder_email_log', $1) AS ok`,
      [priv],
    );
    assert.equal(r.rows[0]?.ok, false, `anon must not hold ${priv}`);
  }
});

test('THE LOCK: the same guest × milestone × event date cannot be inserted twice', async () => {
  const { eventId, guestId } = await fixture();
  const insert = () =>
    db.query(
      `INSERT INTO public.guest_reminder_email_log (guest_id, event_id, milestone_days, event_date)
       VALUES ($1, $2, 30, '2026-12-18')`,
      [guestId, eventId],
    );
  assert.equal(await pgCode(insert), null, 'the first claim wins');
  assert.equal(await pgCode(insert), '23505', 'the second claim loses — no double send');
  // A different milestone for the same guest and date is its own row.
  assert.equal(
    await pgCode(() =>
      db.query(
        `INSERT INTO public.guest_reminder_email_log (guest_id, event_id, milestone_days, event_date)
         VALUES ($1, $2, 7, '2026-12-18')`,
        [guestId, eventId],
      ),
    ),
    null,
  );
  // A MOVED date is a new key — the couple who moves the day gets fresh reminders.
  assert.equal(
    await pgCode(() =>
      db.query(
        `INSERT INTO public.guest_reminder_email_log (guest_id, event_id, milestone_days, event_date)
         VALUES ($1, $2, 30, '2027-01-20')`,
        [guestId, eventId],
      ),
    ),
    null,
  );
});

test('only the owner’s three milestones are storable', async () => {
  const { eventId, guestId } = await fixture();
  for (const bad of [0, 3, 14, 60]) {
    assert.equal(
      await pgCode(() =>
        db.query(
          `INSERT INTO public.guest_reminder_email_log (guest_id, event_id, milestone_days, event_date)
           VALUES ($1, $2, $3, '2026-12-18')`,
          [guestId, eventId, bad],
        ),
      ),
      '23514',
      `milestone ${bad} must trip the CHECK`,
    );
  }
});

test('deleting the guest deletes their locks (nothing dangles, nothing blocks the delete)', async () => {
  const { eventId, guestId } = await fixture();
  await db.query(
    `INSERT INTO public.guest_reminder_email_log (guest_id, event_id, milestone_days, event_date)
     VALUES ($1, $2, 1, '2026-12-18')`,
    [guestId, eventId],
  );
  await db.query(`DELETE FROM public.guests WHERE guest_id = $1`, [guestId]);
  const left = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.guest_reminder_email_log WHERE guest_id = $1`,
    [guestId],
  );
  assert.equal(left.rows[0]?.n, 0);
});
