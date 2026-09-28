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
  ANY_PHOTO_SAMPLES,
  posterDate,
  posterFor,
  safeAccent,
  type EventPosterFacts,
} from './event-poster';
import { AA_BODY, compositeOver, contrastRatio } from './hub-legibility';
import { INVITE_THEMES, INVITE_THEME_IDS } from './invite-themes';

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

test('the couple’s own hero photo wins over their colour, their theme and their background', () => {
  const p = posterFor({
    ...base,
    heroSrc: 'https://r2.example/hero.jpg',
    backgroundSrc: 'https://r2.example/std-bg.webp',
    themeStillSrc: 'https://media.example/vintage-poster.jpg',
    accent: '#9a244f',
    theme: 'vintage',
  });
  assert.equal(p.kind, 'photo');
  assert.equal(p.photoSrc, 'https://r2.example/hero.jpg');
  assert.equal(p.ground, 'hero');
  assert.ok(p.legibility, 'a photo cover carries the hub legibility tones');
});

// ── 2026-09-29 owner report: a Pro event with a Save-the-Date background and a
//    Pro theme drew as plain white paper — "did not adjust to the event cover".
test('a Pro event with a Save-the-Date background and no hero photo wears the background', () => {
  const p = posterFor({
    ...base,
    theme: 'vintage',
    backgroundSrc: 'https://r2.example/std-bg.webp',
    themeStillSrc: 'https://media.example/vintage-poster.jpg',
  });
  assert.equal(p.kind, 'photo', 'the card must not fall to the plain invitation paper');
  assert.equal(p.ground, 'background');
  assert.equal(p.photoSrc, 'https://r2.example/std-bg.webp');
});

test('a Pro theme with no photo of theirs wears the theme’s still — the invitation card in their theme', () => {
  const p = posterFor({ ...base, theme: 'velvet', themeStillSrc: 'https://media.example/luxe-poster.jpg' });
  assert.equal(p.kind, 'theme');
  assert.equal(p.ground, 'theme');
  assert.equal(p.photoSrc, 'https://media.example/luxe-poster.jpg');
  assert.equal(p.eyebrow, 'Together with their families', 'the card keeps the hub card’s words');
  assert.equal(p.line, 'invite you to celebrate their wedding');
  assert.equal(p.dark, true, 'Luxe is a dark ground, so the card’s chips go dark glass');
});

test('Classic has no art, so a still handed to it is ignored — the paper card stays', () => {
  const p = posterFor({ ...base, theme: 'house', themeStillSrc: 'https://media.example/stray.jpg' });
  assert.equal(p.kind, 'invitation');
  assert.equal(p.photoSrc, null);
  assert.equal(p.legibility, null);
});

test('a wake keeps its quiet masthead even with a background and a theme', () => {
  const p = posterFor({
    ...base,
    words: WAKE,
    theme: 'vintage',
    backgroundSrc: 'https://r2.example/std-bg.webp',
    themeStillSrc: 'https://media.example/vintage-poster.jpg',
  });
  assert.equal(p.kind, 'quiet');
  assert.equal(p.photoSrc, null);
});

/** The `--hub-scrim` rgba back into a hex + opacity, as the browser paints it. */
function scrimOf(p: EventPosterFacts): { color: string; opacity: number } {
  const m = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(p.legibility?.['--hub-scrim'] ?? '');
  assert.ok(m, `unreadable scrim ${p.legibility?.['--hub-scrim']}`);
  const hex = `#${[m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`;
  return { color: hex, opacity: Number(m[4]) };
}

test('the words on a photo cover clear AA over ANY photo, for every theme', () => {
  for (const theme of INVITE_THEME_IDS) {
    const p = posterFor({ ...base, theme, backgroundSrc: 'https://r2.example/std-bg.webp' });
    const ink = p.legibility?.['--hub-ink'];
    assert.ok(ink, theme);
    const scrim = scrimOf(p);
    assert.ok(scrim.opacity > 0, `${theme}: an unsampled photo needs a veil`);
    for (const pixel of ANY_PHOTO_SAMPLES) {
      const ground = compositeOver(scrim.color, scrim.opacity, pixel);
      assert.ok(contrastRatio(ink, ground) >= AA_BODY - 0.01, `${theme}: ink ${ink} over ${pixel} under the veil`);
    }
  }
});

test('the words on a theme cover clear AA over the theme’s measured still', () => {
  for (const theme of INVITE_THEME_IDS) {
    const media = INVITE_THEMES[theme].media;
    if (!media) continue;
    const p = posterFor({ ...base, theme, themeStillSrc: 'https://media.example/still.jpg' });
    assert.equal(p.kind, 'theme', theme);
    const ink = p.legibility!['--hub-ink']!;
    const scrim = scrimOf(p);
    for (const pixel of [media.samples.light, media.samples.dark]) {
      const ground = compositeOver(scrim.color, scrim.opacity, pixel);
      assert.ok(contrastRatio(ink, ground) >= AA_BODY - 0.01, `${theme}: ink ${ink} over ${pixel}`);
    }
  }
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

test('the Save-the-Date background reaches the poster: read by both callers, handed to the hub resolver', () => {
  // The 2026-09-29 defect was a column nobody read: the poster asked
  // `resolveHubLook` without `std_background`, so `look.photo` was always null.
  // The type makes the field REQUIRED; these hold the reads that fill it,
  // because a select string that drops the column still compiles.
  const web = join(dirname(fileURLToPath(import.meta.url)), '..');
  const server = readFileSync(join(web, 'lib/event-poster.server.ts'), 'utf8');
  assert.match(server, /std_background:\s*event\.std_background/, 'the resolver stopped handing the background to resolveHubLook');
  assert.match(server, /backgroundSrc:\s*look\?\.photo/, 'the resolver stopped handing the gated background to posterFor');
  assert.match(server, /resolveThemeGround\(/, 'the resolver stopped reading the theme still from the hub ground');
  const launcher = readFileSync(join(web, 'app/dashboard/(launcher)/page.tsx'), 'utf8');
  assert.match(launcher, /\.select\('event_id, invite_theme, std_background'\)/, 'the board stopped reading the background');
  const maker = readFileSync(join(web, 'app/dashboard/[eventId]/launch/_components/maker-made-once.tsx'), 'utf8');
  assert.match(maker, /const EVENT_SELECT =\s*'[^']*\bstd_background\b/, 'the Maker’s poster preview stopped reading the background');
});
