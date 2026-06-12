/**
 * Cipher Monogram engine invariants (node:test via tsx — `pnpm test:unit`).
 *
 * Exercises the PURE pipeline against the REAL prebuilt geometry in
 * public/cipher/ (the same JSON the editor + save action consume), so a
 * regression in the prebuild, the sanitizer, or the renderer fails here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  sanitizeCipherConfig,
  defaultCipherConfig,
  CIPHER_FONTS,
  cipherFontDataUrl,
} from './cipher-shared';
import { renderCipher, type CipherFontData } from './cipher-render';
import { connectNearest, penOutline, resample } from './calligraphy';

const PUB = join(import.meta.dirname, '../public');
function loadFont(key: string): CipherFontData {
  const font = CIPHER_FONTS.find((f) => f.key === key)!;
  const rel = cipherFontDataUrl(font);
  return JSON.parse(readFileSync(join(PUB, rel), 'utf8')) as CipherFontData;
}

test('prebuilt geometry exists + has full A–Z for every registered font', () => {
  for (const f of CIPHER_FONTS) {
    const data = loadFont(f.key);
    assert.equal(data.kind, f.kind, `${f.key}: kind matches registry`);
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      assert.ok(data.glyphs[ch], `${f.key}: glyph ${ch} present`);
    }
  }
});

test('sanitizeCipherConfig: clamps, normalizes, enforces mode/kind coherence', () => {
  // Garbage → null.
  assert.equal(sanitizeCipherConfig(null), null);
  assert.equal(sanitizeCipherConfig({ fontKey: 'nope' }), null);
  assert.equal(
    sanitizeCipherConfig({ fontKey: 'allure', initials: ['1', '@'] }),
    null,
    'non-letters rejected',
  );
  // Restroke on a filled font downgrades to overlap.
  const c1 = sanitizeCipherConfig({
    ...defaultCipherConfig('A', 'G'),
    fontKey: 'cinzel',
    mode: 'restroke',
  })!;
  assert.equal(c1.mode, 'overlap');
  // Weave on a stroke font downgrades to overlap.
  const c2 = sanitizeCipherConfig({
    ...defaultCipherConfig('A', 'G'),
    fontKey: 'allure',
    mode: 'weave',
  })!;
  assert.equal(c2.mode, 'overlap');
  // Extremes clamp.
  const c3 = sanitizeCipherConfig({
    ...defaultCipherConfig('a', 'g'),
    gap: 9999,
    tension: -5,
    letters: [
      { x: 1e9, y: -1e9, scale: 99, rot: 720, fx: -1, fy: 'x' },
      { x: 0, y: 0, scale: 0, rot: 0, fx: 1, fy: 1 },
    ],
  })!;
  assert.equal(c3.initials[0], 'A');
  assert.ok(c3.gap <= 24 && c3.tension >= 0.2);
  assert.ok(c3.letters[0].scale <= 0.6 && c3.letters[1].scale >= 0.04);
  assert.equal(c3.letters[0].fx, -1);
  assert.equal(c3.letters[0].fy, 1, 'non-numeric mirror flag normalizes to 1');
});

test('renderCipher is deterministic (same config → identical SVG)', () => {
  const data = loadFont('allure');
  const cfg = sanitizeCipherConfig(defaultCipherConfig('M', 'J'))!;
  const a = renderCipher(cfg, data)!;
  const b = renderCipher(cfg, data)!;
  assert.equal(a.svg, b.svg);
});

test('restroke renders one merged ribbon + secondary substrokes, pure paths only', () => {
  const data = loadFont('allure');
  const cfg = sanitizeCipherConfig({ ...defaultCipherConfig('A', 'G'), mode: 'restroke' })!;
  const out = renderCipher(cfg, data)!;
  assert.ok(out.svg.startsWith('<svg '), 'svg root');
  assert.ok(!/text|image|script|href/i.test(out.svg), 'pure paths, no text/refs');
  assert.ok(!/NaN|Infinity/.test(out.svg), 'no degenerate numbers');
  // A has a crossbar (secondary substroke) + the joined main ribbon ⇒ ≥2 paths.
  const paths = out.svg.match(/<path /g) ?? [];
  assert.ok(paths.length >= 2, `expected ≥2 ribbons, got ${paths.length}`);
});

test('weave emits a mask with the gap-scaled stroke; gap 0 / overlap emits none', () => {
  const data = loadFont('cinzel');
  const woven = sanitizeCipherConfig({
    ...defaultCipherConfig('A', 'G'),
    fontKey: 'cinzel',
    mode: 'weave',
    gap: 10,
  })!;
  const out = renderCipher(woven, data)!;
  assert.ok(out.svg.includes('<mask '), 'weave mask present');
  assert.ok(out.svg.includes('mask="url(#'), 'back letter masked');
  const sw = Number(out.svg.match(/stroke-width="([\d.]+)"/)?.[1]);
  assert.ok(sw > 10, `stroke-width scales by 1/scale (got ${sw})`);

  const flat = sanitizeCipherConfig({
    ...defaultCipherConfig('A', 'G'),
    fontKey: 'cinzel',
    mode: 'overlap',
  })!;
  assert.ok(!renderCipher(flat, data)!.svg.includes('<mask '), 'no mask in overlap');
});

test('mirror flips bake into the transform / geometry', () => {
  const data = loadFont('vidaloka');
  const base = sanitizeCipherConfig({ ...defaultCipherConfig('R', 'D'), fontKey: 'vidaloka', mode: 'overlap' })!;
  const flipped = structuredClone(base);
  flipped.letters[0].fx = -1;
  const a = renderCipher(base, data)!.svg;
  const b = renderCipher(flipped, data)!.svg;
  assert.notEqual(a, b, 'mirrored render differs');
  assert.ok(b.includes('scale(-'), 'negative x-scale in transform');
});

test('connectNearest joins the closest endpoints regardless of orientation', () => {
  // Two horizontal segments: a ends near b's END (not start) → b reverses.
  const a = resample([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10);
  const b = resample([{ x: 300, y: 0 }, { x: 120, y: 0 }], 10);
  const joined = connectNearest(a, b, 0.5);
  assert.ok(joined.length > a.length + b.length - 4, 'connector samples inserted');
  // The joined polyline must progress without a giant teleport (max segment
  // bounded by the 20-unit endpoint gap + connector curvature).
  let maxSeg = 0;
  for (let i = 1; i < joined.length; i++) {
    maxSeg = Math.max(
      maxSeg,
      Math.hypot(joined[i]!.x - joined[i - 1]!.x, joined[i]!.y - joined[i - 1]!.y),
    );
  }
  assert.ok(maxSeg < 60, `no teleports across the join (max seg ${maxSeg.toFixed(1)})`);
  // And pen-rendering the result yields a single valid path.
  const d = penOutline(joined, { size: 12 });
  assert.ok(d.startsWith('M ') && d.endsWith('Z') && !d.includes('NaN'));
});

test('renderCipher returns null for unusable input instead of throwing', () => {
  const data = loadFont('allure');
  const cfg = sanitizeCipherConfig(defaultCipherConfig('A', 'G'))!;
  const wrongData = { ...data, key: 'society' } as CipherFontData;
  assert.equal(renderCipher(cfg, wrongData), null, 'font/data mismatch → null');
});
