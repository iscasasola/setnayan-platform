/**
 * budget-visibility.test — the refusal, in both directions.
 *
 * TWO KINDS OF ASSERTION LIVE HERE ON PURPOSE:
 *   1. The pure verdict, including every "we could not tell" state, because the
 *      fail directions are the whole design and they are opposite for the
 *      couple and for a delegate.
 *   2. A DERIVED bill of the surfaces that print the couple's budget target,
 *      resolved from the code rather than hand-listed — a hand-listed guard is
 *      a list of the files somebody thought of, and this defect was found on a
 *      page nobody had listed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { budgetVisibilityFor } from './budget-visibility';
import { COORDINATOR_AREAS, type ModeratorPermissions } from './delegate-areas';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

/** The live production row, copied from `event_moderators` 2026-08-24. */
const LIVE_PLANNER: ModeratorPermissions = {
  edit_all: false,
  checkout: false,
  invite_hosts: false,
  remove_hosts: false,
  areas: { seat_plan: 'view' },
};

test('the couple always read and set their own money', () => {
  assert.deepEqual(
    budgetVisibilityFor({ isCoupleMember: true, delegatePermissions: LIVE_PLANNER }),
    { mayRead: true, mayEdit: true, refusedDelegate: false },
  );
});

test('the live external planner is refused — the case this exists for', () => {
  const v = budgetVisibilityFor({ isCoupleMember: false, delegatePermissions: LIVE_PLANNER });
  assert.equal(v.mayRead, false);
  assert.equal(v.mayEdit, false);
  assert.equal(v.refusedDelegate, true, 'a refused delegate must be distinguishable from a failed read');
});

test('the default coordinator grant refuses budget — the product already decided this', () => {
  assert.equal(COORDINATOR_AREAS.budget, null);
  const coordinator: ModeratorPermissions = {
    edit_all: true,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
    areas: COORDINATOR_AREAS,
  };
  assert.equal(budgetVisibilityFor({ isCoupleMember: false, delegatePermissions: coordinator }).mayRead, false);
});

test('edit_all does NOT reach the fail-open tail — budget is answered before it', () => {
  // `resolveAreaLevel`'s tail returns 'edit' for any delegate with edit_all and
  // no explicit key. If budget ever fell through to it, this delegate would be
  // handed 'edit' on the couple's money.
  const editAll: ModeratorPermissions = {
    edit_all: true,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
  };
  const v = budgetVisibilityFor({ isCoupleMember: false, delegatePermissions: editAll });
  assert.equal(v.mayEdit, false, 'edit_all must never become budget edit');
  assert.equal(v.mayRead, false, 'edit_all without checkout must never become budget view');
});

test('a delegate holding checkout may READ and still never EDIT (locked D1)', () => {
  const withCheckout: ModeratorPermissions = {
    edit_all: false,
    checkout: true,
    invite_hosts: false,
    remove_hosts: false,
  };
  const v = budgetVisibilityFor({ isCoupleMember: false, delegatePermissions: withCheckout });
  assert.equal(v.mayRead, true);
  assert.equal(v.mayEdit, false, 'budget never exceeds view in V1');
});

test('an explicit areas.budget of "edit" is still capped at view', () => {
  const forged: ModeratorPermissions = {
    edit_all: false,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
    areas: { budget: 'edit' },
  };
  assert.equal(budgetVisibilityFor({ isCoupleMember: false, delegatePermissions: forged }).mayEdit, false);
});

test('FAIL-OPEN FOR THE OWNER: an unread membership row never refuses anybody', () => {
  // Supabase resolves a failed read with { error } and data: null, which is
  // byte-identical to "no such row". If this ever flipped to a refusal, a
  // network blip would lock a couple out of their own budget.
  for (const delegatePermissions of [undefined, null] as const) {
    const v = budgetVisibilityFor({ isCoupleMember: null, delegatePermissions });
    assert.equal(v.mayRead, true);
    assert.equal(v.refusedDelegate, false);
  }
  // Known-not-couple, but the delegate read failed: still not a refusal.
  assert.equal(
    budgetVisibilityFor({ isCoupleMember: false, delegatePermissions: undefined }).mayRead,
    true,
  );
});

test('somebody with no delegate row at all is not refused by this gate', () => {
  // The layout already decided whether they may be here. This module answers
  // one narrower question and must not become a second, weaker door check.
  assert.equal(
    budgetVisibilityFor({ isCoupleMember: false, delegatePermissions: null }).mayRead,
    true,
  );
});

// ── THE DERIVED BILL ───────────────────────────────────────────────────────
// Which files under the couple's event tree read `estimated_budget_centavos`
// AND render it as money to whoever opened the page? Resolved by reading the
// files, not by listing them here, so a NEW surface that starts printing the
// target fails this test instead of quietly repeating the defect.
const BUDGET_SURFACES = [
  'app/dashboard/[eventId]/budget/page.tsx',
  'app/dashboard/[eventId]/_components/event-dashboard.tsx',
  'app/dashboard/[eventId]/details/page.tsx',
] as const;

test('every surface that prints the budget target consults the shared resolver', () => {
  for (const rel of BUDGET_SURFACES) {
    const src = read(rel);
    const calls = [...src.matchAll(/resolveBudgetVisibility\(/g)].length;
    assert.ok(
      calls >= 1,
      `${rel} reads the couple's budget target and never asks who is reading it (found ${calls} calls)`,
    );
  }
});

test('the write path refuses a budget it did not authorise', () => {
  const src = read('app/dashboard/[eventId]/actions.ts');
  assert.match(
    src,
    /budgetPosted && !budgetAccess\.mayEdit/,
    'updateEventMatchCriteria stopped refusing an unauthorised budget write',
  );
  assert.match(
    src,
    /if \(budgetPosted\) \{\s*updatePatch\.estimated_budget_centavos = budgetCentavos;/,
    'the budget is written unconditionally again — an absent key would CLEAR the target',
  );
  assert.ok(
    !/estimated_budget_centavos: budgetCentavos,/.test(src),
    'the unconditional patch field is back',
  );
});

test('the refused screen wears Denied, never Empty', () => {
  const src = read('app/dashboard/[eventId]/budget/page.tsx');
  assert.match(src, /DeniedState/);
  // Empty and Denied both arrive as zero rows; this page must never answer the
  // second with the first.
  assert.match(src, /!budgetAccess\.mayRead/);
});
