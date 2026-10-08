/**
 * GUARD — Access is shown, never set, wherever the guest card carries it.
 *
 * It began (owner 2026-09-28) as a guard on the Guest list's ACCESS column, the
 * roster cell `GuestAccessCell`. That column went (owner 2026-10-07: "remove
 * access column since the access will be inside event details") and the cell
 * went with the retired GuestListMultiselect (2026-10-09), together with the
 * tests that pinned its row shapes, its co-host-only door and its bulk picker.
 * What still holds, for the LIVE card and screen:
 *   1. It SHOWS, it does not set (owner 2026-10-03, "People with access": access
 *      is set in ONE place, Event Details › People with access; other places
 *      show it and link there). The card's line never calls `setGuestAccess`
 *      or draws a dropdown; it reads the shared vocabulary and links to the one
 *      home.
 *   2. The Guest list shows no Access at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const CARD_LINE = read('guest-access-control.tsx');
const PAGE = read('..', 'page.tsx');

test('the card’s line SHOWS Access and links to its one home — it never sets it', () => {
  for (const [name, src] of [['the card line', CARD_LINE]] as const) {
    assert.doesNotMatch(src, /setGuestAccess/, `${name} sets Access again — People with access is its one home`);
    assert.doesNotMatch(src, /<PickMenu\b/, `${name} draws a dropdown again — it only shows the word`);
    // `accessWordFor` is ACCESS_LEVEL_LABEL plus the creator's "Host" (owner 2026-10-04).
    assert.match(src, /\baccessWordFor\(/, `${name} uses its own words for the three levels`);
  }
  assert.match(CARD_LINE, /<ChangeAccessLink\b/, 'the card line lost its door to People with access');
  // The ONE writer: People with access calls the action the roster cell used to.
  const SECTION = read('..', '..', 'details', '_components', 'people-with-access.tsx');
  assert.match(SECTION, /setGuestAccess\(eventId, guestId, next\)/, 'People with access no longer sets a guest’s Access');
});

test('the Guest list shows NO access at all (owner 2026-10-07: "remove access column since the access will be inside event details")', () => {
  // Maker PR 4f: Access lives in Event Details › People with access, and on the
  // guest's card. The list neither reads it nor draws it.
  assert.doesNotMatch(PAGE, /loadGuestAccessMap\(|accessByGuest/, 'the Guest list page reads Access for the list again');
  const list = PAGE.slice(PAGE.indexOf('<GuestsScreen'), PAGE.indexOf('/>', PAGE.indexOf('<GuestsScreen')));
  assert.doesNotMatch(list, /ccess/, 'the list is handed Access again');
  const SCREEN = read('guests-screen.tsx');
  assert.doesNotMatch(SCREEN, /GuestAccessCell|accessWordFor|GuestAccessState|data-row-access/, 'the list draws an Access word again');
  assert.doesNotMatch(PAGE, /accessTagByGuest/, 'the page still builds the retired tag map');
});
