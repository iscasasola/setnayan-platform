/**
 * papic-look-samples.test.ts — every Papic Filter tile is our sample photograph,
 * developed through its look by the camera's own pipeline, and that picture is
 * on disk and current (owner 2026-10-25: *"the filters should have a sample
 * photo. which should be our photo"*). See `papic-look-samples.ts`.
 *
 *   1. every look in PAPIC_STYLES has `public/papic/looks/<STYLE>.webp`, a real
 *      WebP, and the manifest names exactly the looks there are;
 *   2. the picker draws an <img> of that picture in EVERY tile of BOTH variants
 *      — counted per variant, so one tile slipping back to a swatch is caught —
 *      and no gradient/`filter:` swatch is left;
 *   3. the pictures are of the look maths as it is today — else re-render.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PAPIC_STYLES } from './papic-photo-styles';
import { PAPIC_LOOK_SAMPLES, PAPIC_LOOK_RENDER_COMMAND, papicLookSampleSrc } from './papic-look-samples';
import { PAPIC_LOOK_SOURCE, currentPapicLookHash, papicLookHash, pixelHalfOf } from './papic-look-samples-hash';

const WEB = join(__dirname, '..');
const DIR = join(WEB, 'public', 'papic', 'looks');
const PICKER = readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'studio', 'papic', 'style-picker.tsx'), 'utf8');

/** The looks whose tile picture is missing or not a WebP — exported shape so the sabotage can point it elsewhere. */
function missingPictures(dir: string): string[] {
  return PAPIC_STYLES.map((s) => s.id).filter((id) => {
    const file = join(dir, `${id}.webp`);
    if (!existsSync(file)) return true;
    const head = readFileSync(file).subarray(0, 12);
    return head.subarray(0, 4).toString('latin1') !== 'RIFF' || head.subarray(8, 12).toString('latin1') !== 'WEBP';
  });
}

/** The tiles one variant's JSX draws as a picture: the `<img … papicLookSampleSrc(s.id) …>` inside its PAPIC_STYLES.map. */
function picturesIn(block: string): number {
  return (block.match(/<img\b[^>]*src=\{papicLookSampleSrc\(s\.id\)\}[^>]*>/g) ?? []).length;
}

/** The picker split at the strip's early return: [strip, cards]. */
function variants(src: string): [string, string] {
  const at = src.indexOf("if (variant === 'strip')");
  assert.ok(at > 0, 'the strip variant is no longer an early return — re-anchor this guard');
  const end = src.indexOf('\n  return (', at + 1);
  assert.ok(end > at, 'the cards variant return was not found — re-anchor this guard');
  return [src.slice(at, end), src.slice(end)];
}

function swatchesIn(src: string): string[] {
  const out: string[] = [];
  if (/linear-gradient\(|radial-gradient\(/.test(src)) out.push('a CSS gradient');
  if (/cssPreviewFilter\(/.test(src)) out.push('a cssPreviewFilter swatch');
  if (/SWATCH_BG/.test(src)) out.push('SWATCH_BG');
  return out;
}

test('every look has its picture on disk, as a WebP, and the manifest names exactly the looks', () => {
  assert.deepEqual(missingPictures(DIR), [], `run \`${PAPIC_LOOK_RENDER_COMMAND}\` (apps/web) and commit public/papic/looks/`);
  assert.deepEqual([...PAPIC_LOOK_SAMPLES.styles].sort(), PAPIC_STYLES.map((s) => s.id).sort(), 'the manifest names other looks than PAPIC_STYLES');
  const extra = readdirSync(DIR).filter((f) => !PAPIC_STYLES.some((s) => `${s.id}.webp` === f));
  assert.deepEqual(extra, [], 'public/papic/looks/ holds a file no look draws');
  for (const s of PAPIC_STYLES) {
    const bytes = readFileSync(join(DIR, `${s.id}.webp`)).length;
    assert.ok(bytes < 30_000, `${s.id}.webp is ${bytes} bytes — a 240 px tile should be ~10 KB`);
    assert.match(papicLookSampleSrc(s.id), new RegExp(`^/papic/looks/${s.id}\\.webp\\?v=[0-9a-f]{16}$`));
  }
  assert.ok(existsSync(join(WEB, PAPIC_LOOK_SOURCE)), 'the source photograph is gone');
});

test('the check is not vacuous: a missing picture is caught', () => {
  assert.deepEqual(missingPictures(join(WEB, 'public', 'no-such-dir')), PAPIC_STYLES.map((s) => s.id));
});

test('every tile of both variants draws the picture, and no gradient swatch is left', () => {
  const [strip, cards] = variants(PICKER);
  for (const [name, block] of [['strip', strip], ['cards', cards]] as const) {
    assert.ok(/PAPIC_STYLES\.map\(\(s\)/.test(block), `the ${name} variant no longer maps PAPIC_STYLES`);
    const n = picturesIn(block);
    console.log(`[papic looks] ${name}: ${n} picture per tile`);
    assert.equal(n, 1, `the ${name} variant's tile draws ${n} sample pictures (want exactly 1)`);
    assert.match(block, /<img\b[^>]*\balt=\{/, `the ${name} picture has no alt (the look's name)`);
    assert.match(block, /<img\b[^>]*loading="lazy"/, `the ${name} picture is not lazy`);
  }
  assert.deepEqual(swatchesIn(PICKER), [], 'a swatch is back in the picker — the tile must be the sample photograph');
});

test('the swatch check is not vacuous', () => {
  const sabotaged = PICKER.replace(/<img\b[^>]*src=\{papicLookSampleSrc\(s\.id\)\}[^>]*\/>/, '<span style={{ background: SWATCH_BG, filter: cssPreviewFilter(s.id) }} />');
  assert.notEqual(sabotaged, PICKER);
  assert.deepEqual(swatchesIn(sabotaged), ['a cssPreviewFilter swatch', 'SWATCH_BG']);
  assert.equal(picturesIn(variants(sabotaged)[0]), 0);
});

test('the pictures are of the look maths as it is today — else re-render', () => {
  assert.equal(
    PAPIC_LOOK_SAMPLES.look,
    currentPapicLookHash(WEB),
    `the Filter tiles were rendered before the look maths (or the photo) changed — run \`${PAPIC_LOOK_RENDER_COMMAND}\` (apps/web) and commit public/papic/looks/ with the manifest`,
  );
  const styles = readFileSync(join(WEB, 'lib', 'papic-photo-styles.ts'), 'utf8');
  const photo = readFileSync(join(WEB, PAPIC_LOOK_SOURCE));
  assert.notEqual(papicLookHash(`${styles}\n// a changed curve`, photo), papicLookHash(styles, photo), 'a change to the pixel maths does not move the hash');
  assert.equal(papicLookHash(styles.replace("blurb:", "blurb :"), photo), papicLookHash(styles, photo), 'a label edit should not demand a re-render');
  assert.throws(() => pixelHalfOf('no marker here'));
});
