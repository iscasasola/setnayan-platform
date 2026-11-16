/**
 * 🖼 THE DEMO PHONE IS A PICTURE, NOT THE APP (full-page audit, 16 Nov 2026, fix 2).
 *
 * The About pages' "How it works" phone draws scenes of the app — and the scenes
 * draw the app's buttons ("Save palette", "Render reel", "Connect Google Drive"…)
 * as real `<button>`s with nothing behind them. A keyboard user tabbed onto each
 * and a screen reader announced "button" for a control that does nothing.
 *
 * The fix is one wrapper where the scene is rendered: `inert` (out of the tab
 * order and the accessibility tree) + `aria-hidden`, on a `display: contents`
 * box so the picture is pixel-for-pixel unchanged. The scenes themselves are not
 * edited — the capture scripts record them into the demo videos.
 *
 * Measured on main when this landed: every slug ships a recorded video, so the
 * live scene is the FALLBACK path — but it is the path that renders the moment a
 * video is missing, and this guard keeps it honest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '../../../lib/strip-comments';

const SRC = stripComments(readFileSync(join(__dirname, 'studio-card-demo.tsx'), 'utf8'));
const WRAP = /<div inert aria-hidden className="contents">\s*\{richF\.scene\}\s*<\/div>/g;

test('the scene renders in exactly one place, and that place is inert', () => {
  const renders = SRC.match(/\{\s*richF\.scene\s*\}|\brichF\.scene\b(?!\s*\?)/g) ?? [];
  // `richF.scene` is named once in the render (inside the wrapper); a second render site would be unguarded.
  assert.equal(renders.length, 1, `richF.scene is rendered ${renders.length} times — every render must sit in the inert wrapper`);
  assert.equal((SRC.match(WRAP) ?? []).length, 1, 'the scene must render inside <div inert aria-hidden className="contents">');
  // No other way to reach a scene's JSX from the card (e.g. rich[idx].scene).
  assert.equal((SRC.match(/\]\s*\.scene\b|\)\s*\.scene\b/g) ?? []).length, 0, 'a scene is rendered by another route');
});

test('the look-alike buttons exist (so the guard is not vacuous) and the real controls stay outside the wrapper', () => {
  const sceneBlock = SRC.slice(SRC.indexOf('export const RICH_SCENES'), SRC.indexOf('export function StudioCardDemo'));
  const before = SRC.slice(0, SRC.indexOf('export function StudioCardDemo'));
  const fake = (before.match(/<button\b[^>]*>/g) ?? []).filter((b) => !/onClick/.test(b));
  assert.ok(sceneBlock.length > 0);
  assert.ok(fake.length >= 10, `expected the drawn scenes to hold their look-alike buttons, found ${fake.length}`);
  const card = SRC.slice(SRC.indexOf('export function StudioCardDemo'));
  const real = card.match(/<button\b[\s\S]*?onClick/g) ?? [];
  assert.equal(real.length, 2, 'Play/pause and the step dots are the card’s two real controls');
  const wrapAt = card.search(/<div inert aria-hidden/);
  const firstReal = card.search(/<button\b/);
  assert.ok(wrapAt > 0 && firstReal > wrapAt, 'the real controls render after (outside) the picture');
});

test('React writes the inert attribute (a dropped attribute would be a silent no-op)', () => {
  const html = renderToStaticMarkup(createElement('div', { inert: true, 'aria-hidden': true, className: 'contents' }));
  assert.match(html, /\binert=""/);
  assert.match(html, /aria-hidden="true"/);
});
