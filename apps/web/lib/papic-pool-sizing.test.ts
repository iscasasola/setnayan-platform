/**
 * THE RECOMMENDATION KNOWS THE KIND OF CELEBRATION — AND A WEDDING DID NOT MOVE.
 *
 * Three properties, in the order they can hurt somebody:
 *
 *   1. **NO LIVE COUPLE'S NUMBER CHANGES ON MERGE.** 9 of the 11 live events
 *      are weddings. The `wedding` sizing row is seeded identical to the global
 *      row, so every wedding is quoted exactly what it was quoted yesterday.
 *      This is the build's acceptance test and it is asserted, not hoped.
 *   2. **THE CLAMP TRAVELS WITH THE PER-HEAD FIGURE.** Taking a type's
 *      `points_per_guest` while leaving the global floor of 5,000 in place
 *      recommends 5,000 credits for a two-person `date` — the thing that would
 *      have shipped broken. A sizing is all three numbers or it is nothing.
 *   3. **A FALLBACK IS NAMED.** `sizedBy` says which row answered, so a screen
 *      cannot claim a celebration was priced for its type when it was not.
 *
 * Run: cd apps/web && npx tsx --test lib/papic-pool-sizing.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  FALLBACK_POOL_SIZING,
  POOL_CONFIG_DEFAULT_KEY,
  POOL_CONFIG_GLOBAL_COLUMNS,
  pickPoolSizing,
  recommendedCredits,
  type PoolSizingRow,
} from './papic-pool-sizing';
import { computeEventPool, DEFAULT_EVENT_POOL_CONFIG } from './papic-event-pool';

const MIGRATION =
  '../../../supabase/migrations/20271239794268_papic_pool_sizing_knows_the_event_type.sql';

/** The live 'default' row, measured in prod 2026-09-22. */
const DEFAULT_ROW: PoolSizingRow = {
  config_key: 'default',
  points_per_guest: 150,
  floor_points: 5_000,
  recommend_floor_points: 5_000,
  ceiling_points: 30_000,
};

const WEDDING_ROW: PoolSizingRow = {
  config_key: 'wedding',
  points_per_guest: 150,
  floor_points: 5_000,
  recommend_floor_points: 5_000,
  ceiling_points: 30_000,
};

/**
 * ⚠ THE ENTITLEMENT FLOOR IS 5,000 HERE TOO — exactly as it is for a wedding
 * and exactly as it was before per-type rows existed. Only what we RECOMMEND a
 * `date` buys is different.
 */
const DATE_ROW: PoolSizingRow = {
  config_key: 'date',
  points_per_guest: 50,
  floor_points: 5_000,
  recommend_floor_points: 0,
  ceiling_points: 30_000,
};

const ROWS = [DEFAULT_ROW, WEDDING_ROW, DATE_ROW];

test('A LIVE WEDDING IS QUOTED THE SAME NUMBER BEFORE AND AFTER — the acceptance test', () => {
  /*
    Before this build every event resolved to the global row. After it, a
    wedding resolves to its own. The two must agree for every headcount, or a
    couple opens their page and the figure has moved under them.

    146 is the live guest count measured in prod 2026-09-22 and is called out
    because it is the number a human can check on the screen.
  */
  for (const guests of [1, 20, 33, 146, 150, 200, 400, 5_000]) {
    const before = computeEventPool(guests, DEFAULT_EVENT_POOL_CONFIG).basePoints;
    const after = recommendedCredits(guests, pickPoolSizing(ROWS, 'wedding')!).basePoints;
    assert.equal(after, before, `${guests}-guest wedding must not move`);
  }
  assert.equal(recommendedCredits(146, pickPoolSizing(ROWS, 'wedding')!).basePoints, 21_900);
});

test('THE CLAMP TRAVELS WITH THE PER-HEAD FIGURE — a dinner for two is not a wedding', () => {
  /*
    🛑 THE BUG THIS BUILD EXISTS TO AVOID. With the global floor still in force,
    a 2-guest date at 50/head computes 100 and is clamped UP to 5,000 — roughly
    ₱3,360 of credits recommended for two people at dinner.

    Sabotage to watch this go red: in the migration's seed, give `date` a
    floor of 5000 instead of 0.
  */
  const date = pickPoolSizing(ROWS, 'date')!;
  assert.equal(date.pointsPerGuest, 50);
  assert.equal(
    date.recommendFloorPoints,
    0,
    'a small event type must not be RECOMMENDED the wedding floor',
  );
  assert.equal(
    date.floorPoints,
    5_000,
    'and it must not LOSE the entitlement it already had — that is a different number',
  );

  const two = recommendedCredits(2, date);
  assert.equal(two.rawPoints, 100);
  assert.equal(two.basePoints, 100, 'the floor must not lift a dinner for two to 5,000');
  assert.equal(two.flooredUp, false);

  // And the mistake really is a mistake: the per-head figure alone, against the
  // global clamp, produces the absurd number.
  assert.equal(
    computeEventPool(2, { ...DEFAULT_EVENT_POOL_CONFIG, pointsPerGuest: 50 }).basePoints,
    5_000,
    'sanity: per-head alone + the global floor IS the broken answer',
  );
});

test('THE MIGRATION PRICES EVERY EVENT TYPE, AND ONLY WEDDING KEEPS A FLOOR', () => {
  /*
    The seed is read from the migration itself rather than restated here — a
    second copy of seventeen numbers is a second source of truth for them.

    Sabotage: delete one VALUES row (say `hangout`) and this goes red naming it.
  */
  const sql = readFileSync(new URL(MIGRATION, import.meta.url), 'utf8');
  const seeded = new Map<string, { perHead: number; recommendFloor: number }>();
  for (const m of sql.matchAll(/^\s*\('([a-z_]+)',\s*(\d+),\s*(\d+)\),?\s*$/gm)) {
    seeded.set(m[1]!, { perHead: Number(m[2]), recommendFloor: Number(m[3]) });
  }

  // The 17 live `event_type_vocab` rows, measured in prod 2026-09-22.
  const VOCAB = [
    'anniversary', 'birthday', 'celebration', 'christening', 'corporate',
    'date', 'debut', 'gala_night', 'gender_reveal', 'graduation', 'hangout',
    'reunion', 'simple_event', 'tournament', 'travel', 'wake', 'wedding',
  ];
  assert.equal(seeded.size, VOCAB.length, `expected ${VOCAB.length} seeded types`);
  for (const t of VOCAB) {
    assert.ok(seeded.has(t), `event type "${t}" has no Papic sizing row in the seed`);
  }

  // The owner's confirmed figures, 2026-09-22. A change here is an owner call.
  assert.equal(seeded.get('wedding')!.perHead, 150);
  assert.equal(seeded.get('travel')!.perHead, 150);
  assert.equal(seeded.get('debut')!.perHead, 120);
  assert.equal(seeded.get('christening')!.perHead, 70);
  assert.equal(seeded.get('hangout')!.perHead, 50);

  // Only wedding is RECOMMENDED a floor. Every other type is recommended what
  // its own per-head figure produces.
  for (const [type, v] of seeded) {
    assert.equal(
      v.recommendFloor,
      type === 'wedding' ? 5_000 : 0,
      `${type}: only a wedding is recommended the 5,000 floor`,
    );
  }

  /*
    🔑 AND NO TYPE LOSES ITS ENTITLEMENT — the assertion the first cut of this
    build needed and did not have.

    `floor_points` was doing two jobs: sizing a recommendation AND setting the
    pool a celebration is metered against (`papic_event_pool_status`'s v_base).
    Seeding sixteen types at 0 fixed the recommendation and, in the same stroke,
    quietly cut what a christening or a hangout is ENTITLED to from 5,000 to
    nothing — a money change nobody asked for, in a PR whose body said nothing
    moved.

    The seed now takes the entitlement straight from the global row, so this
    asserts the SQL still does that rather than re-listing seventeen numbers.

    Sabotage: change `d.floor_points` in the INSERT to `v.recommend_floor`.
  */
  assert.match(
    sql,
    /-- THE ENTITLEMENT — the global value, unchanged, for every single type\.\s*\n\s*d\.floor_points,/,
    'the entitlement floor must come from the global row, not from the per-type seed',
  );
  assert.match(
    sql,
    /RAISE EXCEPTION\s*\n\s*'refusing to apply: a per-type row changes the ENTITLEMENT/,
    'the migration must refuse to apply if a per-type row changes the entitlement',
  );
});

test('A FALLBACK SAYS SO — sizedBy never claims a type it did not use', () => {
  assert.equal(pickPoolSizing(ROWS, 'christening')!.sizedBy, POOL_CONFIG_DEFAULT_KEY);
  assert.equal(pickPoolSizing(ROWS, 'wedding')!.sizedBy, 'wedding');
  assert.equal(pickPoolSizing(ROWS, null)!.sizedBy, POOL_CONFIG_DEFAULT_KEY);
  assert.equal(pickPoolSizing(ROWS, '')!.sizedBy, POOL_CONFIG_DEFAULT_KEY);
  assert.equal(pickPoolSizing([], 'wedding'), null, 'no rows at all is null, not a guess');
  assert.equal(FALLBACK_POOL_SIZING.sizedBy, POOL_CONFIG_DEFAULT_KEY);
  // ⚠ The fallback recommends the GLOBAL floor, never 0 — an unreadable config
  // table must not quietly recommend less than every event was recommended
  // yesterday.
  assert.equal(FALLBACK_POOL_SIZING.recommendFloorPoints, 5_000);
});

test('THE GLOBAL COLUMNS ARE ONLY EVER READ OFF THE DEFAULT ROW', () => {
  /*
    ⚠ THE RULE THIS TABLE NOW NEEDS. After the seed, `papic_event_pool_config`
    holds two kinds of row: the global 'default' and 17 sizing rows. On a sizing
    row, `soft_stop_pct` / `free_grant_points` / the rest are inert seeded
    copies. A read of one of them that is NOT pinned to config_key='default'
    would silently answer off a sizing row.

    This asserts the PROPERTY on the SQL this build ships — the status function
    must take its soft stop from the default row even though it now takes its
    sizing per type. `scripts/lint-pool-config-global-columns.mjs` holds the
    same rule across the whole tree.

    Sabotage: in the migration, size the soft stop through
    papic_event_pool_sizing() instead of the default row.
  */
  const sql = readFileSync(new URL(MIGRATION, import.meta.url), 'utf8');
  const body = sql.slice(sql.indexOf('FUNCTION public.papic_event_pool_status'));
  assert.ok(body.length > 0, 'the status function must be in this migration');

  for (const col of POOL_CONFIG_GLOBAL_COLUMNS) {
    for (const m of body.matchAll(new RegExp(`SELECT\\s+${col}\\b[\\s\\S]{0,240}`, 'g'))) {
      assert.match(
        m[0],
        /config_key\s*=\s*'default'/,
        `${col} is read without pinning config_key='default'`,
      );
    }
  }
});

test('RESTATING A FUNCTION KEEPS EVERY TERM THE SHIPPED BODY HAD', () => {
  /*
    🚨 THE DEFECT THIS EXISTS FOR, AND IT SHIPPED ONCE.

    This migration `CREATE OR REPLACE`s `papic_event_pool_status`. It was
    rebuilt from migration 20271184624871's body — the SECOND-NEWEST definition
    — so it silently deleted the newest one's change: `+ COALESCE(v_released, 0)`,
    the credits guests have handed back out of their own purchases. The pot
    stopped rising when a guest gave credits back. Five assertions in
    `papic-a-guest-can-give-her-credits-back.db.test.ts` went red on CI with
    `0 !== 96`.

    🔑 A `CREATE OR REPLACE` IS A FULL OVERWRITE, SO COPYING A BODY IS A MERGE —
    AND `git diff --stat` CANNOT SEE IT. The migration file was new, so the diff
    showed additions only; nothing said a shipped behaviour had been reverted.
    The db suite caught it, four hours later.

    This asserts the pot's total still sums every term it is meant to. It is a
    cheap text check, deliberately: the db suite already proves the BEHAVIOUR,
    and what is missing is something that fails in seconds while the migration
    is being written.

    Sabotage: delete `+ COALESCE(v_released, 0)` from the migration.
  */
  const sql = readFileSync(new URL(MIGRATION, import.meta.url), 'utf8');
  const body = sql.slice(sql.indexOf('FUNCTION public.papic_event_pool_status'));
  const total = body.slice(body.indexOf('v_total :='), body.indexOf(';', body.indexOf('v_total :=')));

  for (const term of ['v_base', 'v_granted', 'v_alloc', 'v_released']) {
    assert.ok(
      total.includes(term),
      `the pot total no longer includes ${term} — restating this function dropped a term the shipped body had. ` +
        `Before re-stating any function, take the LAST definition:\n` +
        `  git grep -l 'FUNCTION public.<name>' -- supabase/migrations | sort | tail -1`,
    );
  }
  // …and that the give-back ledger is actually read, not merely declared.
  assert.match(
    body,
    /FROM public\.papic_seat_grant_releases/,
    'v_released is declared but never filled — the pot would still not rise when a guest gives credits back',
  );
});
