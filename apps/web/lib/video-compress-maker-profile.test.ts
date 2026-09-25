/**
 * The Event Hub Maker's `'maker'` video-compress profile (Phase 4,
 * DECISION_LOG 2026-09-25: "yes. 1080p. for the background video no sound.").
 *
 * `compressVideoForWeb` only runs against a real `<video>`/ffmpeg.wasm in a
 * browser — `canCompressVideo()` returns false under plain Node (no `window`),
 * so the encode branch never executes in this suite. Source-scanned instead,
 * the same way `lib/vendor-captures-compress.test.ts` verifies a different
 * file's encode contract: read the file, strip comments so a docblock mention
 * can't fake a pass, and assert the real code contains the settings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_PATH = join(import.meta.dirname, 'video-compress.ts');
const raw = readFileSync(SRC_PATH, 'utf8');
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the maker profile is 1080p (1920 long edge), not the quality path\'s 4K', () => {
  assert.match(code, /MAKER_LONG_EDGE\s*=\s*1920/);
});

test('the maker profile encodes CRF 23 with a ~1.9M maxrate — the theme-loop setting', () => {
  assert.match(code, /MAKER_CRF\s*=\s*'23'/);
  assert.match(code, /MAKER_MAXRATE\s*=\s*'1\.9M'/);
});

test('the maker profile always writes faststart', () => {
  // `+faststart` is written unconditionally in the shared exec() call every
  // profile shares — assert the flag exists at all, since maker takes the
  // same branch as quality/web720 rather than a separate exec() call.
  assert.match(code, /'\+faststart'/);
});

test('a background clip strips audio entirely with -an', () => {
  assert.match(code, /stripAudio\s*=\s*isMaker\s*&&\s*opts\.silent\s*===\s*true/);
  assert.match(code, /stripAudio\s*\?\s*\[\s*'-an'\s*\]/);
});

test('a content clip (silent not set) keeps a SMALL audio track, distinct from the quality path\'s 192k', () => {
  assert.match(code, /MAKER_AUDIO_BITRATE\s*=\s*'96k'/);
  // The bitrate actually selected for the maker branch must reference the
  // maker constant, not silently fall through to the quality path's 192k.
  assert.match(code, /isMaker\s*\?\s*MAKER_AUDIO_BITRATE\s*:\s*AUDIO_BITRATE/);
});

test('the maker profile never SKIPS (unlike quality) — a background clip must always lose its audio', () => {
  assert.match(code, /if\s*\(!isWebCopy\s*&&\s*!isMaker\)\s*\{/);
});

test('a forced maker re-encode is KEPT even if it did not shrink — same rule as the duration trim', () => {
  assert.match(code, /mustKeepOutput\s*=\s*needsTrim\s*\|\|\s*\(isMaker\s*&&\s*opts\.silent\s*===\s*true\)/);
  assert.match(code, /!mustKeepOutput\s*&&\s*bytes\.byteLength\s*>=\s*file\.size/);
});

test('the profile union names all three profiles, so a typo cannot silently fall through to quality', () => {
  assert.match(code, /profile\?:\s*'quality'\s*\|\s*'web720'\s*\|\s*'maker'/);
});
