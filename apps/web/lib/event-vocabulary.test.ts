/**
 * event-vocabulary.test.ts — typing the word you know finds your own event.
 *
 * Owner, 2026-09-23: *"when i searched wedding, it should also show my wedding
 * event."* He was right, and the cause was that the index was built from the
 * RENDERING: the subtitle puts the type through `eventTypeBadge`, which turns
 * `wedding` into "KASAL", so the English word was translated away before
 * anything was searched. Measured live the same day — `?q=wedding` returned 24
 * results and none of his; `?q=kasal` returned 2 and both were his.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchesCommandQuery, type MatchableItem } from './command-match';
import {
  EVENT_TYPE_BADGE,
  EVENT_TYPE_TERMS,
  eventSearchTerms,
  eventTypeBadge,
  parseEventDate,
} from './event-vocabulary';

/** A row shaped exactly as the index builds one — badge in the subtitle, the
 *  data's own words in `terms`. Building the subtitle the real way is the
 *  point: a fixture that put "wedding" in the subtitle would agree with itself
 *  and prove nothing. */
function eventRow(type: string, name: string, date: string | null, place: string | null): MatchableItem {
  return {
    label: name,
    sublabel: [eventTypeBadge(type), date ?? 'Date to be set', place].filter(Boolean).join(' · '),
    kind: 'event',
    terms: eventSearchTerms(type, date, place, 'organiser'),
  };
}

test('🔴 the exact measured defect: "wedding" finds a KASAL-badged event', () => {
  const row = eventRow('wedding', 'Maria & Jose', '2026-12-12', 'Tagaytay');
  assert.ok(!row.sublabel.toLowerCase().includes('wedding'), 'fixture is wrong — the badge should read KASAL');
  assert.ok(matchesCommandQuery(row, 'wedding'), 'typing "wedding" still cannot find your wedding');
  assert.ok(matchesCommandQuery(row, 'kasal'), 'the Filipino word stopped working');
});

test('🔴 every mapped type is findable in BOTH languages', () => {
  const cases: Array<[type: string, words: string[]]> = [
    ['wedding', ['wedding', 'kasal']],
    ['christening', ['christening', 'baptism', 'binyag']],
    ['baptism', ['baptism', 'christening', 'binyag']],
    ['birthday', ['birthday', 'kaarawan']],
    ['anniversary', ['anniversary', 'anibersaryo']],
    ['debut', ['debut']],
  ];
  for (const [type, words] of cases) {
    const row = eventRow(type, 'Their day', '2027-03-04', 'Cebu');
    for (const w of words) {
      assert.ok(matchesCommandQuery(row, w), `a ${type} is not findable by "${w}"`);
    }
  }
});

test('🔑 the two maps cannot drift — badge keys and term keys agree', () => {
  for (const [type, badge] of Object.entries(EVENT_TYPE_BADGE)) {
    const terms = EVENT_TYPE_TERMS[type];
    assert.ok(terms, `"${type}" is badged "${badge}" but has no searchable words`);
    assert.ok(
      terms.includes(badge.toLowerCase()),
      `"${type}" renders as "${badge}" but that word does not find it`,
    );
    assert.ok(terms.includes(type), `"${type}" is not findable by its own name`);
  }
  for (const type of Object.keys(EVENT_TYPE_TERMS)) {
    assert.ok(EVENT_TYPE_BADGE[type], `"${type}" has search words but no badge — is it a real type?`);
  }
});

test('an UNMAPPED type stays findable by its own words', () => {
  // A missing map entry must cost the synonyms, never the event.
  const row = eventRow('family_reunion', 'The Cruz reunion', '2027-01-09', 'Baguio');
  assert.ok(matchesCommandQuery(row, 'family reunion'), 'an unmapped type became unfindable');
  assert.ok(matchesCommandQuery(row, 'reunion'));
});

test('the date and the place are searchable, the way a person would type them', () => {
  const row = eventRow('wedding', 'Ana & Paolo', '2026-12-12', 'Tagaytay');
  for (const q of ['december', 'dec', '2026', 'tagaytay', 'Tagaytay']) {
    assert.ok(matchesCommandQuery(row, q), `"${q}" should find it`);
  }
});

test('🔑 the date is parsed field-by-field — no UTC off-by-one', () => {
  // `new Date('2026-12-12')` is the 11th west of Greenwich. That bug once
  // printed a 12 Dec wedding as 11 Dec on 41 screens.
  const d = parseEventDate('2026-12-12');
  assert.ok(d);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 11);
  assert.equal(d.getDate(), 12, 'the date shifted — parseEventDate went back to new Date(iso)');
  assert.equal(parseEventDate(null), null);
  assert.equal(parseEventDate('not-a-date'), null);
});

test('a query still has to match something — this is not a filter that passes everything', () => {
  const row = eventRow('wedding', 'Maria & Jose', '2026-12-12', 'Tagaytay');
  assert.ok(!matchesCommandQuery(row, 'zzzznope'), 'the matcher matches anything');
  assert.ok(!matchesCommandQuery(row, 'binyag'), 'a wedding is findable as a christening');
});
