import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  PAPIC_FREE_GRANT_SOURCE,
  PAPIC_REPEAT_EVENT_GRANT_POINTS,
  freePapicGrantRow,
  isAlreadyArmedError,
} from './papic-free-grant';
import { PAPIC_FREE_GRANT_POINTS_FALLBACK, fetchPapicFreeGrantPoints } from './papic-tier-copy';

// Resolved by slug, not by prefix: the migration was reissued under a fresh
// allocator prefix after its original number was claimed by a duplicate-prefix
// twin, and a renumber must not break this drift guard.
const MIGRATIONS_DIR = join(process.cwd(), '..', '..', 'supabase', 'migrations');
const migrationFile = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.includes('papic_free_pool_grant_arm'))
  .sort()
  .pop();
if (!migrationFile) throw new Error('papic_free_pool_grant_arm migration not found');
const MIGRATION = join(MIGRATIONS_DIR, migrationFile);

test('the free-pool fallback is 50 points (owner-locked 2026-07-27)', () => {
  // ONE fallback literal, shared with the display half. There is deliberately no
  // second constant in papic-free-grant.ts — see the 2026-07-28 correction.
  assert.equal(PAPIC_FREE_GRANT_POINTS_FALLBACK, 50);
});

test('the grant row is shaped for papic_event_point_grants', () => {
  const row = freePapicGrantRow('evt-1', 50, true);
  assert.equal(row.event_id, 'evt-1');
  assert.equal(row.points, 50);
  // Must be one of the CHECK-constrained sources on the table, and must be the
  // one the partial unique index keys on — anything else silently disables the
  // once-per-event guarantee.
  assert.equal(row.source, 'free_grant');
  assert.equal(PAPIC_FREE_GRANT_SOURCE, 'free_grant');
});

test('the grant row carries the ADMIN value, not a baked-in default', () => {
  // The regression this locks: the first cut hardcoded 50, so an admin raising
  // papic_event_pool_config.free_grant_points would move the COPY while the
  // meter kept handing out 50.
  assert.equal(freePapicGrantRow('evt-1', 90, true).points, 90);
  assert.equal(freePapicGrantRow('evt-1', 250, true).points, 250);
});

test('DRIFT GUARD — the migration backfill matches the shared fallback', () => {
  // The backfill runs in SQL before any app code, so its literal must equal the
  // fallback the app uses when the config row is unreadable. If they disagree,
  // events created before and after a deploy get different free allowances.
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(
    sql,
    new RegExp(`\\n\\s*${PAPIC_FREE_GRANT_POINTS_FALLBACK},\\n\\s*'free_grant'`),
    `The backfill must grant exactly ${PAPIC_FREE_GRANT_POINTS_FALLBACK} points with source 'free_grant'`,
  );
});

test('DRIFT GUARD — the migration keeps the once-per-event index PARTIAL', () => {
  // A plain unique on (event_id, source) would also cap topup_order and
  // camera_grant at one row per event, but Pool top-ups are repeatable and
  // Papic One is sold per camera — those legitimately stack. Only the free
  // grant is once-per-event, so the predicate is load-bearing.
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*?papic_event_point_grants \(event_id\)\s*\n\s*WHERE source = 'free_grant'/);
});

// ── fetchPapicFreeGrantPoints — the single live reader ─────────────────────
// Stubs the one query shape it issues. The failure modes matter more than the
// happy path: every one of them must land on the fallback rather than on a
// value that would either mint a bad grant or crash event creation.
function stubClient(result: { data?: unknown; error?: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  } as never;
}

test('reads the ADMIN-editable free_grant_points', async () => {
  const n = await fetchPapicFreeGrantPoints(stubClient({ data: { free_grant_points: 90 } }));
  assert.equal(n, 90);
});

test('a missing row, a read error, or a throw falls back — never crashes creation', async () => {
  assert.equal(await fetchPapicFreeGrantPoints(stubClient({ data: null })), 50);
  assert.equal(await fetchPapicFreeGrantPoints(stubClient({ error: { message: 'boom' } })), 50);
  const thrower = { from: () => { throw new Error('no client'); } } as never;
  assert.equal(await fetchPapicFreeGrantPoints(thrower), 50);
});

test('a non-positive or junk config value falls back, never mints a bad grant', async () => {
  // papic_event_point_grants CHECKs points > 0. A 0/negative/NaN config value
  // would turn every arm into a silent insert failure and put us straight back
  // to the UNMETERED state this whole line of work exists to fix.
  for (const bad of [0, -5, null, undefined, 'abc', NaN]) {
    assert.equal(
      await fetchPapicFreeGrantPoints(stubClient({ data: { free_grant_points: bad } })),
      50,
      `free_grant_points=${String(bad)} must fall back, not mint a bad grant`,
    );
  }
});

test('a fractional config value is truncated to a whole point', async () => {
  assert.equal(await fetchPapicFreeGrantPoints(stubClient({ data: { free_grant_points: 90.7 } })), 90);
});

// ── first-event-only (2026-09-04) ──────────────────────────────────────────

test('PAPIC_REPEAT_EVENT_GRANT_POINTS stays positive — 0 would be invisible to papic_event_pool_status()', () => {
  // papic_event_pool_status() (migration 20271185813837) fences on
  // SUM(points) > 0, not on row existence. A 0-point row would be
  // indistinguishable from no grant at all and revert the event to unmetered.
  assert.ok(PAPIC_REPEAT_EVENT_GRANT_POINTS > 0);
});

test('a repeat-event grant row carries the minimum and its own copy', () => {
  const row = freePapicGrantRow('evt-2', PAPIC_REPEAT_EVENT_GRANT_POINTS, false);
  assert.equal(row.points, PAPIC_REPEAT_EVENT_GRANT_POINTS);
  assert.match(row.note, /not this account's first event/);
});

test('a first-event grant row keeps the original first-event copy', () => {
  const row = freePapicGrantRow('evt-1', 50, true);
  assert.match(row.note, /armed at event creation/);
});

test('a 23505 unique violation means ALREADY ARMED, not a failure', () => {
  assert.equal(isAlreadyArmedError({ code: '23505' }), true);
});

test('any other error is a real failure — the event may still be unmetered', () => {
  assert.equal(isAlreadyArmedError({ code: '42P01' }), false); // undefined_table
  assert.equal(isAlreadyArmedError({ code: '42501' }), false); // insufficient_privilege
  assert.equal(isAlreadyArmedError({ code: null }), false);
  assert.equal(isAlreadyArmedError({}), false);
  assert.equal(isAlreadyArmedError(null), false);
});
