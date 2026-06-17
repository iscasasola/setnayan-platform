/**
 * Unit suite for the Save-the-Date film auto-fill resolver (P2). The resolver
 * shapes the couple's existing data into the film's beats — a wrong monogram,
 * a leaked stale date, or an unbounded gallery all show up on a guest-facing
 * page, so the edges (overrides, missing date, truncation, capping) are pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveMonogram,
  shortDate,
  resolveStdFilmContent,
} from './save-the-date-content';

const PUBLIC_ID = 'S89E-7H2K9MNP3Q';

// ---- deriveMonogram -------------------------------------------------------

test('deriveMonogram: ampersand-joined names → two initials', () => {
  assert.equal(deriveMonogram('Maria & Jose'), 'M & J');
});

test('deriveMonogram: "and"-joined names → two initials', () => {
  assert.equal(deriveMonogram('maria and jose'), 'M & J');
});

test('deriveMonogram: plus-joined names → two initials', () => {
  assert.equal(deriveMonogram('Ana + Ben'), 'A & B');
});

test('deriveMonogram: a single name → one initial', () => {
  assert.equal(deriveMonogram('Maria'), 'M');
});

test('deriveMonogram: empty → the floral fallback', () => {
  assert.equal(deriveMonogram('   '), '✦');
});

// ---- shortDate ------------------------------------------------------------

test('shortDate: ISO date → compact MM.DD.YY', () => {
  assert.equal(shortDate('2027-06-12'), '06.12.27');
});

test('shortDate: null → null', () => {
  assert.equal(shortDate(null), null);
});

test('shortDate: garbage → null (never throws)', () => {
  assert.equal(shortDate('not-a-date'), null);
});

// ---- resolveStdFilmContent ------------------------------------------------

test('resolveStdFilmContent: full input fills every beat', () => {
  const c = resolveStdFilmContent({
    displayName: 'Maria & Jose',
    dateIso: '2027-06-12',
    venueName: 'Blanco Gardens',
    venueAddress: 'Tagaytay',
    loveStory: 'We met at a wedding and never left.',
    publicId: PUBLIC_ID,
    musicUrl: 'https://media.example/song.mp3',
    galleryUrls: ['https://a', 'https://b'],
  });
  assert.equal(c.monogram, 'M & J');
  assert.equal(c.names, 'Maria & Jose');
  assert.equal(c.dateBig, '06.12.27');
  assert.ok(c.dateLabel && c.dateLabel.length > 0, 'dateLabel present');
  assert.equal(c.venueName, 'Blanco Gardens');
  assert.equal(c.venueCity, 'Tagaytay');
  assert.equal(c.storyTeaser, 'We met at a wedding and never left.');
  assert.ok(c.gcalUrl && c.gcalUrl.startsWith('https://calendar.google.com'));
  assert.ok(c.icsHref && c.icsHref.startsWith('data:text/calendar'));
  assert.ok(c.icsFilename.endsWith('-save-the-date.ics'));
  assert.equal(c.musicUrl, 'https://media.example/song.mp3');
  assert.deepEqual(c.gallery, ['https://a', 'https://b']);
});

test('resolveStdFilmContent: an explicit monogram override beats the derived one', () => {
  const c = resolveStdFilmContent({
    displayName: 'Maria & Jose',
    monogramText: 'MJ',
    dateIso: '2027-06-12',
    publicId: PUBLIC_ID,
  });
  assert.equal(c.monogram, 'MJ');
});

test('resolveStdFilmContent: a blank override falls back to derived', () => {
  const c = resolveStdFilmContent({
    displayName: 'Maria & Jose',
    monogramText: '   ',
    dateIso: '2027-06-12',
    publicId: PUBLIC_ID,
  });
  assert.equal(c.monogram, 'M & J');
});

test('resolveStdFilmContent: no date → no date card and no calendar actions', () => {
  const c = resolveStdFilmContent({
    displayName: 'Maria & Jose',
    dateIso: null,
    publicId: PUBLIC_ID,
  });
  assert.equal(c.dateBig, null);
  assert.equal(c.dateLabel, null);
  assert.equal(c.gcalUrl, null);
  assert.equal(c.icsHref, null);
});

test('resolveStdFilmContent: a long love story is teased to ≤120 chars with an ellipsis', () => {
  const c = resolveStdFilmContent({
    displayName: 'A & B',
    dateIso: '2027-06-12',
    loveStory: 'x'.repeat(200),
    publicId: PUBLIC_ID,
  });
  assert.ok(c.storyTeaser, 'teaser present');
  assert.ok(c.storyTeaser!.endsWith('…'));
  assert.ok(c.storyTeaser!.length <= 120);
});

test('resolveStdFilmContent: a non-string love story → no story beat', () => {
  const c = resolveStdFilmContent({
    displayName: 'A & B',
    dateIso: '2027-06-12',
    loveStory: { not: 'a string' },
    publicId: PUBLIC_ID,
  });
  assert.equal(c.storyTeaser, null);
});

test('resolveStdFilmContent: gallery drops empties and caps at 6', () => {
  const c = resolveStdFilmContent({
    displayName: 'A & B',
    dateIso: '2027-06-12',
    publicId: PUBLIC_ID,
    galleryUrls: ['1', '', '2', '3', '4', '5', '6', '7', '8'],
  });
  assert.equal(c.gallery!.length, 6);
  assert.ok(!c.gallery!.includes(''));
  assert.deepEqual(c.gallery, ['1', '2', '3', '4', '5', '6']);
});

test('resolveStdFilmContent: absent music + gallery degrade to silent + empty', () => {
  const c = resolveStdFilmContent({
    displayName: 'A & B',
    dateIso: '2027-06-12',
    publicId: PUBLIC_ID,
  });
  assert.equal(c.musicUrl, null);
  assert.deepEqual(c.gallery, []);
});
