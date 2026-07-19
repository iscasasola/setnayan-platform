/**
 * Flow suite for the capture-bar single-add core (T18 — orphan-groups on-failed-add).
 *
 * Drives `runAddSingleGuest` with hand-rolled fake dependencies (no mocking
 * library — the repo has none, and this core was extracted precisely so the
 * failure-after-fresh-group flow is drivable without a DB). The regression this
 * guards: when the guest insert FAILS after a `#group` was freshly minted, the
 * core must delete exactly that group — and never a pre-existing one. Delete the
 * compensation block from the core and the first test goes red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runAddSingleGuest, type AddSingleGuestDeps } from './add-single-guest-core';
import type { ParsedGuestDraft } from './guest-parse';
import type {
  QuickAddInput,
  QuickAddResult,
  QuickGroupResult,
} from '@/app/dashboard/[eventId]/guests/quick-add-actions';

const EVENT = 'evt-123';

const FINALIZED_ERROR = 'Your guest list is finalized — the guest count is locked.';

function draft(over: Partial<ParsedGuestDraft> = {}): ParsedGuestDraft {
  return {
    firstName: 'Ana',
    lastName: 'Cruz',
    side: 'both',
    plusOnes: 0,
    groups: [],
    roleHint: null,
    ...over,
  };
}

type Harness = {
  deps: AddSingleGuestDeps;
  deleted: Array<[string, string]>;
  attached: Array<[string, string]>;
  plusOnes: string[];
  revalidated: string[];
  addGuestCalls: QuickAddInput[];
};

/**
 * Deterministic fakes. `createGroup` maps by name:
 *   'NewGroup'  → fresh insert   (created:true,  id 'g-new')
 *   'NewGroup2' → fresh insert   (created:true,  id 'g-new-2')
 *   'Existing'  → find-or-create reuse (created:false, id 'g-existing')
 * Every side effect is recorded so the tests can assert on it.
 */
function makeHarness(
  addGuest: (eventId: string, input: QuickAddInput) => Promise<QuickAddResult>,
): Harness {
  const deleted: Array<[string, string]> = [];
  const attached: Array<[string, string]> = [];
  const plusOnes: string[] = [];
  const revalidated: string[] = [];
  const addGuestCalls: QuickAddInput[] = [];

  const deps: AddSingleGuestDeps = {
    createGroup: async (_eventId, name): Promise<QuickGroupResult> => {
      if (name === 'Existing') {
        return { ok: true, created: false, group: { group_id: 'g-existing', label: 'Existing' } };
      }
      if (name === 'NewGroup') {
        return { ok: true, created: true, group: { group_id: 'g-new', label: 'NewGroup' } };
      }
      if (name === 'NewGroup2') {
        return { ok: true, created: true, group: { group_id: 'g-new-2', label: 'NewGroup2' } };
      }
      return { ok: false, error: `unknown group ${name}` };
    },
    addGuest: async (eventId, input) => {
      addGuestCalls.push(input);
      return addGuest(eventId, input);
    },
    resolveOfferedRoles: async () => ['guest'],
    attachMembership: async (groupId, guestId) => {
      attached.push([groupId, guestId]);
    },
    setPlusOne: async (guestId) => {
      plusOnes.push(guestId);
    },
    deleteEmptyGroup: async (groupId, eventId) => {
      deleted.push([groupId, eventId]);
    },
    revalidate: (eventId) => {
      revalidated.push(eventId);
    },
  };

  return { deps, deleted, attached, plusOnes, revalidated, addGuestCalls };
}

const failFinalized = async (): Promise<QuickAddResult> => ({
  ok: false,
  error: FINALIZED_ERROR,
});

const succeed = (guestId: string) => async (): Promise<QuickAddResult> => ({
  ok: true,
  guest: {
    guest_id: guestId,
    first_name: 'Ana',
    last_name: 'Cruz',
    side: 'both',
    role: 'guest',
  },
});

test('failed add AFTER a fresh group is minted → deletes ONLY the fresh group', async () => {
  const h = makeHarness(failFinalized);

  // A pre-existing group FIRST (seeds quickAddGuest's group_id) then a freshly
  // minted one — the exact mixed case the created-flag must disambiguate.
  const res = await runAddSingleGuest(EVENT, draft({ groups: ['Existing', 'NewGroup'] }), h.deps);

  // The user sees the REAL add failure, never a cleanup error.
  assert.deepEqual(res, { ok: false, error: FINALIZED_ERROR });
  // Compensation deleted exactly the fresh group, exactly once — and NEVER the
  // pre-existing one (the whole point of the created flag).
  assert.deepEqual(h.deleted, [['g-new', EVENT]]);
  assert.equal(h.deleted.length, 1);
  assert.ok(!h.deleted.some(([gid]) => gid === 'g-existing'));
  // No memberships / plus-one writes on the failure path.
  assert.deepEqual(h.attached, []);
  assert.deepEqual(h.plusOnes, []);
  // Revalidated so the removed group doesn't linger in the Groups sidebar.
  assert.deepEqual(h.revalidated, [EVENT]);
});

test('failed add with ONLY a pre-existing group → never deletes it', async () => {
  const h = makeHarness(failFinalized);

  const res = await runAddSingleGuest(EVENT, draft({ groups: ['Existing'] }), h.deps);

  assert.deepEqual(res, { ok: false, error: FINALIZED_ERROR });
  // Nothing was freshly minted, so there is nothing to compensate — and the
  // pre-existing group is untouched.
  assert.deepEqual(h.deleted, []);
  // No fresh mint → no compensation revalidate.
  assert.deepEqual(h.revalidated, []);
});

test('failed add with two fresh groups → deletes both', async () => {
  const h = makeHarness(failFinalized);

  const res = await runAddSingleGuest(EVENT, draft({ groups: ['NewGroup', 'NewGroup2'] }), h.deps);

  assert.deepEqual(res, { ok: false, error: FINALIZED_ERROR });
  assert.deepEqual(h.deleted, [
    ['g-new', EVENT],
    ['g-new-2', EVENT],
  ]);
});

test('successful add → no deletes, memberships attached, plus-one set', async () => {
  const h = makeHarness(succeed('guest-1'));

  const res = await runAddSingleGuest(
    EVENT,
    draft({ groups: ['Existing', 'NewGroup'], plusOnes: 1 }),
    h.deps,
  );

  assert.deepEqual(res, {
    ok: true,
    guest: {
      guest_id: 'guest-1',
      first_name: 'Ana',
      last_name: 'Cruz',
      side: 'both',
      role: 'guest',
    },
  });
  // Never compensate on success.
  assert.deepEqual(h.deleted, []);
  // The FIRST group id is handed to quickAddGuest (it attaches group[0]); the
  // EXTRA group is attached here.
  assert.equal(h.addGuestCalls[0]?.group_id, 'g-existing');
  assert.deepEqual(h.attached, [['g-new', 'guest-1']]);
  // Plus-one permission applied.
  assert.deepEqual(h.plusOnes, ['guest-1']);
  assert.deepEqual(h.revalidated, [EVENT]);
});

test('missing last name → short-circuits before any group is minted', async () => {
  const h = makeHarness(failFinalized);

  const res = await runAddSingleGuest(EVENT, draft({ lastName: '', groups: ['NewGroup'] }), h.deps);

  assert.deepEqual(res, { ok: false, error: 'Add both a first and last name.' });
  // Never reached createGroup / addGuest / delete.
  assert.deepEqual(h.deleted, []);
  assert.deepEqual(h.addGuestCalls, []);
});
