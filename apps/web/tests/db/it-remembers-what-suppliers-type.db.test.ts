/**
 * IT REMEMBERS WHAT SUPPLIERS CONFIRM — the collect half of C3 (2026-08-28),
 * against a real replayed schema.
 *
 * The unit guards beside this one (collected-trade-phrase.test.ts,
 * collected-trade-phrase-wiring.test.ts) read SOURCE. This one RUNS the
 * migration C2 already shipped and asks the database the two questions a
 * source read cannot answer:
 *
 *   1. Does a `source='collected'` row actually satisfy the table's real
 *      constraints (the FK to a live trade, the source CHECK, the
 *      review-pair CHECK)?
 *   2. Is an unreviewed collected phrase GENUINELY invisible to an ordinary
 *      session — not merely filtered by application code that could be
 *      edited away — and does approving it make it flow all the way
 *      through to what a supplier's search would actually return?
 *
 * ⚠ THE TRAP THIS FILE EXISTS TO CLOSE (register 2026-08-28 § C3): a mirror
 * of `admin_search_phrases`' RLS shape read through a USER-SESSION client
 * returns SILENT EMPTY — indistinguishable from "nothing collected yet".
 * `canonical_service_aliases` is not that shape (it has a real read POLICY,
 * not "RLS on, no policy"), but the only way to know that for certain is to
 * become an unprivileged role and ask, not to read the migration and
 * assume. `SET ROLE authenticated` below is a REAL, separate low-privilege
 * role in the replay (not the connecting superuser) — see
 * exposure-freeze.db.test.ts for why that distinction is load-bearing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { reviewedAliasesByLiveTrade, type TradeAliasRow } from '../../lib/service-trade-aliases';
import { rankTaxonomyOptions } from '../../lib/taxonomy-search-rank';

let replay: ReplayResult;
let db: PGlite;

const TRADE = 'sorbetes_cart';
const PHRASE = 'sorbetero sa kasal';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const r = await db.query<T>(sql, params);
  return r.rows[0];
}
async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

/** The trade must genuinely exist in the taxonomy for the FK to hold. */
async function ensureTrade() {
  await db.query(
    `INSERT INTO canonical_service_taxonomy (canonical_service, folder_id, phase)
     SELECT $1, (SELECT id FROM service_categories WHERE tier=1 LIMIT 1), 'planning'
     WHERE NOT EXISTS (SELECT 1 FROM canonical_service_taxonomy WHERE canonical_service=$1)`,
    [TRADE],
  );
}

/**
 * The exact write `recordCollectedTradePhrase` performs — an INSERT with
 * `ON CONFLICT (phrase) DO NOTHING`, run here as the connecting (superuser)
 * role, which is what the admin/service-role client also is in production
 * (bypasses RLS entirely, same as the seeding script's writes in
 * a-trade-we-do-not-have.db.test.ts's sibling tests).
 */
async function collect(phrase: string, canonicalService: string) {
  await db.query(
    `INSERT INTO canonical_service_aliases (phrase, canonical_service, source)
     VALUES ($1, $2, 'collected')
     ON CONFLICT (phrase) DO NOTHING`,
    [phrase, canonicalService],
  );
}

test('a collected phrase satisfies every real constraint on the table', async () => {
  await ensureTrade();
  await collect(PHRASE, TRADE);
  const row = await one<{ source: string; reviewed_at: string | null }>(
    `SELECT source, reviewed_at FROM canonical_service_aliases WHERE phrase = $1`,
    [PHRASE],
  );
  assert.ok(row, 'the collected row was not inserted at all');
  assert.equal(row!.source, 'collected');
  assert.equal(row!.reviewed_at, null, 'a freshly collected row must land unreviewed');
});

test('collecting the SAME phrase twice, for a DIFFERENT trade, does not overwrite the first', async () => {
  const OTHER = 'ice_cream_cart';
  await db.query(
    `INSERT INTO canonical_service_taxonomy (canonical_service, folder_id, phase)
     SELECT $1, (SELECT id FROM service_categories WHERE tier=1 LIMIT 1), 'planning'
     WHERE NOT EXISTS (SELECT 1 FROM canonical_service_taxonomy WHERE canonical_service=$1)`,
    [OTHER],
  );
  await collect(PHRASE, OTHER); // PHRASE already names TRADE from the test above
  const row = await one<{ canonical_service: string }>(
    `SELECT canonical_service FROM canonical_service_aliases WHERE phrase = $1`,
    [PHRASE],
  );
  assert.equal(
    row!.canonical_service,
    TRADE,
    'a second collected write for an already-known phrase overwrote the first answer',
  );
  const n = await count(`SELECT count(*)::int AS n FROM canonical_service_aliases WHERE phrase = $1`, [PHRASE]);
  assert.equal(n, 1, 'a duplicate phrase produced a second row instead of being ignored');
});

test('RLS hides an unreviewed collected phrase from an ordinary session — the exact silent-empty risk this file guards against', async () => {
  await db.exec('SET ROLE authenticated');
  try {
    const who = await one<{ me: string; su: boolean; bypass: boolean }>(
      `SELECT current_user AS me,
              (SELECT rolsuper     FROM pg_roles WHERE rolname = current_user) AS su,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`,
    );
    assert.equal(who!.me, 'authenticated', 'SET ROLE did not take effect');
    assert.equal(who!.su, false, 'probe role is a superuser — RLS would be bypassed and this proves nothing');
    assert.equal(who!.bypass, false, 'probe role has BYPASSRLS — this proves nothing');

    const rows = await db.query(`SELECT phrase FROM canonical_service_aliases WHERE phrase = $1`, [PHRASE]);
    assert.equal(
      rows.rows.length,
      0,
      'an authenticated session could read an UNREVIEWED collected phrase — the review gate is not real',
    );
  } finally {
    await db.exec('RESET ROLE');
  }
});

test('an authenticated session cannot mark its own collected phrase reviewed', async () => {
  // RLS's ordinary behaviour for a write policy that admits zero rows is not
  // a thrown error — it is an UPDATE that matches nothing (the same reason
  // `approveTradeAlias`'s own `.is('reviewed_at', null)` guard exists: a
  // double-press is silently a no-op, not a crash). So the real assertion is
  // "this touched zero rows and the row is still unreviewed", not "this threw".
  await db.exec('SET ROLE authenticated');
  try {
    const res = await db.query(`UPDATE canonical_service_aliases SET reviewed_at = now() WHERE phrase = $1`, [
      PHRASE,
    ]);
    assert.equal(
      res.affectedRows ?? 0,
      0,
      'an ordinary authenticated session updated a row RLS should have hidden it from entirely',
    );
  } finally {
    await db.exec('RESET ROLE');
  }
  const row = await one<{ reviewed_at: string | null }>(
    `SELECT reviewed_at FROM canonical_service_aliases WHERE phrase = $1`,
    [PHRASE],
  );
  assert.equal(
    row!.reviewed_at,
    null,
    'the row shows as reviewed after an authenticated session touched it — self-approval succeeded',
  );
});

test('once an admin approves it (mirroring approveTradeAlias exactly), it becomes readable AND resolves into a live search result', async () => {
  const admin = await one<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('reviewer@t.invalid', '{}'::jsonb) RETURNING id`,
  );
  await db.query(
    `UPDATE canonical_service_aliases
        SET reviewed_at = now(), reviewed_by = $2, updated_at = now()
      WHERE phrase = $1 AND reviewed_at IS NULL`,
    [PHRASE, admin!.id],
  );

  await db.exec('SET ROLE authenticated');
  let rows: { phrase: string; canonical_service: string; reviewed_at: string | null }[];
  try {
    const r = await db.query<{ phrase: string; canonical_service: string; reviewed_at: string | null }>(
      `SELECT phrase, canonical_service, reviewed_at FROM canonical_service_aliases WHERE phrase = $1`,
      [PHRASE],
    );
    rows = r.rows;
  } finally {
    await db.exec('RESET ROLE');
  }
  assert.equal(rows!.length, 1, 'an approved collected phrase is still invisible to an ordinary session');
  assert.ok(rows![0]!.reviewed_at, 'the read-back row shows no reviewed_at even after approval');

  // ── The end-to-end proof: feed the exact rows an ordinary session would
  // read into the SAME functions the maker's real page calls, and confirm
  // the phrase now ranks the trade it was collected for. ──
  const aliasesByLiveKey = reviewedAliasesByLiveTrade(
    rows! as TradeAliasRow[],
    {}, // no merges in play
    new Set([TRADE]),
  );
  const ranked = rankTaxonomyOptions(
    [{ key: TRADE, label: 'Sorbetes Cart', aliases: aliasesByLiveKey.get(TRADE) }],
    PHRASE,
  );
  assert.equal(ranked.length, 1, 'the approved collected phrase does not rank its trade at all');
  assert.equal(ranked[0]!.key, TRADE);
});

test('a collected row is bound by the FK — it cannot name a trade the taxonomy does not have', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO canonical_service_aliases (phrase, canonical_service, source)
       VALUES ('a phrase for nothing', 'not_a_real_trade_key', 'collected')`,
    ),
    /violates foreign key constraint/i,
  );
});

test('the source vocabulary still admits collected — the CHECK was not narrowed back to mined-only', async () => {
  const row = await one<{ conname: string }>(
    `SELECT conname FROM pg_constraint
      WHERE conrelid = 'canonical_service_aliases'::regclass
        AND conname = 'canonical_service_aliases_source_chk'`,
  );
  assert.ok(row, 'the source CHECK constraint is missing');
});
