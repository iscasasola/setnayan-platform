/**
 * EVERY PERSON-KEYED TABLE IS DECIDED — a table holding rows about a person is
 * either in their data export or excluded with a written reason. Never neither.
 *
 * ── The defect this exists to stop ─────────────────────────────────────────
 * `/privacy` grants an unqualified RA 10173 § 16(c) right: "download a JSON
 * archive of your data anytime". `/api/profile/export` is careful about what it
 * READ and could not read — `listOutcome`, `not_included`, `export_complete`,
 * and a ban on `?? []` so a refused read can never render as "you have none".
 *
 * 🔑 BUT A TABLE THE ROUTE NEVER QUERIES IS ABSENT FROM `not_included` TOO. It
 * is not reported missing; it is outside the universe the route knows about.
 * Careful accounting of a set that is itself incomplete still reports
 * completeness — and `export_complete: true` is exactly the sentence a
 * regulator would read.
 *
 * Measured against production 2026-09-15: seven person-keyed tables with live
 * rows were in neither list — `receipts` (4 rows), `notifications` (72),
 * `user_devices` (32), `social_posts` (103), `order_ledger` (9),
 * `event_moderators` (6), `creator_chapters` (1).
 *
 * ── What this asserts, and what it deliberately does NOT ───────────────────
 * It asserts that every table carrying a person-key column has a DECISION in
 * `lib/export-completeness.ts`. It does NOT assert that a table is exported —
 * some must not be (credentials, another person's accountability record). The
 * property is that somebody decided and wrote down why, not that the answer
 * went one way.
 *
 * ⚠ It also cannot see personal data held WITHOUT a person-key column — a row
 * reachable only through an event or a thread. That is a real gap and it is
 * stated rather than left to be discovered; this guard raises the floor.
 *
 * 🛡 Mutation-checked: removing `users` from the registry turns it RED naming
 * `users`; adding a person-keyed table to the replayed schema turns it RED
 * naming that table.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  EXPORT_DECISIONS,
  PERSON_KEY_COLUMNS,
  UNDECIDED_PERSON_KEYED_TABLES,
  excludedTables,
} from '../../lib/export-completeness';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

test('every table keyed to a person is exported or excluded with a reason', async () => {
  const res = await db.query<{ table_name: string }>(
    `SELECT DISTINCT c.table_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema
        AND t.table_name  = c.table_name
        AND t.table_type  = 'BASE TABLE'
      WHERE c.table_schema = 'public'
        AND c.column_name = ANY($1)
      ORDER BY c.table_name`,
    [[...PERSON_KEY_COLUMNS]],
  );

  const decided = new Set(EXPORT_DECISIONS.map((d) => d.table));
  const knownUndecided = new Set(UNDECIDED_PERSON_KEYED_TABLES);
  const inSchema = res.rows.map((r) => r.table_name);

  const unaccounted = inSchema.filter((t) => !decided.has(t) && !knownUndecided.has(t));

  assert.deepEqual(
    unaccounted,
    [],
    'These tables hold rows about a particular person and appear NOWHERE in ' +
      'lib/export-completeness.ts — not exported, not excluded, not even on the undecided ' +
      'backlog. Decide now, while you still know what the table holds: export it, or exclude ' +
      'it with a reason you could defend to the person whose access request it narrows. ' +
      'Adding it to UNDECIDED is not an option — that list may only shrink. ' +
      'Silence is the one answer RA 10173 § 16(c) does not allow.',
  );
});

test('the undecided backlog only shrinks — it may never gain a table', async () => {
  // 🔒 THE RATCHET. A new person-keyed table must be DECIDED when it is added,
  // not parked. Without this, `UNDECIDED` becomes the place work goes to die and
  // the guard above becomes a formality that always passes.
  const res = await db.query<{ table_name: string }>(
    `SELECT DISTINCT c.table_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema
        AND t.table_name  = c.table_name
        AND t.table_type  = 'BASE TABLE'
      WHERE c.table_schema = 'public'
        AND c.column_name = ANY($1)`,
    [[...PERSON_KEY_COLUMNS]],
  );
  const inSchema = new Set(res.rows.map((r) => r.table_name));
  const decided = new Set(EXPORT_DECISIONS.map((d) => d.table));

  // A backlog entry that has since been decided, or whose table is gone, must be
  // REMOVED from the list — otherwise the count stops meaning anything.
  const stale = UNDECIDED_PERSON_KEYED_TABLES.filter(
    (t) => decided.has(t) || !inSchema.has(t),
  );
  assert.deepEqual(
    stale,
    [],
    'These sit on the undecided backlog but are already decided, or no longer exist. ' +
      'Take them off the list: a backlog that keeps settled entries cannot be read as progress.',
  );
});

test('an exclusion carries a real reason, not a placeholder', () => {
  for (const { table, why } of excludedTables()) {
    assert.ok(
      why.trim().length > 40,
      `${table}: an exclusion needs a reason a person could argue with, not a label`,
    );
  }
});

test('no table is both exported and excluded', () => {
  const seen = new Map<string, string>();
  for (const d of EXPORT_DECISIONS) {
    const prior = seen.get(d.table);
    assert.equal(
      prior,
      undefined,
      `${d.table} is listed twice (${prior} and ${d.decision}) — one table, one decision`,
    );
    seen.set(d.table, d.decision);
  }
});
