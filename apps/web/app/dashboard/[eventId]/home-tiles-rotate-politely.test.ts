/**
 * home-tiles-rotate-politely.test.ts — THE FACES AUTO-ROTATE, AND RESPECT THE PERSON (owner 2026-10-24: *"apply auto
 * swipe so it rotates by itself"* · *"auto swipe resumes after 8-10 seconds?"*; prototype
 * `home_control_center_2026-10-24_fable.html`, the timing table).
 *
 *   1 · THE TABLE: 4.5 s a face · a 320 ms slide · 0.9 s between tiles · rest 9 s after a touch (the owner's 8–10) ·
 *       a swipe past 20 % · under 6 px is a tap · on screen at 40 %.
 *   2 · REDUCED MOTION NEVER ROTATES — and neither does a single face nor a failed read. A finger, an off-screen tile,
 *       a hidden page and a resting tile all pause.
 *   3 · THE TILE OBEYS THE RULE: it joins the ticker only when `tileRotates` says so, reads `prefers-reduced-motion`
 *       (and listens for its change), and the CSS drops the slide and shows a full bar under reduced motion.
 *   4 · RENDERED: the Countdown has one face and no dots; a multi-face tile draws one dot per face.
 *
 * SABOTAGE (seen red): `tileRotates` ignoring `reducedMotion` (2 red) · the ticker joined unconditionally (3 red) ·
 * RESUME_MS = 15000 (1 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl } from '@/lib/home-control-fixture';
import { homeControlTiles } from './_components/home-control-faces';
import {
  FACE_MS,
  RESUME_MS,
  SLIDE_MS,
  STAGGER_MS,
  SWIPE_FRACTION,
  TAP_PX,
  VISIBLE_THRESHOLD,
  swipeLands,
  tilePaused,
  tileRotates,
} from './_components/home-tile-rotation';
import { count, drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the timing is the prototype’s table', () => {
  assert.equal(FACE_MS, 4500);
  assert.equal(SLIDE_MS, 320);
  assert.equal(STAGGER_MS, 900);
  assert.ok(RESUME_MS >= 8000 && RESUME_MS <= 10000, `rests ${RESUME_MS} ms — the owner said 8–10 s`);
  assert.equal(RESUME_MS, 9000);
  assert.equal(SWIPE_FRACTION, 0.2);
  assert.equal(TAP_PX, 6);
  assert.equal(VISIBLE_THRESHOLD, 0.4);
  // The slide the CSS draws is the same 320 ms.
  assert.match(read('app/globals.css'), /\.hc-track \{[^}]*transition: transform 320ms/);
});

test('2 · reduced motion never rotates; nor one face; nor a failed read — and the pauses pause', () => {
  assert.equal(tileRotates({ faces: 5, failed: false, reducedMotion: true }), false, 'reduced motion rotated');
  assert.equal(tileRotates({ faces: 1, failed: false, reducedMotion: false }), false, 'a single face rotated');
  assert.equal(tileRotates({ faces: 5, failed: true, reducedMotion: false }), false, 'a failed read rotated');
  assert.equal(tileRotates({ faces: 2, failed: false, reducedMotion: false }), true, 'premise: a multi-face tile rotates');
  const base = { holding: false, onScreen: true, pageHidden: false, restingUntil: 0, now: 10_000 };
  assert.equal(tilePaused(base), false);
  assert.equal(tilePaused({ ...base, holding: true }), true, 'a finger on the tile');
  assert.equal(tilePaused({ ...base, onScreen: false }), true, 'off screen');
  assert.equal(tilePaused({ ...base, pageHidden: true }), true, 'the page hidden');
  assert.equal(tilePaused({ ...base, restingUntil: 12_000 }), true, 'still resting after a touch');
  assert.equal(tilePaused({ ...base, restingUntil: 9_000 }), false, 'resumes once the rest is over');
  // A swipe past 20 % moves one face (wrapping); under it, the face stays.
  assert.equal(swipeLands({ index: 0, faces: 3, dx: -70, width: 300 }), 1);
  assert.equal(swipeLands({ index: 0, faces: 3, dx: 70, width: 300 }), 2, 'wraps backwards');
  assert.equal(swipeLands({ index: 1, faces: 3, dx: -50, width: 300 }), 1, 'under the threshold, the face stays');
});

test('3 · the tile obeys the rule, and the CSS stills itself under reduced motion', () => {
  const tile = read('app/dashboard/[eventId]/_components/home-tile.tsx');
  assert.match(tile, /const rotates = tileRotates\(\{ faces: count, failed: model\.failed, reducedMotion: reduced \}\);/);
  assert.match(tile, /useEffect\(\(\) => \{\s*if \(!rotates\) return;[\s\S]{0,120}?return joinTicker\(/, 'the ticker is joined without asking tileRotates');
  assert.match(tile, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/, 'the tile never reads reduced motion');
  assert.match(tile, /addEventListener\('change', onChange\)/, 'the tile does not follow a change of the setting');
  assert.match(tile, /tilePaused\(\{ holding: s\.holding, onScreen: s\.onScreen, pageHidden: document\.hidden, restingUntil: s\.restingUntil, now \}\)/);
  assert.match(tile, /new IntersectionObserver\([\s\S]{0,200}?threshold: VISIBLE_THRESHOLD/, 'off-screen tiles are not paused');
  const css = read('app/globals.css');
  const block = /@media \(prefers-reduced-motion: reduce\) \{[^@]*?\.hc-track[^{]*\{ transition: none; \}[^@]*?\}\s*\}/.exec(css)?.[0] ?? '';
  assert.ok(block.length > 0, 'the control row has no reduced-motion block that stills the slide');
  assert.match(block, /\.hc-dot\.on::after \{ width: 100%; \}/, 'the active dot is not a full bar under reduced motion');
});

test('4 · rendered: the Countdown is one face with no dots; a multi-face tile draws a dot per face', () => {
  const html = drawHome();
  const compact = slice(html, 'data-home-control="compact"', ['data-home-control="detail"']);
  const countdown = slice(compact, 'data-home-tile="count"', ['data-home-tile="guests"']);
  assert.equal(count(countdown, 'data-hc-dot'), 0, 'the Countdown has dots');
  const { tiles } = homeControlTiles(fixtureControl('e1'));
  for (const t of tiles.filter((x) => x.faces.length > 1)) {
    const one = slice(compact, `data-home-tile="${t.key}"`, ['data-home-tile="', 'data-home-control="detail"'].map((m) => m));
    assert.equal(count(one, 'data-hc-dot'), t.faces.length, `${t.key}: dots ≠ faces`);
  }
});
