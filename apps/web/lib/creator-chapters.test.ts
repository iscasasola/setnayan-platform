/**
 * Unit suite for `normalizeEmbed` — the Creator "Adventure Chapter" embed
 * allowlist + normalizer (Node built-in test runner via tsx · `pnpm test:unit`).
 *
 * This is the security choke point (red line: embeds are provider-allowlisted +
 * normalized to a privacy-enhanced embed src; only the normalized URL is ever
 * stored/rendered). The suite locks: allowlisted providers resolve to their
 * canonical embed src; non-allowlisted hosts and non-http(s) schemes are
 * rejected; bare profile links (no embeddable media) are rejected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEmbed } from './creator-chapters';

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
