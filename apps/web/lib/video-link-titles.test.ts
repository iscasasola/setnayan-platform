import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIDEO_TITLE_MAX, videoLinkHost, videoRowName, videoTitlesFor, videoTitlesOf } from './video-link-titles';

test('a stored map reads only string titles, trimmed and capped', () => {
  assert.deepEqual(videoTitlesOf(null), {});
  assert.deepEqual(videoTitlesOf([]), {});
  assert.deepEqual(videoTitlesOf({ a: '  Same-day edit ', b: 3, c: '   ', d: 'x'.repeat(90) }), {
    a: 'Same-day edit',
    d: 'x'.repeat(VIDEO_TITLE_MAX),
  });
});

test('titles are keyed by the link and leave with it', () => {
  const links = ['https://youtu.be/a', 'https://vimeo.com/1'];
  const out = videoTitlesFor(links, [
    ['https://youtu.be/a', ' Ana & Ben '],
    ['https://vimeo.com/1', ''],
    ['https://gone.example/x', 'Removed link'],
  ]);
  assert.deepEqual(out, { 'https://youtu.be/a': 'Ana & Ben' });
});

test('the first title for a link wins (a duplicate pair cannot overwrite it)', () => {
  assert.deepEqual(videoTitlesFor(['u'], [['u', 'one'], ['u', 'two']]), { u: 'one' });
});

test('a row without a title says the link host', () => {
  assert.equal(videoLinkHost('https://www.youtube.com/watch?v=1'), 'youtube.com');
  assert.equal(videoLinkHost('not a url'), 'not a url');
  assert.equal(videoRowName('https://vimeo.com/2', {}), 'vimeo.com');
  assert.equal(videoRowName('https://vimeo.com/2', { 'https://vimeo.com/2': 'Teaser' }), 'Teaser');
  assert.equal(videoRowName('https://vimeo.com/2', null), 'vimeo.com');
});

test('the save writes titles only when the editor read them, keyed by the stored link', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const src = readFileSync(join(import.meta.dirname, '..', 'app/vendor-dashboard/actions.ts'), 'utf8');
  const arm = src.slice(src.indexOf("case 'gallery_videos': {"), src.indexOf('default:', src.indexOf("case 'gallery_videos': {")));
  assert.match(arm, /if \(formData\.get\('gallery_video_titles_sent'\) === '1'\) \{/, 'titles are written even when the editor never read them');
  assert.match(arm, /gallery_video_titles: videoTitlesFor\(links, pairs\)/, 'titles are not keyed by the stored links');
});
