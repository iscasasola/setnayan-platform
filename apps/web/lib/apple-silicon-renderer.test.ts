/**
 * apple-silicon-renderer.test.ts — Safari on an Apple-silicon Mac is not told it might be an Intel Mac (sweep B4).
 *
 * SABOTAGE: drop the `Apple GPU` alternative from `rendererLooksAppleSilicon` → the Safari case goes RED.
 * SABOTAGE: inline a fresh `/Apple M\d/` test in the banner instead of calling this → the mount test goes RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rendererLooksAppleSilicon } from './apple-silicon-renderer';
import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('an Apple-silicon Mac reads as one in every browser, Safari included', () => {
  for (const r of [
    'Apple GPU', // Safari (always masked) — the case the sweep caught
    'Apple M1',
    'Apple M3 Max',
    'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)',
    'ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)',
  ]) {
    assert.equal(rendererLooksAppleSilicon(r), true, `"${r}" is an Apple-silicon Mac`);
  }
});

test('an Intel or AMD GPU, or no answer at all, still earns the OBS nudge', () => {
  for (const r of [
    'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 655, OpenGL 4.1)',
    'Intel(R) UHD Graphics 630',
    'ANGLE (AMD, AMD Radeon Pro 5500M OpenGL Engine, OpenGL 4.1)',
    'AMD Radeon Pro 560X',
    '',
  ]) {
    assert.equal(rendererLooksAppleSilicon(r), false, `"${r}" is not an Apple-silicon Mac`);
  }
});

test('the download banner decides with THIS check, not a copy of it', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/download/_download-motion.tsx'), 'utf8'));
  const banner = src.slice(src.indexOf('export function PlatformCompatBanner'));
  assert.ok(banner.length > 0, 'PlatformCompatBanner not found — has it moved?');
  assert.match(banner, /rendererLooksAppleSilicon\(renderer\)/, 'the banner must call rendererLooksAppleSilicon');
  assert.doesNotMatch(banner, /Apple M\\d/, 'the banner re-grew its own renderer regex — Safari says "Apple GPU"');
});
