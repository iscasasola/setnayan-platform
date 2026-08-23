/**
 * THE PICKS, ON THE WAY OUT OF SQL AND ONTO A CARD.
 *
 * `compileCardRecord` is the boundary between a JSONB payload and a public
 * card, and its ONE job here is to refuse shapes — never to reconstruct a
 * number the reader withheld. Both floors live in SQL (migration
 * 20271159436100) and are proved there
 * (tests/db/what-couples-actually-picked.db.test.ts); what these tests hold is
 * that nothing on the TypeScript side can put a suppressed fact back.
 *
 * Plus the predicate that replaced four hand-written copies of
 * `bookedCount > 0` — the copies that would each have hidden a card whose only
 * record is its picks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cardRecordHasSomethingToSay,
  cardRecordHasSomethingToSayToTheShop,
  compileCardRecord,
  EMPTY_CARD_RECORD,
} from './service-card-record';

test('a payload with picks compiles them, biggest first', () => {
  const r = compileCardRecord({
    booked_count: 6,
    option_sample_n: 6,
    option_mix: [
      { label: 'Drone', n: 3 },
      { label: 'Second shooter', n: 5 },
      { label: 'Album', n: 5 },
    ],
  });
  assert.equal(r.optionSampleN, 6);
  assert.deepEqual(r.optionPicks, [
    { label: 'Album', n: 5 },
    { label: 'Second shooter', n: 5 },
    { label: 'Drone', n: 3 },
  ]);
});

test('a withheld block stays withheld — nothing is reconstructed', () => {
  const r = compileCardRecord({ booked_count: 2, option_sample_n: 0, option_mix: [] });
  assert.equal(r.optionSampleN, 0);
  assert.deepEqual(r.optionPicks, []);
});

test('an older payload with no picks keys at all still compiles', () => {
  // The reader shipped without these two keys. A card read through a stale
  // deploy, or a cached row, must not throw or invent.
  const r = compileCardRecord({ booked_count: 4, type_mix: [], ledger: [] });
  assert.equal(r.optionSampleN, 0);
  assert.deepEqual(r.optionPicks, []);
});

test('junk elements cost only themselves', () => {
  const r = compileCardRecord({
    option_sample_n: 5,
    option_mix: [
      { label: 'Album', n: 4 },
      null,
      'nonsense',
      { label: '', n: 4 },
      { label: 'Ghost', n: 0 },
      { label: 'Weird', n: -2 },
      { label: 'NaN', n: 'x' },
    ],
  });
  assert.deepEqual(r.optionPicks, [{ label: 'Album', n: 4 }]);
});

test('a line claiming MORE couples than the sample drops the whole block', () => {
  // An impossible pair on a public card is worse than no pair. Half-showing it
  // would leave the believable lines standing beside proof the payload is not
  // to be trusted.
  const r = compileCardRecord({
    option_sample_n: 3,
    option_mix: [
      { label: 'Album', n: 3 },
      { label: 'Impossible', n: 9 },
    ],
  });
  assert.deepEqual(r.optionPicks, [], 'the block is dropped, not filtered');
  assert.equal(r.optionSampleN, 3);
});

test('a non-object payload is the zero record, picks included', () => {
  assert.deepEqual(compileCardRecord(null), EMPTY_CARD_RECORD);
  assert.deepEqual(compileCardRecord('nope'), EMPTY_CARD_RECORD);
  assert.equal(EMPTY_CARD_RECORD.optionSampleN, 0);
  assert.deepEqual(EMPTY_CARD_RECORD.optionPicks, []);
});

test('the one gate: a card whose ONLY record is its picks is not hidden', () => {
  // This is the case the four hand-written `bookedCount > 0` gates would each
  // have swallowed. `booked_count` cannot see a booking made through the card's
  // own package — those event_vendors rows carry no service_id.
  const picksOnly = compileCardRecord({
    booked_count: 0,
    option_sample_n: 4,
    option_mix: [{ label: 'Album', n: 4 }],
  });
  assert.equal(cardRecordHasSomethingToSay(picksOnly), true);

  const booked = compileCardRecord({ booked_count: 2 });
  assert.equal(cardRecordHasSomethingToSay(booked), true);

  const nothing = compileCardRecord({ booked_count: 0 });
  assert.equal(cardRecordHasSomethingToSay(nothing), false);
  assert.equal(cardRecordHasSomethingToSay(null), false);
  assert.equal(cardRecordHasSomethingToSay(undefined), false);
});

test('the documented count parses, and is NOT floored', () => {
  // Deliberately unlike the option mix: this counts the shop's OWN work, so one
  // reads as one — and the owner asked for a number that moves from the first
  // celebration, as a nudge to record everything.
  const one = compileCardRecord({ booked_count: 0, documented_events: 1 });
  assert.equal(one.documentedEvents, 1);
  assert.equal(cardRecordHasSomethingToSay(one), false, 'a shop fact is not a card record');
  assert.equal(
    cardRecordHasSomethingToSayToTheShop(one),
    true,
    'but the shop must see it on its own card',
  );
});

test('a malformed documented count is 0, never negative or NaN', () => {
  for (const v of [null, undefined, 'x', -4, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(compileCardRecord({ documented_events: v }).documentedEvents, 0);
  }
  assert.equal(EMPTY_CARD_RECORD.documentedEvents, 0);
});
