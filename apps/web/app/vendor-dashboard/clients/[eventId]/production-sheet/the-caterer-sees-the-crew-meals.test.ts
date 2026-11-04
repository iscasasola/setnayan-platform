/**
 * 🍱 THE CATERER SEES THE CREW MEALS THE HOST SET (owner 2026-11-02, DECISION_LOG "SCHEDULE FITS THE COORDINATOR'S
 * TIMELINE AS WRITTEN: 4 ADDITIONS" (4); migration 20271303132255, held in the database by
 * tests/db/a-caterer-sees-the-crew-meals.db.test.ts).
 *
 * Rule 0: the count is the EXISTING couple-side field — `event_vendors.crew_size` on a supplier marked
 * `crew_meal_covered` — never a second number. This holds:
 *   · the caterer's production sheet reads it through `get_vendor_crew_meals` and says a refused read in words;
 *   · the couple's workspace offers "Crew fed by your caterer" once a caterer is booked (not only a crew-meal provider),
 *     and no new crew-meal column appears anywhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { crewMealLines, crewMealTotal, feedsCrews, mealsWords } from '../../../../../lib/crew-meals';

const WEB = join(__dirname, '../../../../..');

test('the lines: names and counts, zero and malformed dropped, the total is the sum', () => {
  const lines = crewMealLines([
    { vendor_name: 'Sample Photo', category: 'photographer', meals: 4, from_listing: false },
    { vendor_name: 'Sample Film', category: 'videographer', meals: 3, from_listing: true },
    { vendor_name: 'Nobody', category: 'misc', meals: 0, from_listing: false },
    { vendor_name: null, category: 'misc', meals: 2 },
  ]);
  assert.deepEqual(lines.map((l) => [l.name, l.meals, l.fromListing]), [
    ['Sample Photo', 4, false],
    ['Sample Film', 3, true],
  ]);
  assert.equal(crewMealTotal(lines), 7);
  assert.equal(mealsWords(1), '1 meal');
  assert.equal(mealsWords(4), '4 meals');
  assert.equal(crewMealLines(null).length, 0);
});

test('a caterer feeds crews, as the crew-meal provider does; nobody else', () => {
  assert.ok(feedsCrews('catering'));
  assert.ok(feedsCrews('crew_meals'));
  assert.ok(!feedsCrews('photographer'));
  assert.ok(!feedsCrews(null));
});

test('the production sheet reads the RPC and says a refused read, never "none"', () => {
  const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
  assert.match(page, /rpc\('get_vendor_crew_meals', \{ p_event_id: eventId \}\)/);
  assert.match(page, /crewMeals === null \?[\s\S]{0,200}couldn&rsquo;t be read/);
  assert.match(page, /data-crew-meals=""/);
});

test('the couple side extends the EXISTING field: "Crew fed by your caterer", and no second crew-meal column', () => {
  const ws = readFileSync(join(WEB, 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx'), 'utf8');
  assert.match(ws, /crewRows\.some\(\(r\) => feedsCrews\(r\.category\)\)/, 'the toggle is still only offered with a crew-meal provider');
  assert.match(ws, /Crew fed by \{feederWords\}/);
  // The count's one home is event_vendors.crew_size + crew_meal_covered. A migration adding another crew-meal column
  // would be a second source of truth for one fact.
  const migs = readdirSync(join(WEB, '../../supabase/migrations'));
  const bad = migs.filter((f) => /ADD COLUMN[^;]*crew_meal_count|ADD COLUMN[^;]*crew_meals_count/i.test(readFileSync(join(WEB, '../../supabase/migrations', f), 'utf8')));
  assert.deepEqual(bad, []);
});
