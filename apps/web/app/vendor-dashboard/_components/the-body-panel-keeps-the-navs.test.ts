/**
 * 🔒 THE BODY PANEL KEEPS THE NAVS (Build 2, lane B2-B — THE ONE BUILD §10 #33 Makers · §10 #40 Portfolio albums).
 *
 * Owner 8 Nov: *"keep the navs and just take up the body part"* (Makers) and *"Portfolio should pin and take up the whole
 * body when opening an album"*. ONE in-body panel serves both — never a second panel, never a full-screen pop-up.
 *   1 · It stands between the top bar and the bottom nav: it measures `header.fd-topbar` and `[data-bottom-dock]` and
 *       sits on the pop layer token (`z-sn-pop`), never a raw z-index.
 *   2 · Its motion is the house's: RISE_MS / RISE_EASE out of the tapped rect, RISE_REDUCED_MS under reduced motion,
 *       and the close plays the same frames in reverse back into that rect.
 *   3 · The page under it holds still and gets its exact scroll back (the return rule).
 *   4 · Shop › Makers AND Portfolio's albums both mount it — one part, two doors; neither draws its own.
 *
 * Sabotaged once (2026-11-08): `z-sn-pop` → `z-50` in body-panel.tsx failed 1; `RISE_MS` → `600` failed 2; removing
 * `<BodyPanel` from portfolio-groups.tsx failed 4. Each reverted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PANEL = read('body-panel.tsx');
const MAKERS = read('../shop/_components/shop-makers.tsx');
const GROUPS = read('../collections/_components/portfolio-groups.tsx');

test('1 · between the top bar and the bottom nav, on the pop layer token', () => {
  assert.match(PANEL, /querySelector\('header\.fd-topbar'\)/, 'the panel does not measure the top bar');
  assert.match(PANEL, /querySelector\('\[data-bottom-dock\]'\)/, 'the panel does not measure the bottom nav');
  assert.match(PANEL, /className="fixed z-sn-pop /, 'the panel is not on the pop layer token');
  assert.doesNotMatch(PANEL, /\bz-\[?\d+\]?\b|zIndex:/, 'a raw z-index — use the layer tokens');
  assert.doesNotMatch(PANEL, /inset-0/, 'a full-screen panel covers the navs');
});

test('2 · the house motion, out of the tapped rect and back into it', () => {
  assert.match(PANEL, /import \{ RISE_EASE, RISE_MS, RISE_REDUCED_MS \} from '@\/lib\/rise-motion';/);
  assert.equal([...PANEL.matchAll(/duration: RISE_MS, easing: RISE_EASE/g)].length, 2, 'the open and the close do not share the house motion');
  assert.match(PANEL, /direction: 'reverse'/, 'the close is not the open in reverse');
  assert.match(PANEL, /prefers-reduced-motion: reduce/);
  assert.equal([...PANEL.matchAll(/duration: RISE_REDUCED_MS/g)].length, 2, 'reduced motion is not a short fade both ways');
  assert.doesNotMatch(PANEL, /duration: \d{3}/, 'a typed duration in place of the tokens');
});

test('3 · the page under it holds still and gets its exact scroll back', () => {
  assert.match(PANEL, /root\.style\.overflow = 'hidden';/);
  assert.match(PANEL, /window\.scrollTo\(\{ top: y,/);
});

test('4 · Makers and Portfolio albums mount the ONE panel', () => {
  assert.match(MAKERS, /<BodyPanel\b/, 'Makers does not open through the shared panel');
  assert.match(GROUPS, /<BodyPanel\b/, 'an album does not open through the shared panel');
  for (const [name, src] of [['shop-makers', MAKERS], ['portfolio-groups', GROUPS]] as const) {
    assert.match(src, /from '\.\.\/\.\.\/_components\/body-panel'/, `${name} imports another panel`);
    assert.doesNotMatch(src, /createPortal|className="fixed /, `${name} draws its own overlay`);
  }
});
