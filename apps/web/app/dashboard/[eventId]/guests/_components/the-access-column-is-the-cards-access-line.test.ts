/**
 * GUARD — the Guest list's ACCESS column is the guest card's Access line, on
 * every guest row (owner 2026-09-28: co-hosts come from the guest list — any
 * co-host picks a guest's Access, None · Co-host · Limited helper, and it goes
 * live once that guest has joined; "if there are choices … drop down menu").
 *
 * What it holds, each as a property of the source rather than a phrasing:
 *   1. BOTH row shapes draw it — the desktop table row and the phone list row —
 *      and the header declares the column, so the table stays one cell per head.
 *   2. It is NOT a second mechanism: the cell (`guest-access-cell.tsx`) calls
 *      the SAME server action the card's line calls (`setGuestAccess`), draws
 *      the SAME PickMenu, and reads the SAME vocabulary (`ACCESS_LEVEL_LABEL`)
 *      — one writer, one dropdown, one set of words.
 *   3. The creator and a celebrant co-host are FIXED: the dropdown is never
 *      drawn for a locked state. Only a co-host (`canManage`) gets a dropdown.
 *   4. One guest at a time: no `guest_ids[]`, no "Part of the host" — the bulk
 *      picker the owner retired stays retired.
 *   5. The "+Co-host" tag that used to trail the role is gone — the column
 *      says it now, so it is not said twice.
 *   6. The page reads every guest's Access ONCE (`loadGuestAccessMap`) and hands
 *      the list the couple gate it already resolved (`viewer.isCouple`) — no
 *      per-row read, no second gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const ROSTER = read('guest-list-multiselect.tsx');
const CELL = read('guest-access-cell.tsx');
const CARD_LINE = read('guest-access-control.tsx');
const PAGE = read('..', 'page.tsx');

/** The BODY of a named function (walks past the destructured params first). */
function bodyOf(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, `${name} is gone — this guard is pinning a ghost`);
  let parens = 0;
  let afterParams = -1;
  for (let i = src.indexOf('(', at); i < src.length; i += 1) {
    if (src[i] === '(') parens += 1;
    else if (src[i] === ')' && --parens === 0) {
      afterParams = i;
      break;
    }
  }
  const open = src.indexOf('{', afterParams);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('both row shapes draw the Access control, and the header declares its column', () => {
  for (const row of ['DesktopRow', 'MobileListRow']) {
    const n = (bodyOf(ROSTER, row).match(/<RowAccess\b/g) ?? []).length;
    assert.equal(n, 1, `${row} draws ${n} Access controls — every guest row needs exactly one`);
  }
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  assert.match(head, /<th className="[^"]*"[^>]*>\s*<span className="block truncate">Access<\/span>/, 'the table has no Access column header');
});

test('the cell is the card’s Access line in a row’s width — one action, one dropdown, one vocabulary', () => {
  assert.match(ROSTER, /import \{ GuestAccessCell \} from '\.\/guest-access-cell';/);
  for (const src of [CELL, CARD_LINE]) {
    assert.match(src, /import \{ setGuestAccess \} from '\.\.\/\[guestId\]\/access-actions';/, 'a second writer of the seat');
    assert.match(src, /import \{ PickMenu[^}]*\} from '@\/app\/dashboard\/\[eventId\]\/website\/editor\/_components\/pick-menu';/, 'not the shared PickMenu');
    assert.match(src, /\bACCESS_LEVEL_LABEL\b/, 'its own words for the three levels');
  }
  const cell = bodyOf(CELL, 'GuestAccessCell');
  assert.ok(cell.includes('setGuestAccess(eventId, guestId, level)'), 'the cell no longer calls the card’s action');
  assert.equal((CELL.match(/\.from\(/g) ?? []).length, 0, 'the cell reads the database itself');
  assert.doesNotMatch(CELL, /['"]use server['"]/, 'the cell grew its own server action');
  // PickMenu matches `value` against option KEYS, not labels (the card's own trap).
  assert.match(cell, /value=\{shown\.level\}/);
  assert.doesNotMatch(cell, /value=\{ACCESS_LEVEL_LABEL\[/);
});

test('a locked state is fixed, and only a co-host gets the dropdown', () => {
  const cell = bodyOf(CELL, 'GuestAccessCell');
  const guardAt = cell.search(/if \(!canManage \|\| shown\.lock\)/);
  const pickAt = cell.indexOf('<PickMenu');
  assert.notEqual(guardAt, -1, 'the cell no longer fixes a locked or read-only state');
  assert.ok(guardAt < pickAt, 'the dropdown is drawn before the lock can stop it');
  assert.match(PAGE, /canManageAccess=\{viewer\.isCouple\}/, 'the page does not hand the list the couple gate it resolved');
});

test('one guest at a time — the retired bulk picker stays retired', () => {
  assert.doesNotMatch(CELL, /guest_ids|Part of the host/);
  assert.doesNotMatch(ROSTER, /Part of the host/);
  assert.doesNotMatch(ROSTER, /name="access"|setGuestAccess/, 'the roster posts Access itself instead of through the cell');
});

test('the "+Co-host" tag that trailed the role is gone — the column says it once', () => {
  assert.doesNotMatch(ROSTER, /data-guest-access-tag|GuestAccessTagContext|accessTagByGuest/);
  assert.doesNotMatch(bodyOf(ROSTER, 'RoleTexts'), /access/i, 'RoleTexts still draws an access tag');
});

test('the page reads every guest’s Access once and hands the list the map', () => {
  assert.equal((PAGE.match(/loadGuestAccessMap\(/g) ?? []).length, 1, 'the page reads Access more than once');
  assert.match(PAGE, /<GuestListMultiselect[\s\S]*?\baccessByGuest=\{accessByGuest\}/, 'the list is not handed the Access map');
  assert.doesNotMatch(PAGE, /accessTagByGuest/, 'the page still builds the retired tag map');
});
