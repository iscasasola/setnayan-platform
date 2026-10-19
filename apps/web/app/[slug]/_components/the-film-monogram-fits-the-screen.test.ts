/**
 * THE SAVE THE DATE FILM FITS A PHONE (sweep 2026-10-19 · rows B5 + C7).
 *
 *   B5 · marco-marga at 375: the opening "M & M" lockup ran off the right edge — the svg box measured 30..345, its
 *        italic capitals' ink ran past 375. The lockup's scale is now FITTED (`fitLockupScale`): its full designed
 *        size wherever the ink has room, and exactly small enough to stand the gutter inside the screen where not.
 *   C7 · "See our page" sat in the bottom-left corner beside a centred film; the "press and hold to pause" cue was a
 *        grey pill (a frame on something you cannot press, ~2:1 on the cream film).
 *
 * The geometry is held by NUMBERS (the fit at every phone width, the rows' heights), not by class names; the real
 * pixels were measured in Chromium 375/390, WebKit iPhone 13 and Chromium 1280 (PR body).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { fitLockupScale, FILM_INK_GUTTER_PX, type LockupInk } from '@/lib/film-lockup-fit';
import { stagePressPx } from './save-the-date-film';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILM = stripComments(readFileSync(join(HERE, 'save-the-date-film.tsx'), 'utf8'));

// The stage the film is composed on, and its fit (copied from the film's own rule: min(w/440, h/780), clamped).
const BASE_W = 440;
const BASE_H = 780;
const fit = (w: number, h: number) => Math.max(0.6, Math.min(2.3, Math.min(w / BASE_W, h / BASE_H)));

// The `bar` lockup at HeroMonogram's 80px: viewBox 6..126 × 14..84 → a 137px box centred on its bar, whose right
// capital's italic overhang reaches well past the box (marco-marga's ink ran ≥ 30 screen px past the svg at 375).
const BAR: LockupInk = { left: 73, right: 84 };
const OPENING = 2.7;

test('B5 · on every phone width the opening lockup’s ink stands the gutter inside the screen', () => {
  for (const [w, h] of [[320, 568], [360, 740], [375, 812], [390, 844], [393, 852], [414, 896], [430, 932]] as const) {
    const s = fit(w, h);
    const scale = fitLockupScale(OPENING, s, w, BAR);
    const reach = scale * s * Math.max(BAR.left, BAR.right); // screen px from the centre to the farther ink edge
    assert.ok(reach <= w / 2 - FILM_INK_GUTTER_PX + 0.01, `${w}×${h}: the ink reaches ${reach.toFixed(1)}px from the centre of a ${w}px screen`);
    assert.ok(scale <= OPENING, `${w}×${h}: the lockup grew past its designed size`);
  }
});

test('B5 · where there is room the lockup keeps its full designed size (larger widths are unchanged)', () => {
  for (const [w, h] of [[768, 1024], [1280, 800], [1440, 900], [1920, 1080]] as const) {
    assert.equal(fitLockupScale(OPENING, fit(w, h), w, BAR), OPENING, `${w}×${h} lost its designed size`);
  }
  // …and before anything is measured (server render, first paint) it is the design, never a guess.
  assert.equal(fitLockupScale(OPENING, 1, 0, BAR), OPENING);
  assert.equal(fitLockupScale(OPENING, 0.85, 375, null), OPENING);
  assert.equal(fitLockupScale(OPENING, Number.NaN, 375, BAR), OPENING);
});

test('B5 · the lockup’s transform IS the fitted scale — no fixed scale class rides beside it', () => {
  const start = FILM.indexOf('function FilmMonogram(');
  const end = FILM.indexOf('export function SaveTheDateFilm', start);
  assert.ok(start > -1 && end > start, 'FilmMonogram moved');
  const fn = FILM.slice(start, end);
  assert.match(fn, /const shownScale = fitLockupScale\(lockupScale, fitScale, roomW, ink\)/, 'the lockup scale is not fitted to the screen');
  assert.match(fn, /ref=\{lockupRef\}[\s\S]{0,200}transform: `scale\(\$\{shownScale\}\)`/, 'the measured element is not the one wearing the fitted scale');
  assert.match(fn, /measureLockupInk\(lockupRef\.current\)/, 'the ink is not measured on the lockup itself');
  assert.doesNotMatch(fn, /\bscale-\[/, 'a fixed Tailwind scale class is back inside FilmMonogram');
  assert.doesNotMatch(FILM, /lockupScaleCls/, 'a beat still passes a fixed scale class');
});

test('C7 · the way-out stands on the film’s centre line, and the chrome above it stacks clear of its tallest press', () => {
  const wayOut = /<div\s+data-film-way-out=""\s+className="([^"]*)"\s+style=\{\{\s*bottom:\s*'calc\(([\d.]+)rem \+ var\(--cookie-banner-top, 0px\)\)'/.exec(FILM);
  assert.ok(wayOut, 'the quiet "See our page" lost its row');
  assert.match(wayOut[1] ?? '', /\binset-x-0\b/);
  assert.match(wayOut[1] ?? '', /\bjustify-center\b/, '"See our page" is off the centre line again');
  const chip = /className="pointer-events-none absolute inset-x-0 [^"]*"\s+style=\{\{\s*bottom:\s*'calc\(([\d.]+)rem \+ var\(--cookie-banner-top, 0px\)\)'\s*\}\}\s+onClick=\{\(e\) => e\.stopPropagation\(\)\}\s*>\s*<a\b/.exec(FILM);
  assert.ok(chip, 'the persistent "Add to calendar" chip lost its row');
  const hint = /bottom-36[^`]*`\}\s+style=\{\{\s*bottom:\s*'calc\(([\d.]+)rem \+ var\(--cookie-banner-top, 0px\)\)'\s*\}\}\s*>\s*(?:\{\s*\}\s*)*<p data-film-hold-hint/.exec(FILM);
  assert.ok(hint, 'the hold cue lost its row');
  const px = (rem: string | undefined) => Number(rem) * 16;
  const wayOutTop = px(wayOut[2]) + stagePressPx(0.6); // the tallest the way-out grows: the smallest stage
  assert.ok(wayOutTop <= px(chip[1]), `the calendar chip (${px(chip[1])}) sits on the way-out (top ${wayOutTop})`);
  assert.ok(px(chip[1]) + 44 <= px(hint[1]), `the hold cue (${px(hint[1])}) sits on the calendar chip (${px(chip[1])}–${px(chip[1]) + 44})`);
});

test('C7 · the hold cue is a word, not a button — nothing frames it', () => {
  const p = /<p data-film-hold-hint="" className="([^"]*)">\s*Press and hold to pause/.exec(FILM);
  assert.ok(p, 'the hold cue is gone or reworded');
  assert.doesNotMatch(p[1] ?? '', /\b(bg-|border|rounded|shadow|backdrop-)/, `the hold cue wears a frame again: ${p[1]}`);
  assert.doesNotMatch(p[1] ?? '', /\btext-cream\b/, 'the hold cue forces cream type onto a cream film again');
});
