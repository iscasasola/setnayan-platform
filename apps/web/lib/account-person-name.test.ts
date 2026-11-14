/**
 * account-person-name.test.ts — a group names a person by their account's own name, never "Member" while a name
 * exists, never with a stray dash (walk 13 Nov 2026, P1 "both members are labelled Member").
 *
 * SABOTAGE: read display_name only again → the first-name case is RED; join with " — " → the dash case is RED;
 * a group read selecting `user_id, display_name` again → the source case is RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accountPersonName } from '@/lib/account-person-name';
import { stripComments } from '@/lib/strip-comments';

test('display name first; else first + last; else null', () => {
  assert.equal(accountPersonName({ display_name: 'Ana Reyes', first_name: 'X', last_name: 'Y' }), 'Ana Reyes');
  assert.equal(accountPersonName({ display_name: '  ', first_name: 'Ana', last_name: 'Reyes' }), 'Ana Reyes');
  assert.equal(accountPersonName({ display_name: null, first_name: 'Ana', last_name: '' }), 'Ana', 'no stray dash or space');
  assert.equal(accountPersonName({ display_name: null, first_name: null, last_name: null }), null);
  assert.equal(accountPersonName(null), null);
});

test('every group name read uses it', () => {
  const root = join(import.meta.dirname, '..');
  for (const rel of ['lib/communities.ts', 'lib/people-group-rows.ts']) {
    const src = stripComments(readFileSync(join(root, rel), 'utf8'));
    assert.doesNotMatch(src, /select\('user_id, display_name'\)/, `${rel} reads display_name only again`);
    assert.match(src, /accountPersonName\(r\)/, `${rel} does not name people through accountPersonName`);
  }
});
