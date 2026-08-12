/**
 * Unit suite for `normalizeEmbed` — the Creator "Adventure Chapter" embed
 * allowlist + normalizer (Node built-in test runner via tsx · `pnpm test:unit`).
 *
 * This is the security choke point (red line: embeds are provider-allowlisted +
 * normalized to a privacy-enhanced embed src; only the normalized URL is ever
 * stored/rendered). The suite locks: allowlisted providers resolve to their
 * canonical embed src; non-allowlisted hosts and non-http(s) schemes are
 * rejected; bare profile links (no embeddable media) are rejected.
 *
 * Also covers `rankChaptersByPublishedAt` (E5 — profile timeline numbering + the
 * latest-chapter poster), whose whole reason to exist is that `chapters[0]` is
 * NOT reliably the newest chapter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAPTER_BODY_MAX,
  chapterExcerpt,
  chapterHasReadableContent,
  normalizeChapterBody,
  normalizeEmbed,
  rankChaptersByPublishedAt,
  splitChapterParagraphs,
} from './creator-chapters';

test('YouTube watch URL → youtube-nocookie embed', () => {
  assert.deepEqual(normalizeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), {
    provider: 'youtube',
    embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  });
});

test('youtu.be short link → nocookie embed', () => {
  assert.deepEqual(normalizeEmbed('youtu.be/dQw4w9WgXcQ'), {
    provider: 'youtube',
    embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  });
});

test('Instagram reel → /reel/{code}/embed', () => {
  assert.deepEqual(normalizeEmbed('https://www.instagram.com/reel/Cabc123DEF/'), {
    provider: 'instagram',
    embedUrl: 'https://www.instagram.com/reel/Cabc123DEF/embed',
  });
});

test('Instagram post → /p/{code}/embed', () => {
  assert.deepEqual(normalizeEmbed('https://instagram.com/p/Cxyz789/'), {
    provider: 'instagram',
    embedUrl: 'https://www.instagram.com/p/Cxyz789/embed',
  });
});

test('TikTok video URL → /embed/v2/{id}', () => {
  assert.deepEqual(normalizeEmbed('https://www.tiktok.com/@creator/video/7212345678901234567'), {
    provider: 'tiktok',
    embedUrl: 'https://www.tiktok.com/embed/v2/7212345678901234567',
  });
});

test('Instagram bare profile (no embeddable media) → null', () => {
  assert.equal(normalizeEmbed('https://instagram.com/somebody'), null);
});

test('vm.tiktok.com short link (unresolvable) → null', () => {
  assert.equal(normalizeEmbed('https://vm.tiktok.com/ZMabc123/'), null);
});

test('non-allowlisted host (vimeo) → null', () => {
  assert.equal(normalizeEmbed('https://vimeo.com/123456'), null);
});

test('javascript: scheme → null', () => {
  assert.equal(normalizeEmbed('javascript:alert(1)'), null);
});

test('data: scheme → null', () => {
  assert.equal(normalizeEmbed('data:text/html,<script>alert(1)</script>'), null);
});

test('empty / whitespace → null', () => {
  assert.equal(normalizeEmbed('   '), null);
  assert.equal(normalizeEmbed(''), null);
});

/**
 * E5 — profile timeline numbering + the latest-chapter poster
 * (`rankChaptersByPublishedAt`).
 *
 * The one that matters: the profile read orders `published_at` DESC, and
 * Postgres DESC is NULLS FIRST. `chapters[0]` is therefore NOT reliably the
 * newest chapter — an undated published row sorts above it. These lock that the
 * ranking comes from parsed dates, and that an undated row is neither numbered
 * nor crowned "latest" rather than being guessed at.
 */

test('numbers oldest-first regardless of the DESC input order', () => {
  // As fetchPublishedChapters returns them: newest first.
  const r = rankChaptersByPublishedAt([
    '2026-03-01T00:00:00Z',
    '2026-02-01T00:00:00Z',
    '2026-01-01T00:00:00Z',
  ]);
  assert.equal(r.numberByIndex.get(2), 1); // oldest reads "Chapter 1"
  assert.equal(r.numberByIndex.get(1), 2);
  assert.equal(r.numberByIndex.get(0), 3);
  assert.equal(r.newestIndex, 0);
  assert.equal(r.showLatest, true);
});

test('NULLS FIRST trap — an undated row leading the list is NOT the latest', () => {
  const r = rankChaptersByPublishedAt([
    null, // Postgres DESC puts this first; index 0 would be the wrong answer.
    '2026-03-01T00:00:00Z',
    '2026-01-01T00:00:00Z',
  ]);
  assert.equal(r.newestIndex, 1, 'the newest DATED row wins, not index 0');
  assert.equal(r.numberByIndex.has(0), false, 'an undated row gets no number');
  assert.equal(r.numberByIndex.get(2), 1);
  assert.equal(r.numberByIndex.get(1), 2);
});

test('an unparseable date is treated as undated, not as epoch 0', () => {
  const r = rankChaptersByPublishedAt(['not-a-date', '2026-01-01T00:00:00Z']);
  assert.equal(r.numberByIndex.has(0), false);
  assert.equal(r.newestIndex, 1);
  assert.equal(r.showLatest, false, 'one dated row → "Latest" says nothing');
});

test('a single dated chapter is numbered but never labelled Latest', () => {
  const r = rankChaptersByPublishedAt(['2026-01-01T00:00:00Z']);
  assert.equal(r.numberByIndex.get(0), 1);
  assert.equal(r.newestIndex, 0, 'the poster still renders on a set of one');
  assert.equal(r.showLatest, false);
});

test('nothing dated → no number, no poster, no Latest', () => {
  const r = rankChaptersByPublishedAt([null, undefined]);
  assert.equal(r.numberByIndex.size, 0);
  assert.equal(r.newestIndex, -1);
  assert.equal(r.showLatest, false);
});

test('an empty list is inert', () => {
  const r = rankChaptersByPublishedAt([]);
  assert.equal(r.numberByIndex.size, 0);
  assert.equal(r.newestIndex, -1);
  assert.equal(r.showLatest, false);
});

// ───────────────────────────────────────────────────────────────────────────
// THE STORY IS THE CHAPTER (owner 2026-08-12) — body normalization, paragraph
// splitting, the excerpt, and the publishability test that REPLACED `!!embed_url`.
//
// Why these are locked: requiring an embed meant only somebody who already
// posts video on YouTube/Instagram/TikTok could ever be a storyteller, which is
// the measured reason prod held 0 chapters and 0 public profiles. The publish
// gate was only the visible half — three read paths carried the same `embed_url`
// test, so a video-less story would have published "successfully" into nowhere.
// ───────────────────────────────────────────────────────────────────────────

test('normalizeChapterBody: CRLF collapses, runs of blank lines cap at one', () => {
  assert.equal(
    normalizeChapterBody('One\r\n\r\n\r\n\r\nTwo'),
    'One\n\nTwo',
  );
});

test('normalizeChapterBody: trims ends + trailing spaces, keeps inner single newlines', () => {
  // LEADING whitespace on an interior line is deliberately PRESERVED — a writer
  // may indent, and we are not in the business of reformatting their prose.
  assert.equal(normalizeChapterBody('  A line   \nsecond line  \n\n  B  '), 'A line\nsecond line\n\n  B');
});

test('normalizeChapterBody + splitChapterParagraphs: indentation never reaches the page', () => {
  // The pair is what the reader actually sees: whatever indentation survives
  // storage is trimmed per-paragraph at render, so the two functions together
  // produce clean output without normalize() having to rewrite the writing.
  assert.deepEqual(
    splitChapterParagraphs(normalizeChapterBody('  A line   \nsecond line  \n\n  B  ')),
    ['A line\nsecond line', 'B'],
  );
});

test('normalizeChapterBody: non-string and blank input become the empty string', () => {
  assert.equal(normalizeChapterBody(undefined), '');
  assert.equal(normalizeChapterBody(null), '');
  assert.equal(normalizeChapterBody('   \n\n  '), '');
});

test('normalizeChapterBody: caps at CHAPTER_BODY_MAX', () => {
  assert.equal(normalizeChapterBody('x'.repeat(CHAPTER_BODY_MAX + 500)).length, CHAPTER_BODY_MAX);
});

test('splitChapterParagraphs: a blank line starts a new paragraph', () => {
  assert.deepEqual(splitChapterParagraphs('First para.\n\nSecond para.\n\n\nThird.'), [
    'First para.',
    'Second para.',
    'Third.',
  ]);
});

test('splitChapterParagraphs: a SINGLE newline stays inside one paragraph', () => {
  // This is the pre-line contract — a writer keeping a line break inside a
  // stanza must not have it promoted to a new <p>.
  assert.deepEqual(splitChapterParagraphs('Line one\nLine two'), ['Line one\nLine two']);
});

test('splitChapterParagraphs: nothing in, nothing out (never [""])', () => {
  assert.deepEqual(splitChapterParagraphs(''), []);
  assert.deepEqual(splitChapterParagraphs(null), []);
  assert.deepEqual(splitChapterParagraphs('   \n\n   '), []);
});

test('chapterExcerpt: takes the FIRST paragraph, flattened', () => {
  assert.equal(chapterExcerpt('The opening line.\nstill first\n\nSecond para.'), 'The opening line. still first');
});

test('chapterExcerpt: truncates on a word boundary with an ellipsis', () => {
  const out = chapterExcerpt('alpha bravo charlie delta echo foxtrot', 20)!;
  assert.ok(out.endsWith('…'), `expected ellipsis, got ${out}`);
  assert.ok(out.length <= 21, `expected <= 21 chars, got ${out.length}`);
  assert.ok(!/\s…$/.test(out), 'must not leave a space before the ellipsis');
  // Word boundary: the truncation point is not mid-word.
  assert.ok('alpha bravo charlie delta echo foxtrot'.startsWith(out.slice(0, -1)));
});

test('chapterExcerpt: no body → null (callers must NOT fall back to the title)', () => {
  assert.equal(chapterExcerpt(null), null);
  assert.equal(chapterExcerpt('   '), null);
});

test('chapterHasReadableContent: a written story with NO video is readable', () => {
  // THE REGRESSION. `!!embed_url` returned false here and dropped the chapter
  // from its own author's profile timeline.
  assert.equal(chapterHasReadableContent({ body: 'We got married in Batanes.', embed_url: null }), true);
});

test('chapterHasReadableContent: a video with no story is still readable (legacy rows)', () => {
  assert.equal(
    chapterHasReadableContent({ body: null, embed_url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }),
    true,
  );
});

test('chapterHasReadableContent: neither → false, and whitespace is not a story', () => {
  assert.equal(chapterHasReadableContent({ body: null, embed_url: null }), false);
  assert.equal(chapterHasReadableContent({ body: '   \n  ', embed_url: '  ' }), false);
});
