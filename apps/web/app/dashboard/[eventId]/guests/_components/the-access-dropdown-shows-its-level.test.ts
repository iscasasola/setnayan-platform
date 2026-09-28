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
const SRC = stripComments(readFileSync(join(HERE, 'guest-access-control.tsx'), 'utf8'));

test('the Access dropdown passes the level KEY as PickMenu value', () => {
  const pick = SRC.slice(SRC.indexOf('<PickMenu'), SRC.indexOf('/>', SRC.indexOf('<PickMenu')));
  assert.ok(pick.length > 0, 'PickMenu not found in guest-access-control.tsx');
  assert.match(pick, /value=\{state\.level\}/, 'PickMenu value must be the level key');
  assert.doesNotMatch(pick, /value=\{LABELS\[/, 'a label as value matches no option key');
});
