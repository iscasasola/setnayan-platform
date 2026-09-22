/**
 * THE MINIMUM IS REAL IN THE DATABASE, NOT ONLY ON THE SHEET.
 *
 * Migration under test: 20271241532112 — `events.papic_guest_spend_floor_points`
 * plus the resolver change that honours it.
 *
 * 🔑 THE SCREEN IS THE ONE PEOPLE BELIEVE, so a promise that exists only on the
 * screen is the exact failure this family of controls has already paid for —
 * `setCameraShots`' own docblock says so. A minimum the resolver ignores is a
 * number a couple typed, read back, and that no guest ever receives.
 *
 * Four properties:
 *   1. a thin share is RAISED to the minimum;
 *   2. a NAMED guest below the minimum is raised to it too — naming somebody
 *      cannot be what takes a promise away from her;
 *   3. a minimum above the couple's own ceiling is REFUSED by the database, not
 *      resolved silently in favour of one of them;
 *   4. with no minimum set, every number is exactly what it was.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

/**
 * A celebration with `guests` guests, a pot of `pot`, the ceiling switch ON,
 * and a capture window that is still OPEN.
 *
 * ⚠ THE WINDOW MATTERS. The resolver releases every ceiling two hours before
 * the window ends, and a fixture whose window has passed returns NULL from
 * everything — which reads exactly like "the minimum was ignored". The window
 * is set well into the future on purpose.
 */
async function seed(opts: { guests: number; pot: number; floor?: number | null; everyone?: number | null }) {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date,
                                papic_window_start, papic_window_end,
                                papic_guest_spend_ceiling_on,
                                papic_guest_spend_ceiling_points,
                                papic_guest_spend_floor_points)
     VALUES ('Minimum fixture', 'birthday', CURRENT_DATE + 60,
             CURRENT_DATE, CURRENT_DATE + 61, TRUE, $1, $2)
     RETURNING event_id`,
    [opts.everyone ?? null, opts.floor ?? null],
  );
  const eventId = ev.rows[0]!.event_id;

  const guestIds: string[] = [];
  for (let i = 0; i < opts.guests; i += 1) {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1, $2, 'Fixture', 'both', 'friends') RETURNING guest_id`,
      [eventId, `Guest ${i}`],
    );
    guestIds.push(g.rows[0]!.guest_id);
  }
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source) VALUES ($1, $2, 'admin')`,
    [eventId, opts.pot],
  );
  return { eventId, guestIds };
}

test('A THIN SHARE IS RAISED TO THE MINIMUM', async () => {
  // 100 guests over a pot of 1,000 divides to 10 each. Promise them 25.
  const { eventId, guestIds } = await seed({ guests: 100, pot: 1_000 });

  const before = await one<number>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestIds[0]]);
  assert.equal(before, 10, 'sanity: the equal share is 10 before any minimum');

  await db.query(
    `UPDATE public.events SET papic_guest_spend_floor_points = 25 WHERE event_id = $1`,
    [eventId],
  );
  const after = await one<number>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestIds[0]]);
  assert.equal(after, 25, 'the minimum must raise a thin share');

  // ⚠ AND IT NEVER LOWERS A GENEROUS ONE. A minimum below the share is inert.
  await db.query(
    `UPDATE public.events SET papic_guest_spend_floor_points = 3 WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(
    await one<number>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestIds[0]]),
    10,
    'a minimum below the share must change nothing',
  );
});

test('A NAMED GUEST IS RAISED TO THE MINIMUM TOO', async () => {
  /*
    ⚖ Owner ruling 7c protects a named guest's allotment from the RELEASE —
    naming her means her credits wait for her all night. That is a different
    question from this one. A celebration that promises every guest at least 25
    and hands one named guest 5 has broken the promise for her specifically,
    which is the person the couple cared enough about to name.
  */
  const { eventId, guestIds } = await seed({ guests: 100, pot: 1_000, floor: 25 });
  await db.query(
    `INSERT INTO public.papic_guest_spend_ceilings (guest_id, event_id, ceiling_points)
     VALUES ($1, $2, 5)`,
    [guestIds[0], eventId],
  );
  assert.equal(
    await one<number>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestIds[0]]),
    25,
    'a named number below the minimum must rise to it',
  );

  // A named number ABOVE the minimum is untouched — the couple's choice stands.
  await db.query(
    `UPDATE public.papic_guest_spend_ceilings SET ceiling_points = 400 WHERE guest_id = $1`,
    [guestIds[0]],
  );
  assert.equal(
    await one<number>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestIds[0]]),
    400,
  );
});

test('A MINIMUM ABOVE THE COUPLE’S OWN LIMIT IS REFUSED BY THE DATABASE', async () => {
  /*
    🔑 NOT RESOLVED SILENTLY IN FAVOUR OF ONE OF THEM. "Everybody gets at least
    80, and nobody may take more than 40" is a contradiction, not a setting, and
    whichever one won would be invisible. The CHECK refuses it wherever it is
    written from — there are already three writers of these two columns.
  */
  const { eventId } = await seed({ guests: 10, pot: 5_000, everyone: 40 });
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.events SET papic_guest_spend_floor_points = 80 WHERE event_id = $1`,
        [eventId],
      ),
    /events_papic_guest_spend_floor_at_most_ceiling/,
  );

  // Equal is fine; it is only "above" that is a contradiction.
  await db.query(
    `UPDATE public.events SET papic_guest_spend_floor_points = 40 WHERE event_id = $1`,
    [eventId],
  );

  // And zero is still not a minimum — a blank box is not "nobody may shoot".
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.events SET papic_guest_spend_floor_points = 0 WHERE event_id = $1`,
        [eventId],
      ),
    /events_papic_guest_spend_floor_points_positive/,
  );
});

test('WITH NO MINIMUM, EVERY NUMBER IS EXACTLY WHAT IT WAS', async () => {
  /*
    The dormancy check. Every celebration in existence the day this applies has
    a NULL minimum, so the resolver must behave identically — including the
    shipped floor-of-one on a pot too thin to divide.
  */
  const { guestIds } = await seed({ guests: 200, pot: 50 });
  assert.equal(
    await one<number>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestIds[0]]),
    1,
    'the shipped floor of one must survive untouched',
  );

  const off = await seed({ guests: 10, pot: 5_000 });
  await db.query(
    `UPDATE public.events SET papic_guest_spend_ceiling_on = FALSE WHERE event_id = $1`,
    [off.eventId],
  );
  assert.equal(
    await one<number | null>(`SELECT public.papic_guest_spend_ceiling($1)`, [off.guestIds[0]]),
    null,
    'the switch is still the first word',
  );
});
