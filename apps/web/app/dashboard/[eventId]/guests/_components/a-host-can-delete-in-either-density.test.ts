/**
 * a-host-can-delete-in-either-density.test.ts — what is left of it.
 *
 * It began as a guard that the phone roster's compact list kept its
 * swipe-to-delete after the density toggle. The density toggle, the compact
 * list and `SwipeToDelete` all went with the retired GuestListMultiselect
 * (2026-10-09), and so did the tests that pinned them. What still holds for the
 * live screen (`guests-screen.tsx`) is the half that was never about density:
 *
 *  · there is ONE removal path (`useGuestRemoval` → `bulkSoftDeleteGuestsForUndo`),
 *    not one per surface; and
 *  · the delete that cannot be undone (`bulkSoftDeleteGuests`, which released a
 *    seat without capturing it) no longer EXISTS and nothing here calls it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));

test('there is ONE removal path, not one per surface', () => {
  const hookRefs = SRC.match(/useGuestRemoval\(/g) ?? [];
  assert.ok(hookRefs.length >= 1, 'the screen no longer removes through useGuestRemoval');
  assert.match(SRC, /import \{[^}]*\buseGuestRemoval\b[^}]*\} from '\.\/guest-delete';/, 'the list grew its own delete hook again');
  const DELETE = stripComments(readFileSync(join(HERE, 'guest-delete.tsx'), 'utf8'));
  const callers = [SRC, DELETE, stripComments(readFileSync(join(HERE, 'guest-ticket-parts.tsx'), 'utf8'))]
    .map((src) => (src.match(/bulkSoftDeleteGuestsForUndo\(/g) ?? []).length)
    .reduce((a, b) => a + b, 0);
  assert.equal(
    callers,
    1,
    'the delete action must be called from exactly one place (the hook), found ' +
      `${callers} — a second caller is a second set of rules to drift`,
  );
  assert.match(DELETE, /export function useGuestRemoval\(/);
});

test('the delete that cannot be undone no longer EXISTS', () => {
  const ACTIONS = stripComments(readFileSync(join(HERE, '..', 'groups-actions.ts'), 'utf8'));
  assert.equal(
    /export async function bulkSoftDeleteGuests\s*\(/.test(ACTIONS),
    false,
    'the un-undoable delete is back. It releases the seat without capturing ' +
      'it, so any caller silently loses the guest’s chair — the asymmetry ' +
      'this change removed. Use bulkSoftDeleteGuestsForUndo.',
  );
  assert.ok(
    /export async function bulkSoftDeleteGuestsForUndo\s*\(/.test(ACTIONS),
    'the surviving action is gone too — this test is pinning a ghost',
  );
  assert.equal(/bulkSoftDeleteGuests\s*[.(]/.test(SRC), false, 'this page references the removed action in code');
});
