/**
 * 🔢 A GUEST'S SECOND +1 IS "+2" EVERYWHERE IT IS NAMED (owner 2026-11-01, DECISION_LOG "SEATS 2D IS THE ROOM, LIST IS
 * THE PEOPLE": *"the second extra guest of a host reads "+2 · TBA" but says "Antonio's +1"; it must say "+2"."*).
 *
 * The PROPERTY: the words that name a seat by its guest carry that seat's own number — the seat plan's hint beside the
 * name, and the guest card's sentences (`callName`) — the same number the seat's title prints (`seatPlaceholderLabel`).
 *
 * SABOTAGE (seen RED, then restored): the seat plan's hint back to a fixed `’s +1`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { plusOneMark, plusOneOfWords, plusOneSeatIndexes } from '@/lib/plus-one-of';
import { seatPlaceholderLabel } from '@/lib/extra-seats';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const host = { guest_id: 'h', first_name: 'Antonio', last_name: 'Reyes', display_name: null, side: 'groom' as const };

test('1 · the second seat is "+2" in its title AND in its mark', () => {
  const second = plusOneOfWords({ guest_id: 's2', first_name: 'TBA', plus_one_name_confirmed_at: null }, host as never, 1);
  assert.equal(second.mark, '+2');
  assert.ok(second.name?.endsWith(seatPlaceholderLabel(1)), second.name ?? '');
  assert.equal(plusOneMark(0), '+1');
});

test('2 · seats are counted per guest, in list order', () => {
  const idx = plusOneSeatIndexes([
    { guest_id: 'h', plus_one_of: null },
    { guest_id: 'a', plus_one_of: 'h' },
    { guest_id: 'x', plus_one_of: 'k' },
    { guest_id: 'b', plus_one_of: 'h' },
  ]);
  assert.equal(idx.get('a'), 0);
  assert.equal(idx.get('b'), 1);
  assert.equal(idx.get('x'), 0);
  assert.equal(idx.has('h'), false);
});

test('3 · the seat plan and the guest card say the seat’s own number, never a fixed "+1"', () => {
  const ed = src('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.doesNotMatch(ed, /’s \+1`/, 'the seat plan names a +1 seat with a fixed "+1"');
  assert.match(ed, /’s \$\{plusOneMark\(plusOneIdx\.get\(g\.guest_id\) \?\? 0\)\}`/);
  const card = src('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  assert.doesNotMatch(card, /hostName\}’s \+1`/, 'the card calls a +1 seat by a fixed "+1"');
  assert.match(card, /\$\{data\.plusOneOf\.hostName\}’s \$\{data\.plusOneOf\.mark\}/);
});
