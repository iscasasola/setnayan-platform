/**
 * REGRESSION GUARD — events.date_status must stay honest against events.event_date.
 *
 * THE DEFECT THIS PINS SHUT
 * -------------------------
 * `date_status` had NEVER held 'locked' in production. All 5 prod events read
 * 'undecided', including the 4 carrying a real `event_date`, and two of those
 * were real weddings with a DAY-precise date and a still-PENDING `set_date`
 * checklist item — i.e. the app was telling a couple to "set your wedding date"
 * while displaying that very date everywhere else.
 *
 * It had been "fixed" twice already, both times as a one-shot UPDATE
 * (20260604020000 and 20260604140000). A one-shot UPDATE promotes the rows that
 * exist at apply time and then stops being a rule, so the column drifted right
 * back — every prod event was created after both ran. The real cause is that of
 * the eleven writers of `events.event_date`, the ones that actually land rows
 * (onboarding INSERTs, `updateEventDate`, the save-the-date film date, the
 * plpgsql `vendor_claim_locked_qr`, and any direct SQL/Studio edit) never touch
 * `date_status`.
 *
 * Migration 20271033121603 replaces the one-shot with an invariant: a BEFORE
 * INSERT OR UPDATE trigger that fills the column in for writers that state no
 * intent. This suite asserts the rule and, critically, its FOUR exemptions —
 * because the failure mode of an over-eager trigger is silently overwriting
 * deliberate host intent.
 *
 * WHAT THIS SUITE ASSERTS
 *   0. META — the trigger actually exists (otherwise every case below passes
 *      vacuously, which is how a guard manufactures confidence).
 *   1. INSERT with a day-precise date  → 'locked'  (the onboarding/simple path).
 *   2. UPDATE to a day-precise date    → 'locked'  (the updateEventDate path).
 *   3. A year/month PLACEHOLDER date   → stays 'undecided' — `event_date` is a
 *      first-of-range placeholder there, not a commitment.
 *   4. Explicit intent wins, both ways: an explicit 'locked' survives, and
 *      markDateUndecided's 'undecided'-with-a-date survives.
 *   5. Clearing the date demotes 'locked' → 'undecided'.
 *   6. An unrelated column edit never resurrects a deliberate 'undecided'.
 *   7. NEUTRALISATION — drop the trigger and case 1 fails again, proving this
 *      suite measures the trigger and not the harness.
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

type Row = { event_id: string; date_status: string };

/** Insert an event, optionally with date columns, and return its row. */
async function newEvent(fields: {
  eventDate?: string | null;
  precision?: string;
  dateStatus?: string;
}): Promise<Row> {
  const cols = ['display_name', 'event_type'];
  const vals: unknown[] = ['Date Status Test', 'birthday'];
  if (fields.eventDate !== undefined) {
    cols.push('event_date');
    vals.push(fields.eventDate);
  }
  if (fields.precision !== undefined) {
    cols.push('event_date_precision');
    vals.push(fields.precision);
  }
  if (fields.dateStatus !== undefined) {
    cols.push('date_status');
    vals.push(fields.dateStatus);
  }
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const r = await db.query<Row>(
    `INSERT INTO public.events (${cols.join(', ')}) VALUES (${placeholders})
     RETURNING event_id, date_status`,
    vals,
  );
  return r.rows[0]!;
}

async function statusOf(eventId: string): Promise<string> {
  const r = await db.query<{ date_status: string }>(
    `SELECT date_status FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  return r.rows[0]!.date_status;
}

/* ── 0. META ───────────────────────────────────────────────────────────────*/

test('META: the sync trigger exists on public.events', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'events'
        AND t.tgname = 'sync_event_date_status_trg' AND NOT t.tgisinternal`,
  );
  assert.equal(r.rows[0]!.n, 1, 'sync_event_date_status_trg is missing — every case below would pass vacuously');
});

/* ── 1-2. THE RULE ─────────────────────────────────────────────────────────*/

test('INSERT with a day-precise date locks the status (onboarding/simple path)', async () => {
  const ev = await newEvent({ eventDate: '2027-05-05', precision: 'day' });
  assert.equal(ev.date_status, 'locked');
});

test('UPDATE to a day-precise date locks the status (updateEventDate path)', async () => {
  const ev = await newEvent({});
  assert.equal(await statusOf(ev.event_id), 'undecided', 'a dateless event starts undecided');
  await db.query(
    `UPDATE public.events SET event_date = '2027-06-06', event_date_precision = 'day'
      WHERE event_id = $1`,
    [ev.event_id],
  );
  assert.equal(await statusOf(ev.event_id), 'locked');
});

/* ── 3. THE PLACEHOLDER EXEMPTION ──────────────────────────────────────────*/

test('a year/month placeholder date does NOT count as a commitment', async () => {
  // updateEventDate stores a first-of-range placeholder for year/month modes,
  // so event_date IS NOT NULL there without the host naming a day.
  for (const precision of ['year', 'month']) {
    const ev = await newEvent({ eventDate: '2027-01-01', precision });
    assert.equal(
      ev.date_status,
      'undecided',
      `precision '${precision}' is a placeholder and must not promote to locked`,
    );
  }
});

test('narrowing precision year → day on an existing date promotes it', async () => {
  const ev = await newEvent({ eventDate: '2027-01-01', precision: 'year' });
  assert.equal(ev.date_status, 'undecided');
  await db.query(
    `UPDATE public.events SET event_date_precision = 'day' WHERE event_id = $1`,
    [ev.event_id],
  );
  assert.equal(await statusOf(ev.event_id), 'locked');
});

/* ── 4. EXPLICIT INTENT ALWAYS WINS ────────────────────────────────────────*/

test("lockEventDate's deliberate 'locked' + year precision survives", async () => {
  // lockEventDate explicitly supports locking at year/month precision. That
  // state is unrepresentable by any derivation from the date columns, which is
  // exactly why date_status stays STORED rather than generated.
  const ev = await newEvent({ eventDate: '2027-01-01', precision: 'year', dateStatus: 'locked' });
  assert.equal(ev.date_status, 'locked');
});

test("markDateUndecided's 'undecided' WITH a date survives", async () => {
  const ev = await newEvent({ eventDate: '2027-07-07', precision: 'day' });
  assert.equal(ev.date_status, 'locked');
  // "I'm not ready yet" — deliberately does NOT clear event_date.
  await db.query(`UPDATE public.events SET date_status = 'undecided' WHERE event_id = $1`, [
    ev.event_id,
  ]);
  assert.equal(
    await statusOf(ev.event_id),
    'undecided',
    'the trigger must not overwrite an explicit date_status write',
  );
});

/* ── 5. CLEARING THE DATE ──────────────────────────────────────────────────*/

test('clearing event_date demotes locked → undecided', async () => {
  const ev = await newEvent({ eventDate: '2027-08-08', precision: 'day' });
  assert.equal(ev.date_status, 'locked');
  await db.query(`UPDATE public.events SET event_date = NULL WHERE event_id = $1`, [ev.event_id]);
  assert.equal(await statusOf(ev.event_id), 'undecided');
});

/* ── 6. NO SPONTANEOUS RESURRECTION ────────────────────────────────────────*/

test('an unrelated edit never resurrects a deliberate undecided', async () => {
  const ev = await newEvent({ eventDate: '2027-09-09', precision: 'day' });
  await db.query(`UPDATE public.events SET date_status = 'undecided' WHERE event_id = $1`, [
    ev.event_id,
  ]);
  // A mood-board / venue save touching an unrelated column.
  await db.query(`UPDATE public.events SET venue_name = 'Somewhere' WHERE event_id = $1`, [
    ev.event_id,
  ]);
  assert.equal(
    await statusOf(ev.event_id),
    'undecided',
    'only a real move of the date columns may promote',
  );
});

/* ── 7. NEUTRALISATION ─────────────────────────────────────────────────────*/

test('NEUTRALISATION: dropping the trigger reintroduces the drift', async () => {
  await db.query(`DROP TRIGGER sync_event_date_status_trg ON public.events`);
  try {
    const ev = await newEvent({ eventDate: '2027-10-10', precision: 'day' });
    assert.equal(
      ev.date_status,
      'undecided',
      'without the trigger the drift must reappear — otherwise this suite is measuring something else',
    );
  } finally {
    await db.query(
      `CREATE TRIGGER sync_event_date_status_trg
         BEFORE INSERT OR UPDATE ON public.events
         FOR EACH ROW EXECUTE FUNCTION public.sync_event_date_status()`,
    );
  }
});
