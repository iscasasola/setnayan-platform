/**
 * card-headline-service.test.ts — CTRL-B3 build 7, executed not grepped.
 * 🛡 Mutation-checked; every sabotage verified to apply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headlineServiceFor } from './card-headline-service';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

// SABOTAGE: return services[0] regardless of the filter → RED.
test('a filtered card names the trade that MATCHED, not the shop\'s first', () => {
  const shop = ['photography', 'videography', 'florist'];
  assert.equal(
    headlineServiceFor(shop, 'florist'),
    'florist',
    'a couple filtering by Florist was shown "Photography by X" because photography happened to be first — the card promises an instant "is this what I am shopping for" read',
  );
  assert.equal(headlineServiceFor(shop, 'videography'), 'videography');
});

// SABOTAGE: return null when no filter is active → RED.
test('with no filter, today\'s behaviour is unchanged', () => {
  const shop = ['photography', 'florist'];
  for (const none of [null, undefined, '', '   ']) {
    assert.equal(
      headlineServiceFor(shop, none),
      'photography',
      'the shop\'s own first service is a reasonable headline when the visitor has not said what they want',
    );
  }
});

// SABOTAGE: fuzzy/substring match → RED.
test('an unmatched filter falls back — it never invents a trade', () => {
  const shop = ['live_band', 'host_mc'];
  assert.equal(
    headlineServiceFor(shop, 'band_dj'),
    'live_band',
    'the filter vocabulary and vendor_profiles.services overlap but are NOT the same list (see /v/[slug] SUP-14) — a fuzzy match would name a trade the shop never claimed',
  );
  assert.equal(headlineServiceFor(shop, 'photography'), 'live_band', 'still honest, never invented');

  // 🪤 THE CASE ABOVE CANNOT TELL EXACT FROM FUZZY. A substring match on
  // 'band_dj' also lands on 'live_band', so the sabotage that swapped `===`
  // for `.includes()` stayed GREEN and the assertion proved nothing. This one
  // discriminates: a prefix match would jump PAST the shop's first service to
  // a later one the filter never actually named.
  const ordered = ['videography', 'photography'];
  assert.equal(
    headlineServiceFor(ordered, 'photo'),
    'videography',
    'a partial filter must fall back to the first service, NOT reach into the list for something that merely looks similar',
  );
});

test('empty and dirty inputs are answerable, not a crash', () => {
  assert.equal(headlineServiceFor([], 'florist'), null);
  assert.equal(headlineServiceFor(null, 'florist'), null);
  assert.equal(headlineServiceFor([null, undefined, '  '], 'florist'), null);
  assert.equal(headlineServiceFor(['  florist  '], 'FLORIST'), '  florist  ', 'matching is case- and space-insensitive');
});

// SABOTAGE: stop passing activeCategory from the grid → RED.
test('the grid actually passes the filter in — the whole defect was that nothing did', () => {
  const card = stripComments(readFileSync(join(HERE, 'vendor-card.tsx'), 'utf8'));
  const page = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));
  assert.equal(
    count(card, /headlineServiceFor\(vendor\.services, activeCategory\)/),
    1,
    'the card must use the rule, not services[0]',
  );
  assert.equal(count(card, /vendor\.services\[0\]/), 0, 'the unconditional read must be gone');
  assert.equal(
    count(page, /activeCategory=\{filters\.category\}/),
    1,
    'nothing passed the filtered category in — that was the defect, and a rule nobody feeds is the same bug with more code',
  );
});
