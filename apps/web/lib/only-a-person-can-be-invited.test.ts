/**
 * Only a PERSON can be invited from your people (owner 2026-09-30: *"business
 * and pets and gadgets are not people. so not allowed to be invited"*).
 *
 * A loved one (alaga) is offered on "Add from your people" only when its
 * `dependent_kind` is 'person'. Measured on prod the day this landed: the one
 * loved one in the database was a business.
 *
 * Sabotage: drop the kind check in `isInvitableRosterEntry`, or drop the call in
 * `people-you-can-invite.ts`, or stop the roster carrying `dependentKind`, and
 * this fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isInvitableRosterEntry } from './people-you-can-invite-core';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('a loved one is invitable only when it is a person', () => {
  assert.equal(isInvitableRosterEntry({ kind: 'alaga', dependentKind: 'person' }), true);
  for (const k of ['pet', 'business', 'item', 'other']) {
    assert.equal(isInvitableRosterEntry({ kind: 'alaga', dependentKind: k }), false, `a ${k} was offered as a guest`);
  }
  // Unknown kind fails closed.
  assert.equal(isInvitableRosterEntry({ kind: 'alaga', dependentKind: null }), false);
  assert.equal(isInvitableRosterEntry({ kind: 'alaga' }), false);
});

test('a connection is always a person and stays invitable', () => {
  assert.equal(isInvitableRosterEntry({ kind: 'connection' }), true);
  assert.equal(isInvitableRosterEntry({ kind: 'connection', dependentKind: null }), true);
});

test('the People source applies the rule, and the roster carries the kind', () => {
  const invite = src('people-you-can-invite.ts');
  assert.match(invite, /for \(const p of roster\.people\) \{\s*if \(!isInvitableRosterEntry\(p\)\) continue;/, 'the People source offers every loved one again');
  const roster = src('people-roster.ts');
  assert.match(roster, /kind: 'alaga',[\s\S]{0,200}dependentKind: d\.dependent_kind,/, 'alaga rows no longer carry dependent_kind, so the filter would drop every one');
});
