/**
 * THE TWO HALVES OF EVERY PRICE MUST AGREE.
 *
 * Three separate pairs are pinned here, each of which has a SQL half and a
 * TypeScript half that could drift apart:
 *
 *   1. the family sign-up discount — SQL `ROUND(x, 0)` vs TS `signupPriceFor`
 *   2. the vendor booking fee      — SQL `booking_fee_centavos` vs `bookingFeePhp`
 *   3. the fee SENTENCE            — SQL `booking_fee_schedule_summary` vs
 *                                     TS `bookingFeeScheduleSummary`
 *
 * 🔑 (3) IS THE ONE MOST LIKELY TO BE FORGOTTEN, and it is the one that reaches
 * a supplier: it is the money document minted on the amendment path, where no
 * TypeScript runs. Making the arithmetic owner-editable without making the
 * sentence owner-editable would bill one rate and print another — exactly the
 * defect 20271013349208 was written to close, one level up.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { bookingFeePhp, bookingFeeScheduleSummary, BOOKING_FEE } from '../../lib/booking-fee';
import { signupPriceFor } from '../../lib/onboarding-family-discount';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

test('SQL and TypeScript round a family discount to the same peso', async () => {
  // ⚠ Postgres ROUND on NUMERIC is half-AWAY-from-zero; the TS helper is
  // nearest-with-ties-DOWN. They agree everywhere except an exact .5 tie, and a
  // tie is exactly where a silent ₱1 disagreement between the migration and the
  // admin screen would hide. Both halves are exercised on the same inputs.
  const cases: [number, number][] = [
    [2499, 40], [1499, 40], [899, 40], [199, 40],
    [50, 10], [1200, 10], [11200, 10], [3200, 10],
    [101, 50], [999, 33.33], [1, 10], [7, 15],
  ];
  for (const [regular, pct] of cases) {
    const { rows } = await db.query<{ v: string }>(
      `SELECT ROUND($1::numeric * (1 - $2::numeric / 100.0), 0) AS v`,
      [regular, pct],
    );
    const sql = Number(rows[0]!.v);
    const ts = signupPriceFor(regular, pct);
    // Where they can legitimately differ (an exact .5 tie), say so loudly rather
    // than letting a ₱1 gap ride.
    const exact = regular * (1 - pct / 100);
    const isTie = Math.abs(exact - Math.floor(exact) - 0.5) < 1e-9;
    if (isTie) {
      assert.equal(sql - (ts as number), 1, `₱${regular} at ${pct}%: the tie must be the ONLY difference`);
    } else {
      assert.equal(ts, sql, `₱${regular} at ${pct}%: SQL says ${sql}, TypeScript says ${ts}`);
    }
  }
});

test('the booking fee arithmetic agrees between SQL and TypeScript', async () => {
  const amounts = [0, 1, 500, 1_000, 60_000, 100_000, 100_001, 300_000, 1_000_000, 10_000_000];
  for (const php of amounts) {
    const { rows } = await db.query<{ c: string }>(
      `SELECT public.booking_fee_centavos($1::bigint) AS c`,
      [Math.round(php * 100)],
    );
    assert.equal(
      Number(rows[0]!.c),
      Math.round(bookingFeePhp(php) * 100),
      `₱${php}: the authoritative SQL fee and the displayed TypeScript fee disagree`,
    );
  }
});

test('the fee SENTENCE agrees between SQL and TypeScript', async () => {
  const { rows } = await db.query<{ s: string }>(
    `SELECT public.booking_fee_schedule_summary() AS s`,
  );
  assert.equal(
    rows[0]!.s,
    bookingFeeScheduleSummary(),
    'the money document a supplier reads states a different schedule than the code does',
  );
});

test('THE SENTENCE FOLLOWS THE SETTINGS — this is what makes it owner-editable', async () => {
  // ⚠ THE REAL TEST. Before this change the SQL sentence was a hardcoded string
  // literal. If it still were, moving the settings would leave it unchanged and
  // a supplier's bill would quote a rate nobody charges.
  await db.query(
    `UPDATE public.platform_settings
        SET booking_fee_rate_pct = 7.5,
            booking_fee_tier1_limit_php = 250000,
            booking_fee_tail_rate_pct = 2
      WHERE id = 1`,
  );
  try {
    const { rows } = await db.query<{ s: string }>(
      `SELECT public.booking_fee_schedule_summary() AS s`,
    );
    assert.equal(rows[0]!.s, '7.5% of the first ₱250,000, then 2%, minimum ₱50');

    // …and so does the arithmetic, against the TS half told the same schedule.
    const schedule = { rate: 0.075, tailRate: 0.02, tier1LimitPhp: 250_000, minPhp: BOOKING_FEE.minPhp };
    for (const php of [1_000, 250_000, 1_000_000]) {
      const { rows: r } = await db.query<{ c: string }>(
        `SELECT public.booking_fee_centavos($1::bigint) AS c`,
        [Math.round(php * 100)],
      );
      assert.equal(
        Number(r[0]!.c),
        Math.round(bookingFeePhp(php, schedule) * 100),
        `₱${php} under the edited schedule`,
      );
    }
  } finally {
    await db.query(
      `UPDATE public.platform_settings
          SET booking_fee_rate_pct = 5.00,
              booking_fee_tier1_limit_php = 100000,
              booking_fee_tail_rate_pct = 1.00
        WHERE id = 1`,
    );
  }
});

test('THE FEE FUNCTIONS ARE STABLE, NOT IMMUTABLE — they read a table now', async () => {
  // An IMMUTABLE marker on a function that reads a table lets Postgres fold a
  // stale rate into an already-planned statement. Both were IMMUTABLE before.
  const { rows } = await db.query<{ proname: string; provolatile: string }>(
    `SELECT p.proname, p.provolatile::text
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('booking_fee_centavos','booking_fee_schedule_summary','setnayan_ai_price_tier')`,
  );
  assert.equal(rows.length, 3, 'all three settings-reading functions must exist');
  for (const r of rows) {
    assert.equal(r.provolatile, 's', `${r.proname} must be STABLE now that it reads a table`);
  }
});

test('the wake is UNASSIGNED, and still prices at the middle band', async () => {
  // ⚠ BOTH HALVES MATTER. Unassigned is the honest record — nobody chose ₱899
  // for a wake — and resolving to C is what keeps the family charged exactly
  // what they were charged yesterday, and keeps the SEC-5 guard undodgeable.
  const { rows } = await db.query<{ ai_price_tier: string | null }>(
    `SELECT ai_price_tier FROM public.event_type_vocab WHERE event_type = 'wake'`,
  );
  assert.equal(rows.length, 1, 'the wake must exist as a kind of celebration');
  assert.equal(rows[0]!.ai_price_tier, null, 'the wake must be recorded as having NO band chosen');

  const { rows: t } = await db.query<{ t: string }>(
    `SELECT public.setnayan_ai_price_tier('wake') AS t`,
  );
  assert.equal(t[0]!.t, 'C', 'an unassigned kind must still resolve to the safe middle');

  const { rows: u } = await db.query<{ t: string }>(
    `SELECT public.setnayan_ai_price_tier('a_type_nobody_has_added_yet') AS t`,
  );
  assert.equal(u[0]!.t, 'C', 'and so must a type nobody has added — SEC-5 depends on it');
});

test('exactly sixteen kinds carry a deliberate band', async () => {
  const { rows } = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM public.event_type_vocab WHERE ai_price_tier IS NOT NULL`,
  );
  assert.equal(Number(rows[0]!.n), 16);
});

test('SETNAYAN_AI_RENEW never gains a sign-up price', async () => {
  // A renewal is not an onboarding purchase — nobody renews during the create
  // flow — and it is the one row where a discount lands on a fraction of a peso.
  const { rows } = await db.query<{ onboarding_price_php: string | null }>(
    `SELECT onboarding_price_php FROM public.platform_retail_catalog_v2
      WHERE service_code = 'SETNAYAN_AI_RENEW'`,
  );
  if (rows.length > 0) {
    assert.equal(rows[0]!.onboarding_price_php, null);
  }
});

test('not one sign-up price in either family is a fraction of a peso', async () => {
  const { rows } = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM public.platform_retail_catalog_v2
      WHERE (service_code LIKE 'PAPIC_GUEST%' OR service_code LIKE 'SETNAYAN_AI%')
        AND onboarding_price_php IS NOT NULL
        AND onboarding_price_php <> ROUND(onboarding_price_php, 0)`,
  );
  assert.equal(Number(rows[0]!.n), 0, 'a price the checkout cannot render exactly is a price somebody disputes');
});

test('nothing anywhere costs as much or MORE at sign-up', async () => {
  const { rows } = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM public.platform_retail_catalog_v2
      WHERE onboarding_price_php IS NOT NULL
        AND retail_price_php > 0
        AND onboarding_price_php >= retail_price_php`,
  );
  assert.equal(Number(rows[0]!.n), 0, 'buying early must never cost more');
});

test('Live Studio is charged per event-day, like the rest of its family', async () => {
  const { rows } = await db.query<{ service_code: string; billing_period: string }>(
    `SELECT service_code, billing_period FROM public.platform_retail_catalog_v2
      WHERE service_code IN ('LIVE_STUDIO','PANOOD_SYSTEM','PANOOD_SYSTEM_MOBILE','LIVE_STUDIO_ROAM')`,
  );
  for (const r of rows) {
    assert.equal(r.billing_period, 'per_day', `${r.service_code} must be per_day`);
  }
});
