/**
 * 🧾 THE CARD MAKER SAYS WHAT THE CARD DOES (supplier-ready walk of service cards, 23 Nov 2026).
 *
 * The walk found two places where the Card Maker told the supplier something the card does not do:
 *   A · Rented by the piece told the supplier "couples ask for how many they need". The ruling (`lib/pieces-ask-words.ts`,
 *       owner Q2, 20 Nov) is the opposite: a couple's ask carries no number, and the supplier says how many at the yes;
 *   B · Always available still offered a "Schedule" pick. That card is never counted and never on the calendar (owner
 *       ruling 4; migration `a_booking_takes_its_pieces_all_or_nothing`), so the pick did nothing: a dead control. The
 *       count and time-slot rows beside it were already hidden.
 *
 * Fails if:
 *   1 · the piece words (short or long) say the couple asks for a number again, or stop saying the yes decides it;
 *   2 · the Schedule row draws for an Always available card;
 *   3 · hiding the row also drops the stored schedule (the hidden `schedule_choice` input must stay unconditional).
 *
 * SABOTAGE (each seen red, restored): see the PR body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { cardCountQuestion } from '@/lib/availability-styles';

const here = dirname(fileURLToPath(import.meta.url));
const MAKER = stripComments(
  readFileSync(join(here, '..', 'app', 'vendor-dashboard', 'services', '_components', 'canvas-maker.tsx'), 'utf8'),
);

const COUPLE_NAMES_A_NUMBER = /ask(s)? for how many|how many they need|how many (do )?they want/i;

test('1 · the piece words follow the ruling: the couple names no number, the yes decides it', () => {
  const short = cardCountQuestion('piece', 'Q').about;
  assert.doesNotMatch(short, COUPLE_NAMES_A_NUMBER, `short helper: ${short}`);
  assert.match(short, /\byes\b/i, 'the short helper says the supplier decides at the yes');

  const long = MAKER.match(/style === 'piece'\s*\?\s*'([^']+)'/);
  assert.ok(long, 'the Card Maker still words the piece count');
  assert.doesNotMatch(long[1], COUPLE_NAMES_A_NUMBER, `long helper: ${long[1]}`);
  assert.match(long[1], /without a number/i);
  assert.match(long[1], /\byes\b/i);
});

test('2 · the Schedule row is not drawn for an Always available card', () => {
  const row = MAKER.indexOf('data-maker-row="schedule"');
  assert.ok(row > 0, 'the Schedule row still exists for counted cards');
  const before = MAKER.slice(Math.max(0, row - 200), row);
  assert.match(before, /cardIsNeverCounted\(cardStyle\)\s*\?\s*null\s*:\s*\(\s*<div\s*$/, 'the row sits behind the never-counted check');
});

test('3 · the stored schedule still rides the save when the row is hidden', () => {
  const hidden = MAKER.match(/\n([^\n]*)<input type="hidden" name="schedule_choice"[^\n]*/);
  assert.ok(hidden, 'the hidden schedule_choice input exists');
  assert.doesNotMatch(hidden[1], /cardIsNeverCounted|\?/, 'it is not behind a condition');
});
