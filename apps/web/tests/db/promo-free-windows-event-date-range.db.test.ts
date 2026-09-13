/**
 * promo_free_windows carries an EVENT-DATE-RANGE filter for couple windows
 * (migration 20271208727445 · G5): event_date_from / event_date_to, both
 * nullable, meaningful ONLY for audience_type='all_couples'.
 *
 * 🔑 WHY THIS IS A DB TEST. Both new CHECK constraints
 * (promo_free_windows_event_date_order, promo_free_windows_event_date_couples_only)
 * only fire at INSERT/UPDATE validation against real rows — a TypeScript test
 * can assert the type shape all day without ever proving Postgres actually
 * refuses a vendor row carrying a date range, or a to < from range on any
 * audience. Only a replayed schema can see that.
 *
 * Run: cd apps/web && npx tsx --test tests/db/promo-free-windows-event-date-range.db.test.ts
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

type Row = {
  audience: string;
  tier: string | null;
  from: string | null;
  to: string | null;
};

async function insert(r: Row): Promise<string> {
  const res = await db.query<{ promo_window_id: string }>(
    `INSERT INTO public.promo_free_windows
       (title, audience_type, promoted_vendor_tier, event_date_from, event_date_to, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, now() - interval '1 day', now() + interval '29 days')
     RETURNING promo_window_id`,
    [`test ${r.audience} ${r.from ?? 'null'}-${r.to ?? 'null'}`, r.audience, r.tier, r.from, r.to],
  );
  return res.rows[0]!.promo_window_id;
}

test('the new columns exist and are nullable DATEs', async () => {
  const r = await db.query<{ column_name: string; data_type: string; is_nullable: string }>(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'promo_free_windows'
        AND column_name IN ('event_date_from', 'event_date_to')
      ORDER BY column_name`,
  );
  assert.deepEqual(
    r.rows.map((x) => [x.column_name, x.data_type, x.is_nullable]),
    [
      ['event_date_from', 'date', 'YES'],
      ['event_date_to', 'date', 'YES'],
    ],
  );
});

test('all_couples with both bounds NULL inserts cleanly — (c) "for any event", unchanged', async () => {
  await assert.doesNotReject(
    insert({ audience: 'all_couples', tier: null, from: null, to: null }),
  );
});

test('all_couples with a real date range inserts cleanly — (a) "for an event dated on/in a range"', async () => {
  await assert.doesNotReject(
    insert({ audience: 'all_couples', tier: null, from: '2026-12-01', to: '2026-12-31' }),
  );
  // A single-day range (from === to) is the "specific date" shape.
  await assert.doesNotReject(
    insert({ audience: 'all_couples', tier: null, from: '2026-12-25', to: '2026-12-25' }),
  );
  // Either bound alone (open-ended) is also valid.
  await assert.doesNotReject(
    insert({ audience: 'all_couples', tier: null, from: '2026-12-01', to: null }),
  );
  await assert.doesNotReject(
    insert({ audience: 'all_couples', tier: null, from: null, to: '2026-12-31' }),
  );
});

test('event_date_to < event_date_from is refused on any audience', async () => {
  await assert.rejects(
    insert({ audience: 'all_couples', tier: null, from: '2026-12-31', to: '2026-12-01' }),
    /promo_free_windows_event_date_order/,
  );
});

test('a vendor-audience row with a date range is refused — no "event" concept on a vendor cohort', async () => {
  await assert.rejects(
    insert({ audience: 'all_vendors', tier: 'pro', from: '2026-12-01', to: '2026-12-31' }),
    /promo_free_windows_event_date_couples_only/,
  );
  await assert.rejects(
    insert({ audience: 'new_verified_vendors', tier: 'solo', from: '2026-12-01', to: null }),
    /promo_free_windows_event_date_couples_only/,
  );
});

test('a segment-audience row with a date range is refused too', async () => {
  await assert.rejects(
    insert({ audience: 'segment', tier: null, from: null, to: '2026-12-31' }),
    /promo_free_windows_event_date_couples_only/,
  );
});

test('a vendor-audience row with BOTH bounds null still inserts (the couples-only CHECK only fires when a bound is set)', async () => {
  await assert.doesNotReject(
    insert({ audience: 'all_vendors', tier: 'solo', from: null, to: null }),
  );
});
