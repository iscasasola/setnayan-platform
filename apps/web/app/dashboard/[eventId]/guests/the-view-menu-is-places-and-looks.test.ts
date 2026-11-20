/**
 * 🔒 THE VIEW MENU IS PLACES ON TOP, LOOKS AT THE THUMB (Guests redesign drawing § 8, owner 20 Nov "Yes, your picks").
 *
 *   · The top pill still reads where you are ("Seats · 2D") and opens THREE lines — Guests · Seats · March — each with
 *     its count; no List / 2D / 3D lines and no group headings inside it.
 *   · One round in the thumb row wears the current look and opens UPWARD: Guests List · Map, Seats List · 2D floor
 *     plan · 3D room. March has none. Seats draws it in its own row (through the lens) before its Show round.
 *   · A place opens on the look you used last; the March's "N walks" is its own count, told up — never guessed.
 *
 * Sabotage (each seen red, then restored): a `group:` put back on the place options → 1 · `opensUp: true` dropped → 2 ·
 * Seats' row without `lens.lookRound` → 2 · the place pick for Guests hard-wired to 'list' → 3 · the March's
 * `reportWalks` effect removed → 3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const SCREEN = read('_components/guests-screen.tsx');
const SEATS = read('../seating/_components/seating-editor.tsx');
const MARCH = read('../launch/_components/details-march.tsx');
const ROW = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', 'components', 'thumb-row.tsx'), 'utf8'));

test('1 · the pill lists the three places, each with its count, and still says where you are', () => {
  const at = SCREEN.indexOf('const pinMenuOptions: PickOption[] = [');
  const opts = SCREEN.slice(at, SCREEN.indexOf('];', at));
  assert.ok(at > 0, 'the place menu was not found');
  for (const k of ["key: 'guests'", "key: 'seats'", "key: 'march'"]) assert.ok(opts.includes(k), `the place menu lost ${k}`);
  assert.doesNotMatch(opts, /group:/, 'the place menu has group headings again');
  assert.doesNotMatch(opts, /seats:|guests:/, 'the looks are back inside the place menu');
  assert.match(opts, /placeCount\(stats\.total, 'guest', 'guests'\)/);
  assert.match(opts, /placeCount\(tables\.length, 'table', 'tables'\)/);
  assert.match(opts, /placeCount\(walkCount, 'walk', 'walks'\)/);
  assert.match(SCREEN, /const pinMenuValue = topOfView\(gview\);/, 'the ticked line is not the place you are in');
  assert.match(SCREEN, /buttonText=\{pinnedMenuWords\(gview, seatMode\)\}/, 'the pill no longer says the look too ("Seats · 2D")');
});

test('2 · one look round at the thumb, opening upward — on Guests, and on Seats through the lens', () => {
  assert.match(SCREEN, /mark: 'data-guests-look',\s*opensUp: true,/, 'the look round does not open upward');
  assert.match(SCREEN, /right=\{lookMenu \? \[lookMenu, \{ node: filterSheet \}\] : \[\{ node: filterSheet \}\]\}/, 'Guests › List has no look round');
  assert.match(SCREEN, /right=\{lookMenu \? \[lookMenu, arrangeMenu\] : \[arrangeMenu\]\}/, 'Guests › Map has no look round');
  assert.match(SCREEN, /lookRound: lookMenu,/, 'the lens does not carry the look round');
  assert.match(SEATS, /\.\.\.\(lens\.lookRound \? \[lens\.lookRound\] : \[\]\),\s*guestsFilterMenu\(\{\s*view: 'seats'/, 'Seats does not seat the look round before Show');
  assert.doesNotMatch(MARCH, /lookRound/, 'March grew a look round');
  assert.match(ROW, /opensUp=\{r\.opensUp\}/, 'the thumb row drops the menu’s opensUp');
});

test('3 · a place opens on its last look, and the March tells its own walk count', () => {
  assert.match(SCREEN, /if \(v === 'list' \|\| v === 'map'\) lastGuestLook\.current = v;/, 'Guests forgets its last look');
  assert.match(SCREEN, /else if \(k === 'seats'\) chooseSeat\(seatMode\);/, 'Seats does not come back on its last look');
  assert.match(SCREEN, /pickView\(guestModes\.some\(\(o\) => o\.key === lastGuestLook\.current\) \? lastGuestLook\.current : 'list'\)/);
  assert.match(MARCH, /useEffect\(\(\) => \{\s*reportWalks\?\.\(walkTotal\);\s*\}, \[reportWalks, walkTotal\]\);/, 'the March does not tell its walk count');
  assert.match(SCREEN, /reportWalks: setWalkCount,/);
});
