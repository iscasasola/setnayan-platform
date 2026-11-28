/**
 * The Papic free-pool SQL — what stays now that the app no longer grants it.
 *
 * 🎁 UPDATED 27 Nov 2026, NOT DELETED. The free first-event grant is retired
 * (owner 16 Nov 2026, DECISION_LOG "Free 50 Papic credits REMOVED"): the app's
 * caller (`lib/papic-free-grant.ts`) and its readers (`fetchPapicFreeGrantPoints`
 * and the 50 fallback) are gone, so the tests that pinned them are replaced by
 * the last test below. The SQL is kept on purpose — no migration in this change,
 * no clawback of credits already granted, and erasure coverage reads
 * `papic_free_grant_claims` — so the drift guards on that SQL stay exactly as
 * they were.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), '..', '..', 'supabase', 'migrations');
const migrationFile = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.includes('papic_free_pool_grant_arm'))
  .sort()
  .pop();
if (!migrationFile) throw new Error('papic_free_pool_grant_arm migration not found');
const MIGRATION = join(MIGRATIONS_DIR, migrationFile);

test('DRIFT GUARD — the migration keeps the once-per-event index PARTIAL', () => {
  // A plain unique on (event_id, source) would also cap topup_order and
  // camera_grant at one row per event, but Pool top-ups are repeatable and
  // Papic One is sold per camera — those legitimately stack. Only the free
  // grant is once-per-event, so the predicate is load-bearing.
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*?papic_event_point_grants \(event_id\)\s*\n\s*WHERE source = 'free_grant'/);
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

test('the app no longer calls the RPC — the grant has no TypeScript caller left', () => {
  // Before 27 Nov 2026 this asserted the module called `papic_claim_free_pool` as the one decision site. The grant
  // is retired, so the module is gone; the only caller left is the `event_members` trigger, which grants nothing
  // while `papic_event_pool_config.free_grant_points` is 0 (owner, 28 Nov).
  assert.equal(existsSync(join(process.cwd(), 'lib', 'papic-free-grant.ts')), false, 'lib/papic-free-grant.ts is back');
  assert.match(FIX, /PERFORM public\.papic_claim_free_pool\(NEW\.event_id, NEW\.user_id\)/, 'premise: the trigger is the caller left');
  assert.match(FIX, /IF v_pts <= 0 THEN\s*RETURN;/, 'a 0 column must still arm nothing — that is what switches the grant off');
});
