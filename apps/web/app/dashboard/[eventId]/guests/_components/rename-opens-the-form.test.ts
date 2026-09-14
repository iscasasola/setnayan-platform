/**
 * "Rename / Side" did NOTHING, and the reason is invisible in a screenshot:
 * the handler set the edit state and then immediately overwrote it.
 *
 *   onEdit();    // openKebabId = `edit:<id>`
 *   onToggle();  // updater reads `edit:<id>`, finds it !== `<id>`, sets `<id>`
 *
 * Both write the SAME piece of state, so the second call cancelled the first,
 * the menu reopened, and `EditGroupForm` — which renders on
 * `openKebabId.startsWith('edit:')` — never mounted. No error, no console
 * warning, a button that looks fine and does nothing.
 *
 * 🔑 THE GENERAL SHAPE: two handlers that each own the same state, called in
 * sequence. React batches them, so the second reads what the first wrote —
 * which is exactly what makes "call both to be safe" wrong here.
 *
 * This is a SOURCE guard because the bug lives in a click handler's
 * composition, not in any value a pure function returns.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(
  readFileSync(
    join(process.cwd(), 'app/dashboard/[eventId]/guests/_components/groups-sidebar.tsx'),
    'utf8',
  ),
);

/** The JSX element containing a given label, scanned backwards to its `<button`. */
function buttonAround(label: string): string {
  const at = SRC.indexOf(label);
  assert.notEqual(at, -1, `"${label}" is gone from groups-sidebar.tsx`);
  const open = SRC.lastIndexOf('<button', at);
  assert.notEqual(open, -1, `no <button> wraps "${label}"`);
  return SRC.slice(open, at);
}

test('THE REGRESSION: Rename opens the edit form and does not re-toggle the menu', () => {
  const btn = buttonAround('Rename / Side');
  assert.match(btn, /onEdit/, 'Rename must call onEdit');
  assert.ok(
    !/onToggle/.test(btn),
    'Rename must NOT call onToggle — it writes the same state and cancels the rename',
  );
});

test('the edit form is still mounted from the edit: sentinel', () => {
  // If this sentinel is renamed, the guard above keeps passing while the form
  // stops rendering for a different reason.
  assert.match(SRC, /startsWith\('edit:'\)/, "the `edit:` sentinel is how the form opens");
  assert.match(SRC, /<EditGroupForm/, 'EditGroupForm must still be mounted');
});

test('the kebab closes by construction, not by a second call', () => {
  // isOpen is an equality against the raw group id, so writing `edit:<id>`
  // closes the menu on its own. This is what makes dropping onToggle safe.
  assert.match(
    SRC,
    /isOpen=\{openKebabId === g\.group_id\}/,
    'the menu must still open on an exact id match, or dropping onToggle would leave it open',
  );
});
