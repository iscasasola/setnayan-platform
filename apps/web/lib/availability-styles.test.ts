/**
 * availability-styles.test.ts — 🔒 the seven availability styles have ONE source, and the database cannot drift
 * from it (Availability plan, step 2; owner ruling 2026-11-17).
 *
 *   1. the list is exactly the seven owner-ruled values, labels and names, in order;
 *   2. the CHECK in EVERY migration that defines `canonical_service_taxonomy_availability_style_check` names
 *      exactly the same values — add an eighth in code only, or in SQL only, and this goes red;
 *   3. empty is Not set, never `day`; a category's most common style pre-fills only when there is one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AVAILABILITY_STYLES,
  AVAILABILITY_NOT_SET,
  availabilityName,
  isAvailabilityStyle,
  mostCommonAvailability,
  availabilityReads,
  bookingTermsLine,
  cardCountHasNoCap,
  cardCountQuestion,
  cardIsNeverCounted,
  isCardPickableStyle,
  orderIsTooSoon,
} from './availability-styles';

const MIGRATIONS = join(import.meta.dirname, '..', '..', '..', 'supabase', 'migrations');

test('the seven are exactly the owner-ruled values, labels and names', () => {
  assert.deepEqual(
    AVAILABILITY_STYLES.map((s) => [s.value, s.label, s.name]),
    [
      ['day', 'AV-DAY', 'One booking a day'],
      ['order', 'AV-ORDER', 'Made to order'],
      ['hour', 'AV-HOUR', 'By the hour'],
      ['piece', 'AV-PIECE', 'Rented by the piece'],
      ['time', 'AV-TIME', 'Set times with seats'],
      ['night', 'AV-NIGHT', 'Rooms by the night'],
      ['none', 'AV-NONE', 'Always available'],
    ],
  );
});

test('the SQL CHECK and the code list name the same seven values', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'));
  const checks: Array<{ file: string; values: string[] }> = [];
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    const re = /(?:canonical_service_taxonomy|vendor_services)_availability_style_check\s+CHECK\s*\(\s*availability_style\s+IS\s+NULL\s+OR\s+availability_style\s+IN\s*\(([^)]*)\)/gi;
    for (const m of sql.matchAll(re)) {
      checks.push({ file: f, values: [...m[1]!.matchAll(/'([^']*)'/g)].map((x) => x[1]!) });
    }
  }
  assert.ok(checks.length >= 2, 'the taxonomy CHECK and the card CHECK (step 3) must both be found — no migration defines canonical_service_taxonomy_availability_style_check — nothing was compared');
  const code = AVAILABILITY_STYLES.map((s) => s.value).sort();
  for (const c of checks) assert.deepEqual([...c.values].sort(), code, `${c.file}: the CHECK and lib/availability-styles.ts disagree`);
});

test('empty is Not set — never day — and an unknown value is not one of the seven', () => {
  assert.equal(availabilityName(null), AVAILABILITY_NOT_SET);
  assert.equal(AVAILABILITY_NOT_SET, 'Not set');
  assert.equal(availabilityName('day'), 'One booking a day');
  assert.equal(isAvailabilityStyle(''), false);
  assert.equal(isAvailabilityStyle('weekly'), false);
  assert.equal(isAvailabilityStyle('DAY'), false);
  assert.equal(isAvailabilityStyle('night'), true);
});

test('the most common style pre-fills a new service only when there is one', () => {
  assert.equal(mostCommonAvailability([]), null);
  assert.equal(mostCommonAvailability([null, null]), null, 'unset services do not vote');
  assert.equal(mostCommonAvailability(['hour', 'hour', 'day', null]), 'hour');
  assert.equal(mostCommonAvailability(['hour', 'day']), null, 'a tie is not a pick');
});

test('a card (step 3): three styles are Coming soon; the count question is the same number, renamed', () => {
  assert.deepEqual(['day', 'order', 'hour', 'piece', 'time', 'night', 'none'].filter(isCardPickableStyle), ['day', 'order', 'piece', 'none']);
  assert.equal(isCardPickableStyle(''), false);
  assert.equal(cardCountQuestion('order', 'Q').name, 'Orders for one day');
  assert.equal(cardCountQuestion('piece', 'Q').name, 'How many do you have');
  assert.equal(cardCountQuestion('day', 'Q').name, 'Q', 'One booking a day keeps today’s question');
  assert.equal(cardCountQuestion(null, 'Q').name, 'Q', 'Not set keeps today’s question');
  assert.equal(cardCountHasNoCap('piece'), true, 'owner ruling 3: no cap above 500 for pieces');
  assert.equal(cardCountHasNoCap('order'), false);
  assert.equal(cardCountHasNoCap(null), false);
  assert.equal(cardIsNeverCounted('none'), true);
  assert.equal(cardIsNeverCounted(null), false);
});

test('the sentence reads the card the way the drawing words it', () => {
  assert.equal(availabilityReads('order', 5, 14), 'Setnayan reads this as: you can finish 5 orders due on one day, and couples must order 14 days before.');
  assert.equal(availabilityReads('piece', 500, null), 'Setnayan reads this as: 500 pieces a day. A date closes when all 500 are out.');
  assert.match(availabilityReads('none', null, null) ?? '', /never on your calendar.*never counted/);
  assert.equal(availabilityReads(null, 3, null), null, 'Not set says nothing new');
  assert.equal(availabilityReads('hour', 3, null), null, 'a Coming soon style says nothing new');
  assert.equal(bookingTermsLine('order', 5, 14), 'Made to order · 5 a day · order 14 days ahead');
  assert.equal(bookingTermsLine(null, 5, 14), null);
});

test('Order at least N days: refuses a date sooner than N days away, never without a rule', () => {
  assert.equal(orderIsTooSoon('2026-11-19', '2026-12-03', 14), false, 'exactly 14 days is allowed');
  assert.equal(orderIsTooSoon('2026-11-19', '2026-12-02', 14), true);
  assert.equal(orderIsTooSoon('2026-11-19', '2026-11-20', null), false);
  assert.equal(orderIsTooSoon('2026-11-19', '2026-11-20', 0), false);
});
