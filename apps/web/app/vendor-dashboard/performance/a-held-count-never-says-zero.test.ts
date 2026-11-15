/**
 * RW-304 (live walk, 14 Nov 2026) — Shop analytics drew a big "0 asked" over "8 couples asked", and "0 booked" over
 * "6 bookings". Both read the same number; the figure was a HELD count (it counts up once its card plays) and a held
 * count that had never shown anything drew 0 — in the server's HTML too, so a full-page shot, a slow phone or a card
 * never scrolled to all read a false zero beside the true line. Held and never shown, it now draws nothing readable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeldCount } from './_components/growth-motion';
import { Reanimate } from './_components/reanimate';
import { __resetCountMemory } from '@/components/count';

(globalThis as unknown as { React: unknown }).React = React;

const visibleText = (html: string) =>
  html.replace(/<span aria-hidden="true" style="visibility:hidden"[\s\S]*?<\/span><\/span>|<span aria-hidden="true" style="visibility:hidden"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '');

test('a held count that has never shown a number draws no readable "0"', () => {
  __resetCountMemory();
  const html = renderToStaticMarkup(h(Reanimate, null, h(HeldCount, { value: 8, id: 'rw304:asked' })));
  assert.match(html, /data-held-count/, 'the held figure keeps its place');
  assert.match(html, /visibility:hidden/, 'and draws nothing visible');
  assert.doesNotMatch(visibleText(html), /\b0\b/, `a visible 0 sits beside the true line: ${html}`);
});

test('outside a held section, the count shows its value at once, as before', () => {
  __resetCountMemory();
  const html = renderToStaticMarkup(h(HeldCount, { value: 8, id: 'rw304:free' }));
  assert.doesNotMatch(html, /data-held-count/);
  assert.match(html, />8</);
});
