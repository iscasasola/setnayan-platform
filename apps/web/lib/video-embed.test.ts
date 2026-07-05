/**
 * Unit suite for `parseVideoLink` — the Featured-videos link classifier
 * (Node built-in test runner via tsx · `pnpm test:unit`).
 *
 * Locks the platform/kind matrix the public vendor profile relies on:
 * YouTube + Vimeo become inline iframes with privacy-preserving embed URLs;
 * Instagram / Facebook / TikTok become click-through link cards; anything else
 * valid is a generic link; non-URLs and non-http(s) schemes are rejected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseVideoLink } from './video-embed';

test('YouTube watch URL → nocookie iframe', () => {
  const r = parseVideoLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(r?.platform, 'youtube');
  assert.equal(r?.kind, 'iframe');
  assert.equal(r?.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
});

test('youtu.be short URL → nocookie iframe', () => {
  const r = parseVideoLink('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(r?.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
});

test('YouTube Shorts URL → nocookie iframe', () => {
  const r = parseVideoLink('https://youtube.com/shorts/dQw4w9WgXcQ');
  assert.equal(r?.kind, 'iframe');
  assert.equal(r?.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
});

test('YouTube embed URL → nocookie iframe', () => {
  const r = parseVideoLink('https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(r?.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
});

test('bare youtu.be (no scheme) → iframe', () => {
  const r = parseVideoLink('youtu.be/dQw4w9WgXcQ');
  assert.equal(r?.platform, 'youtube');
  assert.equal(r?.kind, 'iframe');
});

test('malformed YouTube id → null', () => {
  assert.equal(parseVideoLink('https://youtube.com/watch?v=short'), null);
});

test('Vimeo numeric URL → player.vimeo iframe', () => {
  const r = parseVideoLink('https://vimeo.com/123456789');
  assert.equal(r?.platform, 'vimeo');
  assert.equal(r?.kind, 'iframe');
  assert.equal(r?.embedUrl, 'https://player.vimeo.com/video/123456789');
});

test('Vimeo user/ID URL → player.vimeo iframe', () => {
  const r = parseVideoLink('https://vimeo.com/user123/987654');
  assert.equal(r?.embedUrl, 'https://player.vimeo.com/video/987654');
});

test('player.vimeo embed URL → iframe', () => {
  const r = parseVideoLink('https://player.vimeo.com/video/555');
  assert.equal(r?.embedUrl, 'https://player.vimeo.com/video/555');
});

test('Instagram reel → link-out card', () => {
  const r = parseVideoLink('https://www.instagram.com/reel/Cabc123/');
  assert.equal(r?.platform, 'instagram');
  assert.equal(r?.kind, 'link');
  assert.equal(r?.embedUrl, undefined);
});

test('Instagram /p/ post → link-out card', () => {
  const r = parseVideoLink('https://instagram.com/p/Cxyz/');
  assert.equal(r?.platform, 'instagram');
  assert.equal(r?.kind, 'link');
});

test('Facebook watch → link-out card', () => {
  const r = parseVideoLink('https://www.facebook.com/watch/?v=100');
  assert.equal(r?.platform, 'facebook');
  assert.equal(r?.kind, 'link');
});

test('fb.watch → link-out card', () => {
  const r = parseVideoLink('https://fb.watch/abc/');
  assert.equal(r?.platform, 'facebook');
  assert.equal(r?.kind, 'link');
});

test('TikTok video → link-out card', () => {
  const r = parseVideoLink('https://www.tiktok.com/@user/video/7300000000000000000');
  assert.equal(r?.platform, 'tiktok');
  assert.equal(r?.kind, 'link');
});

test('vm.tiktok.com short → link-out card', () => {
  const r = parseVideoLink('https://vm.tiktok.com/ZXYabc/');
  assert.equal(r?.platform, 'tiktok');
  assert.equal(r?.kind, 'link');
});

test('generic http(s) URL → other link', () => {
  const r = parseVideoLink('https://example.com/my-film.mp4');
  assert.equal(r?.platform, 'other');
  assert.equal(r?.kind, 'link');
});

test('empty string → null', () => {
  assert.equal(parseVideoLink(''), null);
  assert.equal(parseVideoLink('   '), null);
});

test('javascript: scheme → null (XSS reject)', () => {
  assert.equal(parseVideoLink('javascript:alert(1)'), null);
});

test('data: scheme → null', () => {
  assert.equal(parseVideoLink('data:text/html,<script>1</script>'), null);
});

test('mailto: scheme → null', () => {
  assert.equal(parseVideoLink('mailto:a@b.com'), null);
});

test('plain non-URL text → null', () => {
  assert.equal(parseVideoLink('not a url at all'), null);
});
