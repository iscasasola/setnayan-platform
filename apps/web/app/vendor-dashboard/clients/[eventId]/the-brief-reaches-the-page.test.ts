/**
 * the-brief-reaches-the-page.test.ts: the supplier's client card shows what
 * `get_vendor_event_brief` now delivers from first contact.
 *
 * Owner, 2026-09-20: "they already see everything from the starts."
 * Migration 20271235469220 opened the brief to every live relationship (an
 * inquiry thread, a shortlist row, an ask) and gave every stage the venue, the
 * address, meal counts, the seat-plan size and the run-of-show. A card that
 * still hid those behind "Unlocks when they book you" would be telling the
 * supplier something false about data it is already holding. So this file pins:
 *
 *   1. "This couple" appears ONLY when the name is genuinely missing. A blank
 *      display_name counts as missing, so the fallback goes through one helper
 *      that trims.
 *   2. No lock row claims the venue, meals, seat plan or timeline "unlock when
 *      they book you".
 *   3. The venue and the pre-agreement timeline render from the brief, not
 *      behind `isBooked`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('"This couple" is only the fallback for a missing or blank name', () => {
  const helper = PAGE.match(/function coupleNameOrFallback\(name: string \| null\): string \{\s*return name\?\.trim\(\) \|\| 'This couple';\s*\}/g) ?? [];
  assert.equal(helper.length, 1, `expected one trimming fallback helper, found ${helper.length}`);
  const uses = PAGE.match(/const eventName = coupleNameOrFallback\(brief\.event\.display_name\);/g) ?? [];
  assert.equal(uses.length, 1, `the card title must go through the helper, found ${uses.length}`);
  const literal = PAGE.match(/'This couple'/g) ?? [];
  assert.equal(literal.length, 1, `"This couple" must appear only inside the helper, found ${literal.length}`);
});

test('no lock row says the brief’s data unlocks on booking', () => {
  const locks = PAGE.match(/Unlocks when they book you/g) ?? [];
  assert.equal(locks.length, 0, `found ${locks.length} "Unlocks when they book you" lock rows`);
  for (const title of ['Exact venue address', 'Meal counts & dietary', 'Seat plan & tables', 'Full day-of timeline']) {
    assert.ok(!PAGE.includes(`title="${title}"`), `lock row "${title}" is back`);
  }
});

test('the venue and the pre-agreement run-of-show render from the brief', () => {
  const venue = PAGE.match(/\{brief\.event\.venue_name \|\| brief\.event\.venue_address \? \(/g) ?? [];
  assert.equal(venue.length, 1, `the venue block must key on the data, not isBooked (found ${venue.length})`);
  const meta = PAGE.match(/brief\.event\.venue_name \?\? brief\.event\.region \?\? null,/g) ?? [];
  assert.equal(meta.length, 1, `the header meta must show the venue at every stage (found ${meta.length})`);
  const preTimeline = PAGE.match(/if \(preAgreement\) \{\s*const timeline = props\.brief\.timeline \?\? \[\];/g) ?? [];
  assert.equal(preTimeline.length, 1, `the pre-agreement schedule must read brief.timeline (found ${preTimeline.length})`);
});
