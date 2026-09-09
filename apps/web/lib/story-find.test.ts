/**
 * FIND IN THIS DAY — the arithmetic (`01_The_Story.md` §8).
 *
 * The search's privacy is architectural and is proved elsewhere
 * (`the-index-cannot-outrun-the-payload.test.ts`). What is left is the part
 * that can be quietly wrong on a page that looks right: reading a time out of
 * what somebody typed, narrowing by every word rather than any, and marking the
 * matches without building HTML out of a guest's own message.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIND_GROUP_CAP,
  findSnippet,
  formatFoundTime,
  groupHits,
  markSegments,
  matchFindables,
  parseStoryTime,
  type Findable,
} from './story-find';

const at = (h: number, m = 0) => h * 60 + m;

test('a time · the shapes a reader actually types', () => {
  // Plain clock times.
  assert.equal(parseStoryTime('7:12'), at(19, 12), 'a bare afternoon hour reads as PM');
  assert.equal(parseStoryTime('7:12 PM'), at(19, 12));
  assert.equal(parseStoryTime('9:47pm'), at(21, 47));
  assert.equal(parseStoryTime('11:20'), at(11, 20), '11 is left in the morning');
  assert.equal(parseStoryTime('11:20 AM'), at(11, 20));
  assert.equal(parseStoryTime('12:30 AM'), at(0, 30), 'twelve in the morning is midnight');

  /*
    ⚠ A 24-HOUR CLOCK MUST NOT MEET THE BARE-HOUR RULE. `19:12` is already past
    twelve; adding twelve to it gives 31:12 and the parser would return null on
    a query that is perfectly clear. This is the case that made the rule
    explicit rather than incidental.
  */
  assert.equal(parseStoryTime('19:12'), at(19, 12));
  assert.equal(parseStoryTime('21:47'), at(21, 47));
});

test('a time · in Filipino, which is how a guest at a Philippine wedding types it', () => {
  assert.equal(parseStoryTime('3 hapon'), at(15), 'hapon — afternoon');
  assert.equal(parseStoryTime('3 ng hapon'), at(15), 'the "ng" is how people write it');
  assert.equal(parseStoryTime('8 gabi'), at(20), 'gabi — night');
  assert.equal(parseStoryTime('10 umaga'), at(10), 'umaga — morning');
  assert.equal(parseStoryTime('12 umaga'), at(0), 'twelve in the morning is midnight');
  assert.equal(parseStoryTime('12 tanghali'), at(12), 'tanghali — noon');
  assert.equal(parseStoryTime('1 tanghali'), at(13), 'one after noon is one in the afternoon');
  assert.equal(parseStoryTime('2 madaling araw'), at(2), 'madaling araw — the small hours');
});

test('a time · and what is NOT one', () => {
  for (const q of ['first dance', '25:00', '7:99', 'lolo ben', '', 'goldenhour']) {
    assert.equal(parseStoryTime(q), null, `“${q}” is not a time`);
  }
});

test('a time · reads back the way the page prints it', () => {
  assert.deepEqual(formatFoundTime(at(19, 12)), { t: '7:12', ap: 'PM' });
  assert.deepEqual(formatFoundTime(at(0, 5)), { t: '12:05', ap: 'AM' });
  assert.deepEqual(formatFoundTime(at(12, 0)), { t: '12:00', ap: 'PM' });
});

const ITEMS: Findable[] = [
  {
    id: '1',
    group: 'Minutes',
    stamp: '7:12 PM',
    label: 'The First Dance',
    text: 'Under strings of warm light they danced to the kundiman.',
    targetId: 'm4',
    panel: null,
    hour: null,
  },
  {
    id: '2',
    group: 'Voices',
    stamp: '9:47 PM',
    label: 'Lolo Ben, 81, undefeated.',
    text: 'JR · Papic challenge',
    targetId: 'm5',
    panel: null,
    hour: null,
  },
  {
    id: '3',
    group: 'Voices',
    stamp: '2:38 PM',
    label: 'Ben walked beside her.',
    text: 'Papa Ramon',
    targetId: 'm2',
    panel: null,
    hour: null,
  },
];

test('a query · every word must land, not any of them', () => {
  /*
    🔴 "ANY" TURNS A TWO-WORD QUERY INTO A WALL. On a page of Filipino names,
    matching on either word makes "lolo ben" return every hit containing "ben"
    AND every hit containing "lolo" — and the results panel promises the
    opposite in its own copy ("add a word to narrow it").
  */
  assert.deepEqual(
    matchFindables(ITEMS, 'ben').map((h) => h.id),
    ['2', '3'],
    'one word is broad, as it should be',
  );
  assert.deepEqual(
    matchFindables(ITEMS, 'lolo ben').map((h) => h.id),
    ['2'],
    'the second word narrowed it',
  );
  assert.deepEqual(matchFindables(ITEMS, 'lolo marco').map((h) => h.id), []);
});

test('a query · the stamp is searchable, so “9:47” finds the minute it names', () => {
  assert.deepEqual(
    matchFindables(ITEMS, '9:47').map((h) => h.id),
    ['2'],
  );
});

test('a group · caps at eight and says how many it kept back', () => {
  const many: Findable[] = Array.from({ length: 11 }, (_, i) => ({
    ...ITEMS[1]!,
    id: `v${i}`,
  }));
  const { shown, more } = groupHits(many, 'Voices');
  assert.equal(shown.length, FIND_GROUP_CAP);
  assert.equal(more, 11 - FIND_GROUP_CAP);
  assert.deepEqual(groupHits(many, 'Minutes'), { shown: [], more: 0 });
});

test('a snippet · centres on the match, and does not pretend to have cut the start', () => {
  const body =
    'Everyone remembers the march. I remember eleven nineteen, the minute before the door opened, ' +
    'when she looked at me in the mirror and mouthed set na yan and we both nearly lost it.';
  const early = findSnippet(body, 'everyone');
  assert.ok(!early.startsWith('…'), 'a match in the first words needs no leading ellipsis');
  const late = findSnippet(body, 'mirror');
  assert.ok(late.startsWith('…') && late.includes('mirror'), late);
  assert.equal(findSnippet('short enough', 'short'), 'short enough');
});

test('marking · returns segments, so a guest’s own words cannot inject anything', () => {
  /*
    🔴 THE PROTOTYPE BUILDS `<mark>` INTO AN HTML STRING AND ASSIGNS `innerHTML`.
    Safe for hard-coded demo copy; unsafe the moment the text is a wish somebody
    typed at a wedding. These segments are rendered by React as text nodes.
  */
  const segs = markSegments('The First Dance', 'first');
  assert.deepEqual(
    segs.map((s) => `${s.hit ? '[' : ''}${s.text}${s.hit ? ']' : ''}`).join(''),
    'The [First] Dance',
  );
  // The dangerous string survives as TEXT, in one piece, un-parsed.
  const evil = markSegments('<img src=x onerror="alert(1)"> ben', 'ben');
  assert.equal(evil.map((s) => s.text).join(''), '<img src=x onerror="alert(1)"> ben');
  assert.ok(evil.some((s) => s.hit && s.text === 'ben'));
  // An empty query marks nothing rather than marking everything.
  assert.deepEqual(markSegments('anything', '  '), [{ text: 'anything', hit: false }]);
});
