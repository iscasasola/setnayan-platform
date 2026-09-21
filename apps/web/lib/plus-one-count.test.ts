import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PLUS_ONE_CHOICES, computeGuestStats, plusOneSeats, plusOnesFromCsv } from '@/lib/guests';

/**
 * ⚖ Owner 2026-09-21: "+1 per guest can be up to number 4. can be
 * +1/+2/+3/+4. these are for the additional seats."
 */

test('the choices are exactly None and +1 … +4', () => {
  assert.deepEqual([...PLUS_ONE_CHOICES], [0, 1, 2, 3, 4]);
});

test('seats read the count; a read without it falls back to the old one seat', () => {
  assert.equal(plusOneSeats({ plus_one_count: 3, plus_one_allowed: true }), 3);
  assert.equal(plusOneSeats({ plus_one_count: 0, plus_one_allowed: false }), 0);
  assert.equal(plusOneSeats({ plus_one_allowed: true }), 1, 'an older read lost the seat entirely');
  assert.equal(plusOneSeats({ plus_one_count: 9 }), 4, 'more than four got through');
});

test('the plus-ones meter counts seats, not guests who may bring someone', () => {
  const g = (n: number) => ({ rsvp_status: 'pending', plus_one_allowed: n > 0, plus_one_count: n }) as never;
  assert.equal(computeGuestStats([g(3), g(0), g(1)]).plus_ones, 4);
});

test('a CSV can say how many', () => {
  assert.equal(plusOnesFromCsv({ plus_ones: '3' }), 3);
  assert.equal(plusOnesFromCsv({ plus_one_allowed: '+2' }), 2);
  assert.equal(plusOnesFromCsv({ plus_one_allowed: 'yes' }), 1, 'the old yes stopped meaning one');
  assert.equal(plusOnesFromCsv({ plus_one_allowed: 'no' }), 0);
  assert.equal(plusOnesFromCsv({ plus_one_count: '7' }), 4);
  assert.equal(plusOnesFromCsv({}), 0);
});

const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));
const C = ['app', 'dashboard', '[eventId]', 'guests', '_components'];

test('both the table row and the phone card carry the +N picker', () => {
  const rows = read(...C, 'guest-list-multiselect.tsx');
  assert.equal(
    (rows.match(/plusControl=\{<PlusOneChipEditor eventId=\{eventId\} guest=\{guest\} \/>\}/g) ?? []).length,
    2,
    'expected the picker on BOTH the desktop row and the phone card',
  );
  const editor = read(...C, 'chip-editors.tsx');
  assert.match(editor, /run: \(\) => setGuestPlusOneCount\(eventId, guest\.guest_id, count\)/, 'the picker does not save');
  assert.match(editor, /PLUS_ONE_CHOICES\.map/, 'the picker does not offer None · +1 … +4');
});
