/**
 * GUARD — the Guest list's ACCESS column is the guest card's Access line, on
 * every guest row (owner 2026-09-28: co-hosts come from the guest list — any
 * co-host picks a guest's Access, None · Co-host · Limited helper, and it goes
 * live once that guest has joined; "if there are choices … drop down menu").
 *
 * What it holds, each as a property of the source rather than a phrasing:
 *   1. BOTH row shapes draw it — the desktop table row and the phone list row —
 *      and the header declares the column, so the table stays one cell per head.
 *   2. It SHOWS, it does not set (owner 2026-10-03, "People with access": access
 *      is set in ONE place, Event Details › People with access; other places
 *      show it and link there). Neither the cell nor the card's line calls
 *      `setGuestAccess` or draws a dropdown; both read the SAME vocabulary
 *      (`ACCESS_LEVEL_LABEL`) and link to the one home.
 *   3. Only a co-host (`canManage`) gets the link; anyone else reads the word.
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
const ROSTER_COLUMNS_SRC = read('..', '..', '..', '..', '..', 'lib', 'roster-columns.ts');

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

test('both row shapes draw the Access control, and Access is a column any header can pick', () => {
  // Since 2026-09-30 (the full-width list) every cell comes through ONE switch,
  // RosterCell, which both row shapes draw — so Access is the same control on
  // a computer's column and on the phone's one slot.
  for (const row of ['DesktopRow', 'MobileListRow']) {
    assert.match(bodyOf(ROSTER, row), /<RosterCell\b/, `${row} no longer draws its cells through RosterCell`);
  }
  const cell = bodyOf(ROSTER, 'RosterCell');
  const n = (cell.match(/<RowAccess\b/g) ?? []).length;
  assert.equal(n, 1, `RosterCell draws ${n} Access controls — the Access column needs exactly one`);
  assert.match(cell, /case 'access':\s*return <RowAccess\b/, 'the Access column does not draw RowAccess');
  assert.match(ROSTER_COLUMNS_SRC, /access: 'Access'/, 'Access is no longer a column a header can pick');
});

test('the cell and the card’s line SHOW Access and link to its one home — they never set it', () => {
  assert.match(ROSTER, /import \{ GuestAccessCell \} from '\.\/guest-access-cell';/);
  for (const [name, src] of [['the cell', CELL], ['the card line', CARD_LINE]] as const) {
    assert.doesNotMatch(src, /setGuestAccess/, `${name} sets Access again — People with access is its one home`);
    assert.doesNotMatch(src, /<PickMenu\b/, `${name} draws a dropdown again — it only shows the word`);
    // `accessWordFor` is ACCESS_LEVEL_LABEL plus the creator's "Host" (owner 2026-10-04).
    assert.match(src, /\baccessWordFor\(/, `${name} uses its own words for the three levels`);
  }
  assert.match(CELL, /peopleWithAccessHref\(eventId\)/, 'the cell lost its door to People with access');
  assert.match(CARD_LINE, /<ChangeAccessLink\b/, 'the card line lost its door to People with access');
  assert.equal((CELL.match(/\.from\(/g) ?? []).length, 0, 'the cell reads the database itself');
  assert.doesNotMatch(CELL, /['"]use server['"]/, 'the cell grew its own server action');
  // The ONE writer: People with access calls the action the cell used to.
  const SECTION = read('..', '..', 'details', '_components', 'people-with-access.tsx');
  assert.match(SECTION, /setGuestAccess\(eventId, guestId, next\)/, 'People with access no longer sets a guest’s Access');
});

test('only a co-host gets the door; everyone else reads the word', () => {
  const cell = bodyOf(CELL, 'GuestAccessCell');
  const guardAt = cell.search(/if \(!canManage\)/);
  const linkAt = cell.indexOf('<Link');
  assert.notEqual(guardAt, -1, 'the cell no longer keeps a read-only state');
  assert.ok(guardAt < linkAt, 'the link is drawn before the read-only guard can stop it');
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
  // Maker PR 4f: the list is GuestsScreen now; the word sits on each row.
  assert.match(PAGE, /<GuestsScreen[\s\S]*?\baccessByGuest=\{accessByGuest\}/, 'the list is not handed the Access map');
  const SCREEN = read('guests-screen.tsx');
  assert.match(SCREEN, /<GuestAccessCell\b/, 'the list no longer shows each guest’s Access');
  assert.doesNotMatch(PAGE, /accessTagByGuest/, 'the page still builds the retired tag map');
});
