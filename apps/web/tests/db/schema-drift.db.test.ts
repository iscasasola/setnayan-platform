/**
 * SCHEMA DRIFT — the migrations and production must agree about what exists.
 *
 * Replays the migrations production's ledger says it has applied into an
 * in-process PGlite, then compares the resulting `public` column set against
 * the committed snapshot of production at
 * supabase/security/prod-schema.snapshot.txt.
 *
 * ── THE BUG THIS EXISTS TO CATCH ───────────────────────────────────────────
 * `CREATE TABLE IF NOT EXISTS` silently no-ops when the table already exists in
 * a different shape. The columns inside never land — but the statement
 * SUCCEEDS, `supabase db push` reports success, and the version is written to
 * `schema_migrations`. The ledger says applied; the schema disagrees. Nothing
 * goes red. Found 2026-07-26 in 20260628000000_v2_additive_phase_a.sql, which
 * uses that idiom for tables that already existed.
 *
 * A fresh replay is the perfect detector, and for a slightly subtle reason: on
 * an empty database `IF NOT EXISTS` DOES create, so the replay ends up holding
 * what the migration MEANT, while prod holds what it actually GOT. The diff
 * between them is precisely the set of statements that no-opped.
 *
 * ── WHY HERE AND NOT A SCHEDULED WORKFLOW ──────────────────────────────────
 * Both were on the table. This is a `.db.test.ts` because:
 *
 *   1. It runs on the PULL REQUEST, before the migration is applied. A nightly
 *      job against prod can only report drift that already shipped; this
 *      reports it while the diff is still on screen and cheap to fix.
 *   2. It needs NO production credentials. The prod half is a committed
 *      snapshot, so nothing in CI holds a database URL — the same trade the
 *      exposure freeze makes (supabase/security/README.md, "Scope, honestly").
 *   3. `test:db:ci` is a glob over `tests/db/*.db.test.ts` inside the required
 *      "typecheck + lint" job, so this is picked up with no wiring to forget.
 *
 * The cost of that trade is that the prod half is only as fresh as the last
 * `pnpm --filter @setnayan/web schema:snapshot`. That is a real limitation and
 * it is stated in "HONEST LIMITS" below rather than buried.
 *
 * ── WHY NOT readSchema() ───────────────────────────────────────────────────
 * The obvious cheap implementation — diff `lib/security/migration-schema.ts`'s
 * regex-derived schema against prod — was built first and THROWN AWAY. It
 * reported 32 missing columns, and 18 were false positives, because that parser
 * UNIONS every migration and never processes `DROP COLUMN` or `RENAME COLUMN`:
 * a column added in March and dropped in August still looks declared. Verified
 * individually — all 18 had a real DROP/RENAME migration
 * (e.g. `events.sde_video_r2_key` added 20270213100000, dropped 20270316029217;
 * `events.editorial_tone` renamed to `story_tone` in 20260914000000).
 *
 * A guard with an 18/32 false-positive rate is a guard people learn to ignore.
 * Replaying REAL SQL fixes the whole class at the root instead of allow-listing
 * it one entry at a time: `DROP COLUMN` drops, `RENAME COLUMN` renames, DO
 * blocks execute, `CREATE UNLOGGED TABLE` creates (which the regex misses
 * entirely — that is why `rate_limit_hits` looked undeclared), and
 * `ALTER TABLE ... RENAME TO` renames (which is why `reel_music_tracks` did).
 * All four of those classes are false positives under the parser and simply do
 * not arise here.
 *
 * ── HONEST LIMITS ──────────────────────────────────────────────────────────
 *  1. COLUMN EXISTENCE ONLY. Types, defaults, nullability, constraints and
 *     indexes are NOT compared. This is a real hole and it hides real bugs:
 *     `manual_payment_logs.items_ordered` is declared `JSONB` and is `text[]`
 *     in prod, and `admin_audit_log.target_id` is declared `UUID` by a dead
 *     stub and is `TEXT` in prod. Neither is visible here. Widening to types
 *     means modelling PGlite-vs-prod type spelling differences, which is worth
 *     doing as a follow-up, not worth blocking this on.
 *  2. THE SNAPSHOT CAN GO STALE. It is refreshed by a human running the
 *     generator. Staleness produces NOISE (a complaint naming the refresh
 *     command), not silence, so it fails in the safe direction.
 *  3. `public` SCHEMA, BASE TABLES ONLY. Views, functions and other schemas are
 *     the exposure freeze's job, not this one.
 *  4. FIVE MIGRATIONS ARE UNAPPLYABLE ON A FRESH DATABASE and are skipped by
 *     the replay harness (see ALLOWED_SKIP there). All five are data seeds or
 *     CHECK re-assertions; none adds or drops a column, so none affects this
 *     comparison. The test asserts the skip list stays that small.
 *  5. PROD-ONLY OBJECTS ARE ALLOW-LISTED, NOT FIXED. Two tables exist in prod
 *     with no migration at all. Back-filling them is the right fix and is
 *     deliberately not guessed at here — see KNOWN_GAPS for why a wrong
 *     back-fill would itself be a future no-op trap.
 *
 * There is no skip path. PGlite is in-process, so "no database available" is
 * not a state this test can be in.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, versionOf, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import {
  SNAPSHOT_PATH_FROM_REPO_ROOT,
  KNOWN_GAPS,
  KNOWN_GAP_CEILING,
  MIN_TABLES,
  MIN_COLUMNS,
  MIN_LEDGER,
  diffSchema,
  unexplained,
  isKnownGap,
  tableOf,
  parseSnapshot,
  renderSnapshot,
  declaredCounts,
  formatDriftReport,
  type Divergence,
  type ProdSnapshot,
} from './schema-snapshot';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** apps/web/tests/db → repo root is four levels up. */
const REPO_ROOT = path.resolve(HERE, '../../../..');
const SNAPSHOT_FILE = path.join(REPO_ROOT, SNAPSHOT_PATH_FROM_REPO_ROOT);

let snapshotText: string;
let snapshot: ProdSnapshot;
let replay: ReplayResult;
let replayAll: ReplayResult;
/** `table.column` after replaying ONLY the migrations prod says it applied. */
let declaredLedger: Set<string>;
/** `table.column` after replaying EVERY migration in the repo. */
let declaredAll: Set<string>;
let prod: Set<string>;
let divergences: Divergence[];

const COLUMNS_SQL = `
  SELECT c.relname AS t, a.attname AS c
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p')
     AND a.attnum > 0 AND NOT a.attisdropped
   ORDER BY 1, 2
`;

async function columnsOf(db: PGlite): Promise<Set<string>> {
  const q = await db.query<{ t: string; c: string }>(COLUMNS_SQL);
  return new Set(
    q.rows
      // Bookkeeping table the replay harness itself creates — not a migration.
      .filter((r) => r.t !== '_replay_migrations')
      .map((r) => `${r.t}.${r.c}`),
  );
}

before(async () => {
  snapshotText = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
  snapshot = parseSnapshot(snapshotText);

  // Two replays, ~6 s each. See diffSchema's docblock for why both are needed:
  // the first is what prod SHOULD look like, the second is what the repo would
  // produce once everything pending is applied. Comparing against both is what
  // distinguishes real drift from a migration that simply has not shipped yet.
  [replay, replayAll] = await Promise.all([
    createReplayedDb({ only: new Set(snapshot.ledger) }),
    createReplayedDb(),
  ]);

  declaredLedger = await columnsOf(replay.db);
  declaredAll = await columnsOf(replayAll.db);
  prod = new Set(snapshot.columns);
  divergences = diffSchema(declaredLedger, declaredAll, prod);
});

after(async () => {
  await replay?.db?.close();
  await replayAll?.db?.close();
});

/* ── 1. ANTI-VACUITY ────────────────────────────────────────────────────────
 * A drift check that silently compares nothing is exactly how this drift
 * survived. Both sides must be demonstrably substantial before any comparison
 * below is worth believing.
 */

test('meta: BOTH sides of the comparison are substantial, so nothing-vs-nothing cannot pass', () => {
  const declaredTables = new Set([...declaredLedger].map(tableOf));
  const prodTables = new Set([...prod].map(tableOf));

  assert.ok(
    declaredTables.size >= MIN_TABLES,
    `the REPLAY produced only ${declaredTables.size} tables (floor ${MIN_TABLES}). The migration ` +
      `replay is broken — do NOT lower the floor to make this pass.`,
  );
  assert.ok(
    declaredLedger.size >= MIN_COLUMNS,
    `the REPLAY produced only ${declaredLedger.size} columns (floor ${MIN_COLUMNS}). See above.`,
  );
  assert.ok(
    declaredAll.size >= MIN_COLUMNS,
    `the FULL replay produced only ${declaredAll.size} columns (floor ${MIN_COLUMNS}). See above.`,
  );
  // The full replay is a superset of the ledger replay ONLY when no pending
  // migration drops anything, so this is a size sanity check, not an equality.
  assert.ok(
    replayAll.total >= replay.total,
    `the full replay considered fewer files (${replayAll.total}) than the ledger-filtered one ` +
      `(${replay.total}) — the \`only\` filter is inverted`,
  );
  assert.ok(
    prodTables.size >= MIN_TABLES,
    `the SNAPSHOT holds only ${prodTables.size} tables (floor ${MIN_TABLES}). It looks truncated — ` +
      `regenerate with \`pnpm --filter @setnayan/web schema:snapshot\`.`,
  );
  assert.ok(
    prod.size >= MIN_COLUMNS,
    `the SNAPSHOT holds only ${prod.size} columns (floor ${MIN_COLUMNS}). See above.`,
  );
  assert.ok(
    snapshot.ledger.length >= MIN_LEDGER,
    `the SNAPSHOT ledger holds only ${snapshot.ledger.length} migrations (floor ${MIN_LEDGER}).`,
  );

  // The floors above are necessary but not sufficient: a replay that produced
  // 4000 columns of the WRONG tables would still pass them. Pin a handful of
  // load-bearing tables by name so a structurally-broken replay cannot look
  // healthy just by being large.
  for (const t of ['users', 'events', 'orders', 'payments', 'vendor_profiles', 'guests']) {
    assert.ok(declaredTables.has(t), `replay is missing core table "${t}" — the replay is broken`);
    assert.ok(prodTables.has(t), `snapshot is missing core table "${t}" — the snapshot is broken`);
  }
});

/* ── 2. SNAPSHOT INTEGRITY ──────────────────────────────────────────────────*/

test('meta: the committed snapshot exists, parses, is canonical, and is not truncated', () => {
  const counts = declaredCounts(snapshotText);
  assert.equal(
    counts.ledger,
    snapshot.ledger.length,
    `snapshot header says ${counts.ledger} ledger rows but ${snapshot.ledger.length} parsed — ` +
      `the file was truncated or hand-edited. Regenerate rather than patching it.`,
  );
  assert.equal(
    counts.columns,
    snapshot.columns.length,
    `snapshot header says ${counts.columns} columns but ${snapshot.columns.length} parsed — see above.`,
  );
  assert.equal(
    counts.tables,
    new Set(snapshot.columns.map(tableOf)).size,
    'snapshot header table count disagrees with its own column list',
  );

  // Canonical order: an unsorted file produces diff churn, and churn trains
  // reviewers to skim past exactly the line that mattered.
  assert.equal(
    renderSnapshot(snapshot),
    snapshotText,
    'snapshot is not in canonical order (or was hand-edited). Regenerate with ' +
      '`pnpm --filter @setnayan/web schema:snapshot`.',
  );

  assert.equal(new Set(snapshot.columns).size, snapshot.columns.length, 'snapshot has duplicate columns');
  assert.equal(new Set(snapshot.ledger).size, snapshot.ledger.length, 'snapshot has duplicate ledger versions');
  for (const c of snapshot.columns) {
    assert.ok(/^[a-z0-9_]+\.[a-z0-9_]+$/i.test(c), `malformed snapshot column entry: ${c}`);
  }
});

/* ── 3. LEDGER RECONCILIATION ───────────────────────────────────────────────
 * The replay can only reproduce prod if every migration prod applied still
 * exists as a file. An "orphan" (ledger row with no file) means prod ran
 * something this repo no longer contains — the replay is then missing its
 * effects and every downstream difference is noise.
 */

test('meta: every migration in the snapshot ledger still exists as a file', () => {
  const files = new Set(
    fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).map(versionOf),
  );
  const orphans = snapshot.ledger.filter((v) => !files.has(v));
  assert.deepEqual(
    orphans,
    [],
    `prod's ledger references ${orphans.length} migration(s) with no file in supabase/migrations:\n` +
      orphans.map((v) => `      · ${v}`).join('\n') +
      `\n    The replay cannot reproduce prod without them, so every difference this ` +
      `test reports would be noise. Investigate with \`pnpm migration:doctor\`.`,
  );

  // The replay must actually have applied them, not quietly dropped a pile.
  assert.equal(
    replay.total,
    snapshot.ledger.length,
    `replay considered ${replay.total} files but the ledger has ${snapshot.ledger.length} — the ` +
      `\`only\` filter is not doing what this test assumes`,
  );
  assert.ok(
    replay.skipped.length <= 5,
    `replay skipped ${replay.skipped.length} migrations (expected at most 5, all data seeds / CHECK ` +
      `re-assertions that add no columns). A new skip may be hiding real schema:\n` +
      replay.skipped.map((s) => `      · ${s.file} — ${s.reason}`).join('\n'),
  );
});

/* ── 4. ALLOW-LIST HYGIENE ──────────────────────────────────────────────────
 * The ratchet. Entries may be removed freely; the count may not grow past the
 * ceiling, and an entry that no longer matches anything must be deleted so the
 * list cannot rot into a pile of stale excuses.
 */

test('meta: the allow-list is a ratchet — bounded, reasoned, and free of dead entries', () => {
  assert.ok(
    KNOWN_GAPS.size <= KNOWN_GAP_CEILING,
    `KNOWN_GAPS holds ${KNOWN_GAPS.size} entries but the ceiling is ${KNOWN_GAP_CEILING}. ` +
      `Adding a known gap is a deliberate act: fix the drift, or raise the ceiling in the ` +
      `same commit and say why in the review.`,
  );

  for (const [key, reason] of KNOWN_GAPS) {
    assert.ok(
      reason.trim().length >= 25,
      `KNOWN_GAPS["${key}"] has no usable reason. "known issue" is not a reason — write down ` +
        `why a stranger should accept this divergence.`,
    );
    assert.ok(/^[a-z0-9_]+\.([a-z0-9_]+|\*)$/i.test(key), `malformed KNOWN_GAPS key: ${key}`);
  }

  // No dead entries: every allow-list key must still explain something real.
  const live = new Set(divergences.map((d) => d.key));
  const liveTables = new Set([...live].map(tableOf));
  const dead = [...KNOWN_GAPS.keys()].filter((k) =>
    k.endsWith('.*') ? !liveTables.has(tableOf(k)) : !live.has(k),
  );
  assert.deepEqual(
    dead,
    [],
    `KNOWN_GAPS has ${dead.length} entry/entries that no longer match any divergence:\n` +
      dead.map((k) => `      · ${k}`).join('\n') +
      `\n    Good news — they were fixed. Delete them and lower KNOWN_GAP_CEILING to ${
        KNOWN_GAPS.size - dead.length
      }.`,
  );
});

/* ── 5. NEUTRALISATION ──────────────────────────────────────────────────────
 * The differ is fed synthetic inputs and must classify each correctly. Remove
 * the guard logic and these fail — which is the only way to know the green tick
 * above means anything.
 */

test('meta: the differ catches injected divergences and stays quiet on agreement (neutralisation proof)', () => {
  const base = new Set(['users.email', 'users.user_id', 'events.event_id', 'orders.order_id']);
  const s = (...extra: string[]) => new Set([...base, ...extra]);

  // Total agreement → no divergence at all.
  assert.deepEqual(
    diffSchema(base, base, new Set(base)),
    [],
    'differ invented a divergence between identical schemas',
  );

  const cases: Array<
    [label: string, ledger: Set<string>, all: Set<string>, prod: Set<string>, kind: Divergence['kind'], key: string]
  > = [
    [
      'THE BUG: an applied migration created a column prod does not have',
      s('orders.expires_at'),
      s('orders.expires_at'),
      new Set(base),
      'DECLARED_NOT_IN_PROD',
      'orders.expires_at',
    ],
    [
      'an entire applied table is missing from prod',
      s('brand_new.id'),
      s('brand_new.id'),
      new Set(base),
      'DECLARED_NOT_IN_PROD',
      'brand_new.id',
    ],
    [
      'prod has a column no migration anywhere declares',
      base,
      base,
      s('users.secret_backdoor'),
      'PROD_NOT_DECLARED',
      'users.secret_backdoor',
    ],
    [
      'prod has an entire table no migration anywhere declares',
      base,
      base,
      s('shadow_table.id'),
      'PROD_NOT_DECLARED',
      'shadow_table.id',
    ],
  ];

  for (const [label, ledger, all, p, kind, key] of cases) {
    const got = diffSchema(ledger, all, p);
    assert.equal(got.length, 1, `differ MISSED (or over-reported) an injected divergence: ${label}`);
    assert.equal(got[0]!.kind, kind, `differ MISCLASSIFIED: ${label}`);
    assert.equal(got[0]!.key, key, `differ named the wrong object: ${label}`);
    // The report must actually NAME the object; a failure nobody can act on
    // gets rubber-stamped.
    assert.match(formatDriftReport(got), new RegExp(key.replace('.', '\\.')), `report did not name ${key}`);
  }

  // ── The three cases that must stay QUIET, or this guard gets disabled ─────
  assert.deepEqual(
    diffSchema(base, s('foo.brand_new_col'), new Set(base)),
    [],
    'a pending migration adding a NEW column must not be reported — it is simply not deployed yet, ' +
      'and reporting it would make every schema pull request red',
  );
  assert.deepEqual(
    diffSchema(s('orders.expires_at'), base, new Set(base)),
    [],
    'a pending migration that DROPS the phantom column must clear the finding — the fix is in ' +
      'flight, and re-reporting it would block the pull request that repairs it',
  );
  assert.deepEqual(
    diffSchema(base, s('users.out_of_band'), s('users.out_of_band')),
    [],
    'a pending migration that BACK-FILLS an out-of-band column must clear the finding',
  );

  // A rename surfaces as BOTH directions at once — the shape a real
  // RENAME COLUMN takes when only one side has been updated.
  const renamed = diffSchema(s('events.editorial_tone'), s('events.editorial_tone'), s('events.story_tone'));
  assert.equal(renamed.length, 2, 'a rename should surface as one missing and one unexpected column');
  assert.ok(renamed.some((d) => d.kind === 'DECLARED_NOT_IN_PROD' && d.key === 'events.editorial_tone'));
  assert.ok(renamed.some((d) => d.kind === 'PROD_NOT_DECLARED' && d.key === 'events.story_tone'));

  // The allow-list suppresses, and does so precisely: an exact key covers only
  // itself, a `t.*` key covers the whole table, and neither leaks elsewhere.
  const gaps = new Map([
    ['orders.expires_at', 'x'.repeat(30)],
    ['shadow_table.*', 'y'.repeat(30)],
  ]);
  const mixed = diffSchema(
    s('orders.expires_at', 'other.col'),
    s('orders.expires_at', 'other.col'),
    s('shadow_table.a', 'shadow_table.b'),
  );
  assert.deepEqual(
    unexplained(mixed, gaps).map((d) => d.key),
    ['other.col'],
    'allow-list suppressed the wrong set — it must cover exactly its own keys and no more',
  );
  assert.ok(isKnownGap('shadow_table.anything', gaps), '`t.*` must cover every column of that table');
  assert.ok(!isKnownGap('orders.something_else', gaps), 'an exact key must NOT cover its whole table');
});

/* ── 6. THE CHECK ITSELF ────────────────────────────────────────────────────*/

test('THE CHECK: every migration production applied actually landed', () => {
  const left = unexplained(divergences);
  if (left.length > 0) assert.fail(formatDriftReport(left));

  const suppressed = divergences.length;
  if (suppressed > 0) {
    console.log(
      `\n  ✓ schema matches production, with ${suppressed} allow-listed divergence(s):\n` +
        divergences
          .map((d) => `      · ${d.kind} ${d.key} — ${KNOWN_GAPS.get(d.key) ?? KNOWN_GAPS.get(`${tableOf(d.key)}.*`)}`)
          .join('\n') +
        '\n',
    );
  }
});
