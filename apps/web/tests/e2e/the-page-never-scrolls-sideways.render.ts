/**
 * Renderer for `the-page-never-scrolls-sideways.spec.ts` — prints, as JSON on
 * stdout, the REAL Discover event shelf of the front door (`DiscoverEventCard`
 * inside the shelf's own `fd-grid fd-up` wrapper, under `fd-main` › `fd-col`),
 * so the spec can lay it out at 320px under the app's compiled CSS. Run in a
 * `tsx` child process (Playwright's transform cannot server-render imported
 * JSX) — same shape as `event-type-cards-fit.render.ts`.
 *
 * WHY THE SHELF IS RENDERED AND NOT VISITED: in CI the front door has no
 * database, so its shelves are empty and `/` alone could never draw the card
 * that scrolled the live page sideways at 320 (iPad audit W7: "Guest list
 * only", nowrap, wider than its 88px text column). The cards carry the longest
 * words a card can show: a long title, both pills, a host and a place.
 */
import Module from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { DiscoverEventCard } from '../../lib/discover-events-core';

// tsconfig's `"jsx": "preserve"` makes `tsx` compile to the classic runtime, so
// React must be global BEFORE the components load (hence the dynamic import).
(globalThis as { React?: typeof React }).React = React;
// The paper card's CSS module cannot load outside Next: each class maps to itself.
(Module as unknown as { _extensions: Record<string, (m: { exports: unknown }) => void> })._extensions['.css'] = (m) => {
  const classes = new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? k : undefined) });
  m.exports = { __esModule: true, default: classes };
};

const base: Omit<DiscoverEventCard, 'key' | 'href' | 'title' | 'askHref'> = {
  typeLabel: 'Wedding',
  datePlate: '12 December 2026',
  cover: 'M',
  scene: null,
  paper: null,
  host: { name: 'Indalecio Casasola', slug: 'indalecio' },
  regionLabel: 'Metro Manila',
  relation: 'follow',
} as Omit<DiscoverEventCard, 'key' | 'href' | 'title' | 'askHref'>;

const CARDS = [
  { ...base, key: 'a', href: '/maria-and-jose', title: 'Maria & Jose', askHref: null },
  { ...base, key: 'b', href: '/indalecio-and-claire', title: 'Indalecio & Claire Buenaventura', askHref: null },
  { ...base, key: 'c', href: '/x', title: 'Marco & Marga', askHref: '/join/x' },
  { ...base, key: 'd', href: '/y', title: 'A long hangout name for the barkada', askHref: null },
] as DiscoverEventCard[];

void (async () => {
  const { DiscoverEventCard: Card } = await import('../../app/_components/frontdoor/discover-event-card');
  const html = renderToStaticMarkup(
    React.createElement(
      'main',
      { className: 'fd-main' },
      React.createElement(
        'div',
        { className: 'fd-col' },
        React.createElement(
          'div',
          { className: 'fd-grid fd-up' },
          CARDS.map((c) => React.createElement(Card, { key: c.key, card: c })),
        ),
      ),
    ),
  );
  process.stdout.write(JSON.stringify({ html, count: CARDS.length }));
})();
