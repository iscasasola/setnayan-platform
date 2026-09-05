import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PAPIC_FREE_GRANT_SOURCE } from './papic-free-grant';
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

// ── 2026-09-06 · the reset loophole, and the one decision site ──────────────
// A post-merge audit found that "first event ever" was resolved from
// event_members, a row `couple_can_delete_member` lets the customer DELETE —
// so the 50-point grant could be re-earned at will. These pin the fix's two
// load-bearing properties in the SOURCE, because both are invisible to a unit
// test of behaviour: the claim must be unreachable from a browser, and the
// rule must not exist in TypeScript at all any more.

const FIX = (() => {
  const f = readdirSync(MIGRATIONS_DIR)
    .filter((n) => n.includes('free_grant_claim_and_comp_survives_event_delete'))
    .sort()
    .pop();
  if (!f) throw new Error('free_grant_claim_and_comp_survives_event_delete migration not found');
  return readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
})();

test('the claim table is REVOKED from anon and authenticated', () => {
  // The whole defect was a customer reaching the row the rule reads. If a
  // browser role can touch papic_free_grant_claims, the loophole is back in a
  // new shape — this is the assertion that would go red.
  assert.match(
    FIX,
    /REVOKE ALL ON public\.papic_free_grant_claims FROM anon, authenticated/,
    'papic_free_grant_claims must be unreachable from any browser role',
  );
  assert.match(FIX, /ALTER TABLE public\.papic_free_grant_claims ENABLE ROW LEVEL SECURITY/);
});

test('the claim is keyed one-per-account and survives its event being deleted', () => {
  assert.match(FIX, /user_id\s+UUID PRIMARY KEY REFERENCES auth\.users\(id\)/);
  // event_id must be SET NULL, never CASCADE — deleting the event must not
  // erase the claim, or deleting an event becomes the reset button again.
  assert.match(FIX, /event_id\s+UUID REFERENCES public\.events\(event_id\) ON DELETE SET NULL/);
});

test('a deleted event REVOKES its scoped comp rather than widening it', () => {
  // comp_grants.event_id NULL means "every event this user hosts", so plain
  // SET NULL on delete would PROMOTE a one-event comp to account-wide. The
  // trigger must snapshot and revoke.
  assert.match(FIX, /ADD COLUMN IF NOT EXISTS scoped_event_id_snapshot UUID/);
  assert.match(FIX, /REFERENCES public\.events\(event_id\) ON DELETE SET NULL/);
  assert.match(FIX, /revoked_at = COALESCE\(revoked_at, NOW\(\)\)/);
  assert.match(FIX, /BEFORE DELETE ON public\.events/);
});

test('the rule lives in ONE place — the app layer only calls the RPC', () => {
  // Before this fix the rule existed in SQL and in TypeScript, and for a day
  // the two disagreed about which was live. A second copy here is the defect.
  const mod = readFileSync(join(process.cwd(), 'lib', 'papic-free-grant.ts'), 'utf8');
  assert.match(mod, /rpc\('papic_claim_free_pool'/, 'the module must call the single decision site');
  for (const gone of ['hasPriorPapicEvent', 'resolveFreeGrant', 'freePapicGrantRow']) {
    assert.ok(!mod.includes(gone), `${gone} is a second copy of the rule — it must not come back`);
  }
  assert.equal(PAPIC_FREE_GRANT_SOURCE, 'free_grant');
});
