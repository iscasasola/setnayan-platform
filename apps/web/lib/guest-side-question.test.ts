/**
 * guest-side-question.test.ts — B3: the add-guest form is not always a wedding.
 *
 * PROVES BOTH DIRECTIONS, because only one of them is the new one and the other
 * is the one that matters most (weddings are the majority of real events):
 *   1. a WEDDING still requires a side, and still refuses without one;
 *   2. a non-wedding (simple / generic / wake→generic) saves WITHOUT one, at
 *      the same value /guests/quick has always written.
 *
 * The pure decision is EXECUTED here. The two `server-only` callers can only be
 * read, so the source guards below are anchored on the exact strings a
 * regression would have to remove: the `hasSides` gate around the Side select,
 * and the action's call into resolveSubmittedSide.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  SIDELESS_SIDE,
  eventHasSides,
  resolveSubmittedSide,
} from './guest-side-question';
import {
  GENERIC_ROLE_SET,
  MUSLIM_ROLE_SET,
  SIMPLE_ROLE_SET,
  WEDDING_ROLE_SET,
  resolveRoleSet,
} from './role-sets';

// --- Direction 1: a wedding is UNCHANGED ----------------------------------

test('a wedding has sides, and both wedding role sets agree', () => {
  assert.equal(eventHasSides(WEDDING_ROLE_SET), true);
  assert.equal(eventHasSides(MUSLIM_ROLE_SET), true);
});

test('a wedding still REFUSES a guest with no side', () => {
  for (const rs of [WEDDING_ROLE_SET, MUSLIM_ROLE_SET]) {
    assert.deepEqual(resolveSubmittedSide(rs, ''), {
      ok: false,
      error: 'missing_side',
    });
    assert.deepEqual(resolveSubmittedSide(rs, null), {
      ok: false,
      error: 'missing_side',
    });
    // A junk value is a refusal too — never silently coerced to 'both'.
    assert.deepEqual(resolveSubmittedSide(rs, 'neither'), {
      ok: false,
      error: 'missing_side',
    });
  }
});

test('a wedding keeps every side the host picks', () => {
  for (const v of ['bride', 'groom', 'both'] as const) {
    assert.deepEqual(resolveSubmittedSide(WEDDING_ROLE_SET, v), {
      ok: true,
      side: v,
    });
  }
});

// --- Direction 2: a non-wedding does not ask ------------------------------

test('simple / generic events have no sides', () => {
  assert.equal(eventHasSides(SIMPLE_ROLE_SET), false);
  assert.equal(eventHasSides(GENERIC_ROLE_SET), false);
  // `wake` carries role_set_key = NULL in prod → degrades to generic.
  assert.equal(eventHasSides(resolveRoleSet(null)), false);
  assert.equal(eventHasSides(resolveRoleSet('generic')), false);
  assert.equal(eventHasSides(resolveRoleSet('simple')), false);
});

test('a non-wedding SAVES with no side, at quick-add’s value', () => {
  for (const rs of [SIMPLE_ROLE_SET, GENERIC_ROLE_SET]) {
    assert.deepEqual(resolveSubmittedSide(rs, ''), {
      ok: true,
      side: SIDELESS_SIDE,
    });
    assert.deepEqual(resolveSubmittedSide(rs, null), {
      ok: true,
      side: SIDELESS_SIDE,
    });
    assert.deepEqual(resolveSubmittedSide(rs, undefined), {
      ok: true,
      side: SIDELESS_SIDE,
    });
  }
  // The stored value is the one /guests/quick has always written.
  assert.equal(SIDELESS_SIDE, 'both');
});

test('a sideless event still honours a side that arrives anyway', () => {
  // e.g. a row whose event changed type after the fact — never overwrite a
  // real choice with the default.
  assert.deepEqual(resolveSubmittedSide(SIMPLE_ROLE_SET, 'bride'), {
    ok: true,
    side: 'bride',
  });
});

// --- Source guards: the callers actually use the decision -----------------

const HERE = path.dirname(new URL(import.meta.url).pathname);
const NEW_GUEST = path.join(HERE, '..', 'app', 'dashboard', '[eventId]', 'guests', 'new');

function read(file: string): string {
  return readFileSync(path.join(NEW_GUEST, file), 'utf8');
}

test('the add-guest FORM renders the Side select only behind the hasSides gate', () => {
  const src = read('page.tsx');
  const mounts = [...src.matchAll(/id="side"/g)];
  assert.equal(mounts.length, 1, 'expected exactly one Side select mount');
  const before = src.slice(0, mounts[0]!.index!);
  const gate = before.lastIndexOf('{hasSides ? (');
  assert.notEqual(gate, -1, 'Side select is not wrapped in a hasSides gate');
  // …and the gate must be the IMMEDIATE wrapper, not some earlier one.
  assert.ok(
    mounts[0]!.index! - gate < 200,
    'the nearest hasSides gate is too far from the Side select to be its wrapper',
  );
  assert.ok(
    src.includes("eventHasSides") && src.includes('guest-side-question'),
    'the page must derive hasSides from the shared decision, not a local list',
  );
});

test('the add-guest ACTION resolves the side through the shared decision', () => {
  const src = read('actions.ts');
  assert.ok(
    src.includes('resolveSubmittedSide(roleSet, submittedSide)'),
    'the action must call resolveSubmittedSide with the event’s role set',
  );
  // The old unconditional refusal must be gone — it is what blocked every
  // non-wedding event type.
  assert.ok(
    !/SIDE_VALUES\.includes\(side\)/.test(src),
    'the unconditional side check is back',
  );
});
