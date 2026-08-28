import test from 'node:test';
import assert from 'node:assert/strict';
import { isTradeSearchMiss, collectiblePhraseFor } from './collected-trade-phrase';

test('isTradeSearchMiss: a short query is never a miss (below MIN_QUERY_LEN)', () => {
  assert.equal(
    isTradeSearchMiss({ query: 'a', rankedTradeCount: 0, anyLegacyLabelMatches: false }),
    false,
  );
  assert.equal(
    isTradeSearchMiss({ query: ' ', rankedTradeCount: 0, anyLegacyLabelMatches: false }),
    false,
  );
});

test('isTradeSearchMiss: a query that ranked SOME trade is not a miss', () => {
  assert.equal(
    isTradeSearchMiss({ query: 'sound', rankedTradeCount: 3, anyLegacyLabelMatches: false }),
    false,
  );
});

test('isTradeSearchMiss: a query a legacy pill label matches is not a miss', () => {
  assert.equal(
    isTradeSearchMiss({ query: 'catering', rankedTradeCount: 0, anyLegacyLabelMatches: true }),
    false,
  );
});

test('isTradeSearchMiss: true only when long enough, zero ranked trades, and no legacy match', () => {
  assert.equal(
    isTradeSearchMiss({
      query: 'sound system rental',
      rankedTradeCount: 0,
      anyLegacyLabelMatches: false,
    }),
    true,
  );
});

test('collectiblePhraseFor: no pending miss -> nothing to collect', () => {
  assert.equal(
    collectiblePhraseFor({
      missedQuery: null,
      pickedKey: 'lights_sound',
      liveTradeKeys: new Set(['lights_sound']),
    }),
    null,
  );
});

test('collectiblePhraseFor: picking a trade OUTSIDE the live set teaches nothing (e.g. Miscellaneous, a legacy pill)', () => {
  assert.equal(
    collectiblePhraseFor({
      missedQuery: 'sound system rental',
      pickedKey: 'misc',
      liveTradeKeys: new Set(['lights_sound']),
    }),
    null,
  );
});

test('collectiblePhraseFor: a genuine miss resolved by picking a live trade IS collectible', () => {
  assert.equal(
    collectiblePhraseFor({
      missedQuery: 'sound system rental',
      pickedKey: 'lights_sound',
      liveTradeKeys: new Set(['lights_sound']),
    }),
    'sound system rental',
  );
});

test('collectiblePhraseFor: an empty/whitespace missed query is never collectible even with a live key', () => {
  assert.equal(
    collectiblePhraseFor({
      missedQuery: '  ',
      pickedKey: 'lights_sound',
      liveTradeKeys: new Set(['lights_sound']),
    }),
    null,
  );
});
