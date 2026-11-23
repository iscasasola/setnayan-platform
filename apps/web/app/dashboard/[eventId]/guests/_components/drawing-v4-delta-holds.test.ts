/**
 * drawing-v4-delta-holds.test.ts — what the 22 Nov parity pass against the approved Guests drawing (corpus
 * `prototypes/guests_redesign_2026-11-20/guests_redesign_2026-11-20_fable.html`, owner 20 Nov "Yes, your picks" →
 * "Yes, build it") added on top of the 20 Nov build. Each test is one row of that pass:
 *
 *   1 · § 3 — the guest card names the chair: "Entourage · Seat 2" (`seat_number` counts from 0, read as Seat 1).
 *   2 · § 3 + the honest read — a REFUSED seat read says "Couldn’t read their seat", never "Not seated".
 *   3 · § 3 — the card speaks the List's words ("✓ Coming"), so a row and the card it opens agree.
 *   4 · § 2 + § 7 — March's orange ＋ ▾ is gone: the box drags right to add a walk, "Walk ▾" at its right end, and
 *       Enter / ＋ add through the SAME move as the tray drag (`planMove` from 'out').
 *   5 · § 2 — searching says how many it found, counted off the rows it draws.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { seatWords } from '@/lib/table-words';

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const BODY = read(join(HERE, 'guest-card-body.tsx'));
const DATA = read(join(HERE, 'guest-card-data.ts'));
const HEAD = read(join(HERE, 'guest-card-head.tsx'));
const SCREEN = read(join(HERE, 'guests-screen.tsx'));
const MARCH = read(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'details-march.tsx'));

test('1 · the card names the chair — seat_number is read, and counts from 0', () => {
  assert.equal(seatWords(0), 'Seat 1');
  assert.equal(seatWords(1), 'Seat 2');
  assert.equal(seatWords(11), 'Seat 12');
  assert.match(DATA, /\.from\('event_seat_assignments'\)\s*\.select\('table_id, seat_number,/, 'the card’s seat read no longer asks for the chair');
  assert.match(DATA, /seatNumber: seatedAt && typeof seatRow\?\.seat_number === 'number' \? seatRow\.seat_number : null,/);
  assert.match(BODY, /\[tableWords\(seatedAt\), typeof seatNumber === 'number' \? seatWords\(seatNumber\) : null\]\.filter\(Boolean\)\.join\(' · '\)/);
});

test('2 · a refused seat read is SAID — it is checked before "Not seated" can be drawn', () => {
  assert.match(DATA, /seatUnread: Boolean\(seatRowError\),/, 'the refusal no longer reaches the card');
  const at = BODY.indexOf('const seatSummary =');
  assert.notEqual(at, -1);
  const summary = BODY.slice(at, BODY.indexOf(';', at));
  const unread = summary.indexOf('seatUnread');
  assert.notEqual(unread, -1, 'the Seat row no longer reads the refusal');
  assert.ok(unread < summary.indexOf("'Not seated'"), 'a refused read can fall through to "Not seated" again');
  assert.match(summary, /seatUnread\s*\?\s*'Couldn’t read their seat'/);
});

test('3 · the card speaks the List’s words for a reply', () => {
  assert.match(BODY, /const CARD_RSVP_WORDS: Record<RsvpStatus, string> = RSVP_LIST_WORDS;/);
  assert.doesNotMatch(BODY, /RSVP_ROW_WORDS/, 'the card body speaks the filters’ words again');
  assert.doesNotMatch(HEAD, /RSVP_ROW_WORDS/, 'the card head speaks the filters’ words again');
  assert.doesNotMatch(BODY, /'Attending · always'/);
});

test('4 · March: no orange ＋ — the box drags right to add a walk, through the tray’s own move', () => {
  const at = MARCH.indexOf('<lens.ThumbRow');
  assert.notEqual(at, -1);
  const row = MARCH.slice(at, MARCH.indexOf('lens.slot,', at));
  assert.doesNotMatch(row, /\baction=\{/, 'the orange ＋ ▾ is back beside the box');
  assert.match(row, /onAdd: addTypedWalk,/);
  assert.match(row, /dragAdd: \{\s*kind: \(\s*<AddKindPick\s+word="Walk"/);
  assert.match(row, /onPick=\{\(id\) => \(id === NEW_GROUP \? addGroup\(marchSel\) : addWalkOf\(id\)\)\}/, 'Walk ▾ lost New group or the names');
  // One move for every way a walk is added: the tray drag's `planMove` from 'out' to the end of their own section.
  assert.match(
    MARCH,
    /const addWalkOf = \(id: string\) => \{[\s\S]*?run\(planMove\(shown, shownPrinted, \{ kind: 'out', id \}, \{ kind: 'gap', section: o\.section, index: sec \? sec\.rows\.length : 0 \}, shownOut\)\);/,
  );
  // A name that is not out is told so — never a silent Enter.
  assert.match(MARCH, /if \(!hit\) \{\s*say\(\{[^\n]*refused: true \}\);\s*return;/);
});

test('5 · searching says "N found", counted off the rows it draws', () => {
  assert.match(SCREEN, /data-search-found=""[^>]*>\s*<Count value=\{visible\.length\} id="gs-found" \/> found/);
});
