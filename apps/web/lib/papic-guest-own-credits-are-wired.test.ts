/**
 * A GUEST'S OWN CREDITS ARE HERS — the seams the database test cannot reach.
 *
 * `tests/db/papic-guest-own-credits-are-hers.db.test.ts` proves the GATE stops
 * eating a guest's own money. It cannot prove that the number she READS on the
 * pill came from the same rule, and that gap is not hypothetical on this exact
 * surface: the browser once mirrored only half of `v_unlimited` and enforced a
 * 150 the database was not applying anywhere.
 *
 * 🔑 A COUNTER THAT DISAGREES WITH THE GATE IS ITS OWN DEFECT. A guest who
 * bought 50 of her own and is capped at 20 has spent 50 credits and NONE of the
 * couple's. If the pill kept metering her total she would watch it sit at zero
 * while the shutter carried on working — the same "the measurement never
 * reached the render" disease this programme has already paid for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

// ONE comment stripper in this repo (lib/strip-comments.ts) — a hand-rolled
// regex here is exactly the defect class scripts/lint-one-comment-stripper.mjs
// exists to stop.
const src = stripComments(readFileSync(join(import.meta.dirname, 'papic-guest.ts'), 'utf8'));
const migration = readFileSync(
  join(
    import.meta.dirname,
    '..', '..', '..',
    'supabase', 'migrations', '20271185324597_a_guest_s_own_credits_are_hers.sql',
  ),
  'utf8',
);

test('the guest counter asks the DATABASE what the ceiling meters — it does not re-derive it', () => {
  assert.match(
    src,
    /rpc\('papic_guest_ceiling_spend'/,
    'fetchGuestQuota stopped reading papic_guest_ceiling_spend — the pill is back to metering ' +
      'every credit she has spent, including the ones she paid for herself',
  );
  assert.match(
    src,
    /guestCeiling !== null \? meteredCredits : used/,
    'the metered figure is no longer what a capped guest is shown',
  );
  assert.match(
    src,
    /guestCeiling - meteredCredits/,
    '`remaining` went back to the raw credit total, so a guest who bought her own shots ' +
      'would be shown a pill at zero while the gate kept saying yes',
  );
  // ⚠ THE SUBTRACTION MUST NOT BE WRITTEN HERE. Two copies of a money rule
  // always drift; that is the whole reason this is an RPC.
  assert.doesNotMatch(
    src,
    /usedCredits\s*-\s*(self|own|dedicated)/i,
    'the self-funded subtraction has been re-derived in TypeScript — it belongs in ' +
      'papic_guest_ceiling_spend, where the refusal reads it from',
  );
});

test('the fallback is the PRE-FIX figure, so an old database under-promises', () => {
  assert.match(
    src,
    /ceilingSpend \?\? usedCredits/,
    'a database that predates 20271185324597 must fall back to the raw credit total — ' +
      'that is what it displayed before and it is never LOWER than the truth',
  );
});

test('a missing function degrades quietly; anything else is logged', () => {
  const fn = src.slice(src.indexOf('async function readGuestCeilingSpend'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 3);
  assert.match(
    body,
    /isMissingRelationError\(error\)/,
    'an expected 42883 on a pre-migration database must be told apart from a real outage',
  );
  assert.match(
    body,
    /logQueryError\('readGuestCeilingSpend'/,
    'a genuine failure that is bound and thrown away states an absence nobody measured',
  );
});

// ══ THE MIGRATION'S OWN INVARIANTS, PINNED FROM OUTSIDE ═══════════════════

test('⛔ the funding source is never a parameter of the anon-callable writer', () => {
  const signature = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.papic_record_guest_capture'),
  );
  const params = signature.slice(0, signature.indexOf(')\nRETURNS JSONB'));
  assert.doesNotMatch(
    params,
    /p_(self_funded|is_mine|own_credits|funding)/,
    'papic_record_guest_capture grew a caller-supplied funding-source argument — anon holds ' +
      'EXECUTE on it, so that is one word past the couple’s ceiling entirely',
  );
  assert.match(
    params,
    /p_points_cost\s+INT DEFAULT 1/,
    'the signature moved — in PostgreSQL that is a NEW function, not a replacement, and two ' +
      'overloads make every named call 42725 (measured against prod, 20271184624871)',
  );
});

test('the gate still meters through the shared rule, and the ceiling is still asked first', () => {
  const fn = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.papic_record_guest_capture'),
  );
  assert.match(
    fn,
    /papic_guest_ceiling_spend\(p_guest_id, v_cost\)/,
    'the gate stopped subtracting her own credits — the defect this migration exists to fix',
  );
  // The couple's ceiling is asked BEFORE the platform's flat 150 and
  // independently of v_unlimited (owner: a bought Unlock pass is not permission
  // to walk through a limit the couple set on one guest).
  assert.ok(
    fn.indexOf('guest_spend_ceiling') < fn.indexOf("'reason', 'per_guest_credits'"),
    'the couple’s ceiling is no longer asked before the platform’s own 150',
  );
});
