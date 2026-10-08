/**
 * a-44px-tap-target-is-not-a-44px-ring.test.ts — what is left of it.
 *
 * It once held two defects found by opening the page: the dashed ellipse on
 * `AddToGroupControl` and `LockedChip`'s panel that contradicted its own
 * trigger. Both lived in `chip-editors.tsx`, which went with the retired
 * GuestListMultiselect (2026-10-09), so their tests went too. What survives is
 * the half that pins a LIVE file: `Popover` (overlay-primitives.tsx) takes a
 * caller-declared role instead of hardcoding `menu` — the guest card's Invite
 * menu and the People roster still mount it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERLAY = stripComments(readFileSync(join(HERE, 'overlay-primitives.tsx'), 'utf8'));

test('Popover lets its caller declare what kind of panel it is', () => {
  assert.ok(
    /role\?: 'menu' \| 'dialog'/.test(OVERLAY),
    'Popover must accept a role rather than hardcoding one',
  );
  assert.ok(
    /role=\{role\}/.test(OVERLAY),
    'the rendered panel must use the passed role',
  );
  assert.equal(
    /role="menu"/.test(OVERLAY),
    false,
    'a hardcoded menu role is what contradicted LockedChip',
  );
  assert.ok(
    /role = 'menu'/.test(OVERLAY),
    'menu stays the DEFAULT — every existing picker relies on it',
  );
});
