/**
 * event-poster.test.ts — which poster an event's card wears, executed.
 *
 * ⚖ Owner-approved 2026-09-24 (DECISION_LOG, "the template is good"): the cover
 * "follows the hero the couple built (invitation card in their theme; hero
 * photo wins; a wake keeps its quiet masthead)", names and date printed once.
 * The order and its reasons are in `lib/event-poster.ts`'s docblock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  posterDate,
  posterFor,
  safeAccent,
} from './event-poster';

const WEDDING = { solemn: false, twoPeople: true, eventWord: 'wedding' } as const;
const BIRTHDAY = { solemn: false, twoPeople: false, eventWord: 'birthday' } as const;
const WAKE = { solemn: true, twoPeople: false, eventWord: 'wake' } as const;

const base = {
  displayName: 'Maria & Jose',
  eventDate: '2026-12-12',
  venueName: 'Sta. Clara Chapel',
  words: WEDDING,
  theme: 'house' as const,
  accent: null as unknown,
  heroSrc: null as string | null,
};

test('a wake keeps its quiet masthead — even with a photo and a colour set', () => {
  const p = posterFor({
    ...base,
    displayName: 'Rosario Santos',
    words: WAKE,
    heroSrc: 'https://r2.example/hero.jpg',
    accent: '#9a244f',
  });
  assert.equal(p.kind, 'quiet');
  assert.equal(p.photoSrc, null, 'a wake never shows the celebration photo on its card');
  assert.equal(p.venue, 'Sta. Clara Chapel');
  assert.equal(p.eyebrow, null);
  assert.equal(p.line, null, 'no "invites you to celebrate" on a wake');
});

test('the couple’s own hero photo wins over their colour and their theme', () => {
  const p = posterFor({ ...base, heroSrc: 'https://r2.example/hero.jpg', accent: '#9a244f', theme: 'vintage' });
  assert.equal(p.kind, 'photo');
  assert.equal(p.photoSrc, 'https://r2.example/hero.jpg');
  assert.equal(p.dark, true);
});

test('a colour never swaps the layout — every event without a hero photo gets The Card (owner 2026-09-26)', () => {
  // Wine carries white type, gold does not; before 2026-09-26 those became the
  // `deep` and `moon` sheets. The cover now follows the Event Hub hero instead.
  for (const accent of ['#9A244F', '#cba766', '#c0623f']) {
    const p = posterFor({ ...base, accent });
    assert.equal(p.kind, 'invitation', `accent ${accent} must not change the layout`);
    assert.equal(p.eyebrow, 'Together with their families');
    assert.ok(p.accent, 'the colour still travels, to tint the mark');
  }
  const vintage = posterFor({ ...base, accent: '#9a244f', theme: 'vintage' });
  assert.equal(vintage.kind, 'invitation');
});

test('nothing chosen → the hub’s own invitation card, in the event’s words', () => {
  const wedding = posterFor(base);
  assert.equal(wedding.kind, 'invitation');
  assert.equal(wedding.eyebrow, 'Together with their families');
  assert.equal(wedding.line, 'invite you to celebrate their wedding');
  assert.deepEqual(wedding.names, { first: 'Maria', second: 'Jose' });

  const birthday = posterFor({ ...base, displayName: 'Ate Joy at 30', words: BIRTHDAY });
  assert.equal(birthday.eyebrow, 'You are invited');
  assert.equal(birthday.line, 'invites you to celebrate');
  assert.deepEqual(birthday.names, { first: 'Ate Joy at 30', second: null });
});

test('an ampersand in a one-person event’s name is not two people', () => {
  const p = posterFor({ ...base, displayName: 'Ayala & Partners Year-End', words: BIRTHDAY });
  assert.deepEqual(p.names, { first: 'Ayala & Partners Year-End', second: null });
});

test('the date is read off the calendar day and printed once; undated says so', () => {
  assert.deepEqual(posterDate('2026-12-12'), { weekday: 'Saturday', date: '12 December 2026' });
  assert.deepEqual(posterDate('2026-12-18T00:00:00+08:00'), { weekday: 'Friday', date: '18 December 2026' });
  assert.equal(posterDate(null), null);
  assert.equal(posterDate('soon'), null);
  const p = posterFor({ ...base, eventDate: null });
  assert.equal(p.date, null);
  assert.equal(p.weekday, null);
});

test('a host-writable colour never reaches a style unchecked', () => {
  assert.equal(safeAccent('#ABC'), '#aabbcc');
  assert.equal(safeAccent(' #9a244f '), '#9a244f');
  for (const bad of ['red', 'url(https://x)', '#12345', '#9a244f;background:red', 'var(--x)', 42, null]) {
    assert.equal(safeAccent(bad), null, String(bad));
    assert.equal(posterFor({ ...base, accent: bad }).kind, 'invitation', String(bad));
  }
});

test('ONE hero, ONE resolver: posterFor has exactly one caller, resolveEventPoster', () => {
  // Owner 2026-09-24: "hero widget applies to save the date, invitation, on the
  // day and the thumbnail poster". A second place that composes a poster from
  // its own inputs is how the thumbnail and the hero come to disagree.
  const web = join(dirname(fileURLToPath(import.meta.url)), '..');
  const hits = execFileSync('git', ['grep', '--untracked', '-l', '-F', 'posterFor(', '--', 'app', 'lib'], {
    cwd: web,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => f && !/\.test\.tsx?$/.test(f));
  assert.deepEqual(hits.sort(), ['lib/event-poster.server.ts', 'lib/event-poster.ts']);
  const server = readFileSync(join(web, 'lib/event-poster.server.ts'), 'utf8');
  assert.match(server, /resolveHubLook\(/, 'the poster stopped reading the theme through the hub resolver');
  assert.match(server, /eventWordsFor\(/, 'the poster stopped reading the hub card\'s words');
  const launcher = readFileSync(join(web, 'app/dashboard/(launcher)/page.tsx'), 'utf8');
  assert.match(launcher, /resolveEventPoster\(/, 'the board no longer asks the one resolver');
});
