/**
 * R7 (walk W4/W5, 18 Nov 2026): Discover's Occasion filter still offered "Celebration" — the admin roster's label for
 * the generic event type, passed straight through. House copy says "event", never "celebration". Only the WORD changes;
 * the key (`celebration`) stays, so `?event_type=celebration` and every stored row keep working.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { GENERIC_EVENT_TYPE_KEY, GENERIC_EVENT_TYPE_WORD, eventTypeShownWords } from './event-type-shown-words';

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ROSTER = [
  { key: 'wedding', label: 'Wedding' },
  { key: 'celebration', label: 'Celebration' },
  { key: 'debut', label: 'Debut' },
];

test('the generic type is shown as "Other events" — the key, the order and every other row unchanged', () => {
  const shown = eventTypeShownWords(ROSTER);
  assert.deepEqual(
    shown.map((o) => o.key),
    ROSTER.map((o) => o.key),
    'a key changed — the filter would post a value the vocab does not know',
  );
  assert.equal(shown.find((o) => o.key === GENERIC_EVENT_TYPE_KEY)?.label, GENERIC_EVENT_TYPE_WORD);
  assert.equal(shown.find((o) => o.key === 'wedding')?.label, 'Wedding');
  assert.ok(shown.every((o) => !/\bcelebrations?\b/i.test(o.label)), 'a shown word still says "celebration"');
  assert.equal(ROSTER[1]!.label, 'Celebration', 'the roster passed in was changed in place');
});

test('Discover: the Occasion filter and the Event stories pick both show the roster through the house words', () => {
  const src = read('app/_components/frontdoor/front-door.tsx');
  // The filter drawer's Occasion select (the supplier shelf's Filters) …
  assert.match(src, /eventTypeOptions: eventTypeShownWords\(shelfOccasions\)/, 'Discover’s Occasion filter shows the raw roster labels');
  // … and Event stories' "Event type" pick.
  assert.match(src, /occasions=\{eventTypeShownWords\(storyOccasions\)/, 'Discover’s Event stories pick shows the raw roster labels');
  // No other path hands the raw roster to a picker on this page.
  assert.doesNotMatch(src, /(?<!eventTypeShownWords\()\b(shelfOccasions|storyOccasions)\.map\(/, 'a roster reaches a picker without the house words');
});

test('the supplier door uses the same rule (one rule, not two copies of it)', () => {
  const src = read('app/open-shop/_components/event-tiles.tsx');
  assert.match(src, /return eventTypeShownWords\(options\)/);
  assert.doesNotMatch(src, /'Other events'/, 'the supplier door typed its own copy of the word');
});
