import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeId,
  parseVideoRef,
  serializeVideoRef,
  deserializeVideoRef,
  videoEmbedUrl,
  videoThumb,
  type VideoRef,
} from './vendor-microsite';

// A canonical 11-char YouTube id used across the URL-form cases.
const YT = 'dQw4w9WgXcQ';

// ── YouTube (10 cases — must all stay green) ────────────────────────────────

test('YouTube #1 — bare 11-char id', () => {
  assert.equal(parseYouTubeId(YT), YT);
});

test('YouTube #2 — watch?v= URL', () => {
  assert.equal(parseYouTubeId(`https://www.youtube.com/watch?v=${YT}`), YT);
});

test('YouTube #3 — watch?v= with extra params', () => {
  assert.equal(
    parseYouTubeId(`https://www.youtube.com/watch?v=${YT}&t=42s&list=PL`),
    YT,
  );
});

test('YouTube #4 — youtu.be short link', () => {
  assert.equal(parseYouTubeId(`https://youtu.be/${YT}`), YT);
});

test('YouTube #5 — /embed/ link', () => {
  assert.equal(parseYouTubeId(`https://www.youtube.com/embed/${YT}`), YT);
});

test('YouTube #6 — /shorts/ link', () => {
  assert.equal(parseYouTubeId(`https://www.youtube.com/shorts/${YT}`), YT);
});

test('YouTube #7 — /live/ link', () => {
  assert.equal(parseYouTubeId(`https://www.youtube.com/live/${YT}`), YT);
});

test('YouTube #8 — youtube-nocookie embed', () => {
  assert.equal(
    parseYouTubeId(`https://www.youtube-nocookie.com/embed/${YT}`),
    YT,
  );
});

test('YouTube #9 — whitespace is trimmed', () => {
  assert.equal(parseYouTubeId(`  https://youtu.be/${YT}  `), YT);
});

test('YouTube #10 — junk rejected', () => {
  assert.equal(parseYouTubeId('not a video'), null);
  assert.equal(parseYouTubeId(''), null);
  assert.equal(parseYouTubeId(null), null);
});

// ── parseVideoRef · YouTube provider mapping + backward-compat ──────────────

test('parseVideoRef — bare 11-char id resolves to YouTube (backward-compat)', () => {
  assert.deepEqual(parseVideoRef(YT), { provider: 'youtube', id: YT });
});

test('parseVideoRef — YouTube watch URL', () => {
  assert.deepEqual(parseVideoRef(`https://www.youtube.com/watch?v=${YT}`), {
    provider: 'youtube',
    id: YT,
  });
});

test('parseVideoRef — youtu.be URL', () => {
  assert.deepEqual(parseVideoRef(`https://youtu.be/${YT}`), {
    provider: 'youtube',
    id: YT,
  });
});

// ── parseVideoRef · Vimeo (≥8 cases) ────────────────────────────────────────

test('Vimeo #1 — vimeo.com/{id}', () => {
  assert.deepEqual(parseVideoRef('https://vimeo.com/123456789'), {
    provider: 'vimeo',
    id: '123456789',
  });
});

test('Vimeo #2 — vimeo.com/{id}/{hash} unlisted share link', () => {
  assert.deepEqual(parseVideoRef('https://vimeo.com/123456789/abcdef0123'), {
    provider: 'vimeo',
    id: '123456789',
    hash: 'abcdef0123',
  });
});

test('Vimeo #3 — player.vimeo.com/video/{id}', () => {
  assert.deepEqual(parseVideoRef('https://player.vimeo.com/video/123456789'), {
    provider: 'vimeo',
    id: '123456789',
  });
});

test('Vimeo #4 — player.vimeo.com/video/{id}?h={hash}', () => {
  assert.deepEqual(
    parseVideoRef('https://player.vimeo.com/video/123456789?h=abcdef0123'),
    { provider: 'vimeo', id: '123456789', hash: 'abcdef0123' },
  );
});

test('Vimeo #5 — vimeo.com/video/{id}', () => {
  assert.deepEqual(parseVideoRef('https://vimeo.com/video/123456789'), {
    provider: 'vimeo',
    id: '123456789',
  });
});

test('Vimeo #6 — vimeo.com/channels/{x}/{id}', () => {
  assert.deepEqual(
    parseVideoRef('https://vimeo.com/channels/staffpicks/123456789'),
    { provider: 'vimeo', id: '123456789' },
  );
});

test('Vimeo #7 — vimeo.com/groups/{x}/videos/{id}', () => {
  assert.deepEqual(
    parseVideoRef('https://vimeo.com/groups/motion/videos/123456789'),
    { provider: 'vimeo', id: '123456789' },
  );
});

test('Vimeo #8 — bare numeric id resolves to Vimeo', () => {
  assert.deepEqual(parseVideoRef('123456789'), {
    provider: 'vimeo',
    id: '123456789',
  });
});

test('Vimeo #9 — www.vimeo.com host + trailing whitespace', () => {
  assert.deepEqual(parseVideoRef('  https://www.vimeo.com/987654321  '), {
    provider: 'vimeo',
    id: '987654321',
  });
});

// ── Rejections (Google Drive explicitly declined) ───────────────────────────

test('reject — Google Drive link (provider declined 2026-07-03)', () => {
  assert.equal(
    parseVideoRef('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/view'),
    null,
  );
});

test('reject — arbitrary non-video URL', () => {
  assert.equal(parseVideoRef('https://example.com/watch?v=nope'), null);
  assert.equal(parseVideoRef('https://dailymotion.com/video/x7abcde'), null);
});

test('reject — look-alike host cannot spoof Vimeo', () => {
  assert.equal(parseVideoRef('https://evilvimeo.com/123456789'), null);
  assert.equal(parseVideoRef('https://vimeo.com.evil.io/123456789'), null);
});

test('reject — empty / null / whitespace', () => {
  assert.equal(parseVideoRef(''), null);
  assert.equal(parseVideoRef('   '), null);
  assert.equal(parseVideoRef(null), null);
  assert.equal(parseVideoRef(undefined), null);
});

// ── Serialize / deserialize round-trips ─────────────────────────────────────

test('serialize — YouTube stays a bare id; Vimeo is provider-prefixed', () => {
  assert.equal(serializeVideoRef({ provider: 'youtube', id: YT }), YT);
  assert.equal(
    serializeVideoRef({ provider: 'vimeo', id: '123456789' }),
    'vimeo:123456789',
  );
  assert.equal(
    serializeVideoRef({ provider: 'vimeo', id: '123456789', hash: 'abc123' }),
    'vimeo:123456789:abc123',
  );
});

test('deserialize — bare 11-char stays YouTube (legacy rows)', () => {
  assert.deepEqual(deserializeVideoRef(YT), { provider: 'youtube', id: YT });
});

test('deserialize — vimeo:{id} and vimeo:{id}:{hash}', () => {
  assert.deepEqual(deserializeVideoRef('vimeo:123456789'), {
    provider: 'vimeo',
    id: '123456789',
  });
  assert.deepEqual(deserializeVideoRef('vimeo:123456789:abc123'), {
    provider: 'vimeo',
    id: '123456789',
    hash: 'abc123',
  });
});

test('deserialize — round-trips every parseVideoRef output', () => {
  const inputs = [
    YT,
    `https://youtu.be/${YT}`,
    'https://vimeo.com/123456789',
    'https://vimeo.com/123456789/abcdef0123',
    'https://player.vimeo.com/video/555?h=zzz111',
  ];
  for (const raw of inputs) {
    const ref = parseVideoRef(raw);
    assert.ok(ref, `expected a ref for ${raw}`);
    const stored = serializeVideoRef(ref as VideoRef);
    assert.deepEqual(deserializeVideoRef(stored), ref, `round-trip ${raw}`);
  }
});

test('deserialize — malformed / declined data rejected', () => {
  assert.equal(deserializeVideoRef('vimeo:not-a-number'), null);
  assert.equal(deserializeVideoRef(''), null);
  assert.equal(deserializeVideoRef(null), null);
});

// ── Embed URLs + thumbnails ─────────────────────────────────────────────────

test('embed URL — YouTube uses youtube-nocookie', () => {
  assert.equal(
    videoEmbedUrl({ provider: 'youtube', id: YT }),
    `https://www.youtube-nocookie.com/embed/${YT}`,
  );
});

test('embed URL — Vimeo uses player.vimeo.com with dnt=1 (+h= when hash)', () => {
  assert.equal(
    videoEmbedUrl({ provider: 'vimeo', id: '123456789' }),
    'https://player.vimeo.com/video/123456789?dnt=1',
  );
  assert.equal(
    videoEmbedUrl({ provider: 'vimeo', id: '123456789', hash: 'abc123' }),
    'https://player.vimeo.com/video/123456789?dnt=1&h=abc123',
  );
});

test('thumb — YouTube deterministic, Vimeo null (needs oEmbed fallback)', () => {
  assert.equal(
    videoThumb({ provider: 'youtube', id: YT }),
    `https://i.ytimg.com/vi/${YT}/hqdefault.jpg`,
  );
  assert.equal(videoThumb({ provider: 'vimeo', id: '123456789' }), null);
});
