/**
 * the-access-dropdown-shows-its-level.test.ts — PickMenu's `value` is an option
 * KEY, never a label.
 *
 * The guest card's Access dropdown first shipped with `value={LABELS[level]}`.
 * PickMenu finds the current option by `o.key === value`, so a label matched
 * nothing: the button printed its screen-reader label instead of "Co-host" and
 * no option ever read as selected. No test saw it — the designer did, reading
 * the component while redrawing the owner's real screen (2026-09-28).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
// The Access dropdown MOVED 2026-10-03 to Event Details › People with access
// (owner: access has ONE home); the trap it fell into moved with it.
const SRC = stripComments(readFileSync(join(HERE, '..', '..', 'details', '_components', 'people-with-access.tsx'), 'utf8'));

test('the Access dropdown passes the level KEY as PickMenu value', () => {
  const fnAt = SRC.indexOf('function AccessPick(');
  const at = SRC.indexOf('<PickMenu', fnAt);
  const pick = SRC.slice(at, SRC.indexOf('/>', at));
  assert.ok(fnAt > 0 && pick.length > 0, 'the Access PickMenu not found in people-with-access.tsx');
  assert.match(pick, /value=\{level\}/, 'PickMenu value must be the level key');
  assert.doesNotMatch(pick, /value=\{LABELS\[/, 'a label as value matches no option key');
});
