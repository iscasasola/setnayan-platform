/**
 * every-carousel-snaps-to-centre-and-loops.test.ts — 🎠 THE ONE CAROUSEL (`components/snap-carousel.tsx`).
 *
 * Owner, 2026-10-27 (DECISION_LOG "EVERY CAROUSEL SNAPS TO CENTRE, PEEKS BOTH SIDES, LOOPS", verbatim *"Carousel must snap
 * to center with a small part peaking and continuous not end to end."*): the current card snaps to the CENTRE; a small
 * part of the previous and the next peeks on both sides; a continuous loop both ways; auto-advance ≈3 s continues the
 * loop and pauses on touch / hover / wheel / focus; dots show the position; reduced motion = no auto-advance, a swipe
 * still loops. Plain CSS scroll-snap, no library.
 *
 * Held by what the part DOES: the slot plan (pure), the server's HTML (each card once, no copies), and the stylesheet
 * and engine it ships (centre snap, one card per swipe, the peek, the pause and reduced-motion gates).
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-10-28, see the PR body): `scroll-snap-align: center` → `start`; the copies
 * at the start dropped (`before` → []); the reduced-motion gate taken out of the tick.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}

/* Loaded after the stylesheet hook above (a static import would run before it). */
const load = () => import('@/components/snap-carousel');
const WEB = join(__dirname, '..');
const SRC = stripComments(readFileSync(join(WEB, 'components', 'snap-carousel.tsx'), 'utf8'));
const CSS = readFileSync(join(WEB, 'components', 'snap-carousel.module.css'), 'utf8');

test('the loop: copies of the last cards before, of the first after — every card has a neighbour on both sides', async () => {
  const { CAROUSEL_COPIES, carouselSlots } = await load();
  assert.equal(CAROUSEL_COPIES, 2, 'two copies each end — a card settled on a copy still has a far-side neighbour');
  for (const n of [2, 3, 5]) {
    const slots = carouselSlots(n, true);
    assert.equal(slots.length, n + 2 * CAROUSEL_COPIES);
    const reals = slots.filter((s) => !s.copy).map((s) => s.real);
    assert.deepEqual(reals, Array.from({ length: n }, (_, i) => i), 'the real cards are not in order, once each');
    // Walking the slots reads the cards round and round: after the last comes the first, both ways.
    slots.forEach((s, i) => {
      if (i === 0) return;
      assert.equal(s.real, (slots[i - 1]!.real + 1) % n, `slot ${i} of ${n} breaks the loop`);
    });
  }
  // Before the page is live — or with one card — no copies.
  assert.deepEqual(carouselSlots(3, false), [0, 1, 2].map((real) => ({ real, copy: false })));
  assert.deepEqual(carouselSlots(1, true), [{ real: 0, copy: false }]);
});

test('the server draws each card ONCE — the copies arrive with the page, inert and hidden', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SnapCarousel } = await load();
  const cards = ['a', 'b', 'c'].map((k) => ({ key: k, label: `Card ${k}`, node: React.createElement('p', { 'data-x': k }, k) }));
  const html = renderToStaticMarkup(React.createElement(SnapCarousel, { cards, label: 'Summary' }));
  assert.deepEqual([...html.matchAll(/data-x="(\w)"/g)].map((m) => m[1]), ['a', 'b', 'c']);
  assert.doesNotMatch(html, /data-snap-copy/);
  assert.match(html, /role="region" aria-roledescription="carousel" aria-label="Summary"/);
  assert.deepEqual([...html.matchAll(/aria-label="(\d of 3: Card \w)"/g)].map((m) => m[1]), ['1 of 3: Card a', '2 of 3: Card b', '3 of 3: Card c']);
  assert.equal((html.match(/<i\b/g) ?? []).length, 3, 'a dot per card');
  // The copies: inert and hidden from assistive tech — never a second set of doors to tab through or hear.
  assert.match(SRC, /<div key=\{`copy-\$\{i\}`\} className=\{styles\.slide\} inert aria-hidden data-snap-copy="">/);
  assert.match(SRC, /useEffect\(\(\) => setLooping\(n > 1\), \[n\]\);/, 'the copies are not added after hydration');
});

test('centre snap, one card per swipe, a peek on both sides — plain CSS scroll-snap', () => {
  assert.match(CSS, /\.track \{[^}]*scroll-snap-type: x mandatory;/);
  assert.match(CSS, /\.slide \{[^}]*scroll-snap-align: center;/, 'a card does not snap to the centre');
  assert.match(CSS, /\.slide \{[^}]*scroll-snap-stop: always;/, 'a fling can skip cards (and run past the copies)');
  // The peek: the track pads by a peek and a gap on EACH side, and a card is its whole content box.
  assert.match(CSS, /\.slide \{[^}]*flex: 0 0 100%;/, 'a card is not the track’s content box — the peek is not the padding');
  assert.match(CSS, /\.track \{[^}]*padding-inline: calc\(var\(--sc-peek\) \+ var\(--sc-gap\)\);/);
  assert.match(CSS, /--sc-peek: \d+px;/);
  assert.doesNotMatch(SRC, /from ['"](swiper|embla|keen-slider|react-slick|flickity)/, 'a carousel library');
});

test('the engine: settles a copy onto its real card, advances ≈3 s, pauses 6 s on a touch — never under reduced motion', async () => {
  const { CAROUSEL_ADVANCE_MS, CAROUSEL_PAUSE_MS } = await load();
  assert.equal(CAROUSEL_ADVANCE_MS, 3000);
  assert.equal(CAROUSEL_PAUSE_MS, 6000);
  // Settled on a copy → one lap over, at once (same picture, no visible jump).
  assert.match(SRC, /if \(slot < CAROUSEL_COPIES\) centre\(track, slot \+ n\);\s*else if \(slot >= CAROUSEL_COPIES \+ n\) centre\(track, slot - n\);/);
  assert.match(SRC, /track\.addEventListener\('scrollend', settled/);
  // Every way a person takes hold pauses it.
  for (const ev of ['pointerdown', 'touchstart', 'wheel', 'pointerenter', 'focusin']) {
    assert.match(SRC, new RegExp(`track\\.addEventListener\\('${ev}'`), `"${ev}" does not pause it`);
  }
  const tick = SRC.slice(SRC.indexOf('const tick = window.setInterval('), SRC.indexOf('}, advanceMs);'));
  assert.match(tick, /if \(reduce\.matches \|\| !looping \|\| !onScreen \|\| hovering \|\| focused\) return;/, 'it advances under reduced motion, off screen or while held');
  assert.match(tick, /document\.visibilityState === 'hidden' \|\| Date\.now\(\) < pausedUntil/);
  assert.match(SRC, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.track \{\s*scroll-behavior: auto;/);
  // Dots are attributes, never state — a scroll re-renders nothing.
  assert.match(SRC, /dots\[i\]!\.toggleAttribute\('data-on', i === at\)/);
  assert.doesNotMatch(SRC, /set[A-Z]\w*\(\s*(?:at|slot|nearest)/, 'the position is React state — every scroll would re-render the cards');
});
