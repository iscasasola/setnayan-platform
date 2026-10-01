/**
 * THE SCENE STYLES' SMALL READINGS OF THE COUPLE'S OWN WORDS AND DATE
 * (`lib/scene-style-text.ts`). Every function here re-shapes data a scene
 * already holds; these pin that it re-shapes it faithfully and never invents.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calendarDay,
  dateInWords,
  dayOrdinalInWords,
  isADont,
  monthWeeks,
  paragraphsOf,
  splitFirstSentence,
  tableLabelParts,
  yearInWords,
} from './scene-style-text';

test('the quote leads with the first sentence; one sentence is all lead, no rest', () => {
  assert.deepEqual(splitFirstSentence('We waited a long time. Come hungry! Stay late.'), {
    lead: 'We waited a long time.',
    rest: 'Come hungry! Stay late.',
  });
  assert.deepEqual(splitFirstSentence('Just this one line'), { lead: 'Just this one line', rest: '' });
  assert.deepEqual(splitFirstSentence('  '), { lead: '', rest: '' });
  assert.deepEqual(splitFirstSentence(null), { lead: '', rest: '' });
  assert.equal(splitFirstSentence('“Come,” she said. Then.').lead, '“Come,” she said.');
});

test('the list is the couple’s own lines — blank lines dropped, nothing added', () => {
  assert.deepEqual(paragraphsOf('One\n\n  Two  \r\nThree\n'), ['One', 'Two', 'Three']);
  assert.deepEqual(paragraphsOf(''), []);
});

test('a "don’t" is read from the words', () => {
  for (const yes of ['No boxed gifts, please', 'not before 3', "Please don't bring kids", 'Don’t be late', 'Do not park on the lawn']) {
    assert.equal(isADont(yes), true, yes);
  }
  for (const no of ['Nothing but you', 'Notes welcome', 'Your presence is the present', 'Bring a wrap']) {
    assert.equal(isADont(no), false, no);
  }
});

test('the date in words is written FROM the date', () => {
  assert.deepEqual(dateInWords('2026-12-18'), {
    weekday: 'Friday',
    line: 'the eighteenth of December',
    year: 'two thousand twenty-six',
  });
  assert.equal(dayOrdinalInWords(1), 'first');
  assert.equal(dayOrdinalInWords(21), 'twenty-first');
  assert.equal(dayOrdinalInWords(30), 'thirtieth');
  assert.equal(dayOrdinalInWords(31), 'thirty-first');
  assert.equal(yearInWords(2030), 'two thousand thirty');
  assert.equal(yearInWords(2100), 'two thousand one hundred');
  assert.equal(dateInWords('2026-02-30'), null, 'a day that does not exist is not written');
  assert.equal(dateInWords('soon'), null);
  assert.equal(calendarDay('2026-12-18T00:00:00Z')?.day, 18, 'a timestamp keeps its calendar day');
});

test('the calendar month starts on Monday and marks the day', () => {
  const m = monthWeeks('2026-12-18')!;
  assert.equal(m.day, 18);
  // 1 December 2026 is a Tuesday → one blank before it.
  assert.deepEqual(m.weeks[0], [null, 1, 2, 3, 4, 5, 6]);
  assert.ok(m.weeks.every((w) => w.length === 7));
  assert.equal(m.weeks.flat().filter((d) => d !== null).length, 31);
});

test('a table label is split, never rewritten', () => {
  assert.deepEqual(tableLabelParts('Table 7'), { eyebrow: 'Table', big: '7' });
  assert.deepEqual(tableLabelParts('table 12A'), { eyebrow: 'Table', big: '12A' });
  assert.deepEqual(tableLabelParts('Sampaguita'), { eyebrow: null, big: 'Sampaguita' });
});
