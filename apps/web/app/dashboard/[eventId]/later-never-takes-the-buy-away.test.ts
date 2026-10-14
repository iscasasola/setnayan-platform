/**
 * GUARD — "Later" on Papic's Next card never takes Buy more away from Home
 * (couple walk batch 6, F1 · WRONG, 2026-10-14).
 *
 * NEVER TWICE (owner 2026-10-14) kept the row's Buy more (and at zero its
 * "stopped" words) off the page while Papic held the Next card. But the card has
 * a "Later" that hides it for the day — and the row could not bring back what the
 * server had left out. On the event day, at zero, Home was left with a red meter
 * and no way to buy.
 *
 * Now the row always DRAWS its whole self; what the card already says is marked
 * `data-while-next` and stands down ONLY while that card is visible
 * (`:has([data-home-next="papic"]:not([hidden]))`, globals.css). "Later" sets the
 * card `hidden`, so the row's Buy more and words come straight back.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { glanceCount, glanceDays, glanceMoney, homeServices, pickHomeNext, type HomeNextInput } from '@/lib/home-first-screen';
import { papicGlance, papicRowDoubled } from '@/lib/papic-glance';
import { manilaCaptureCloseIso } from '@/lib/papic-window';
import type { HomeFirstScreenProps } from './_components/home-first-screen';

(globalThis as unknown as { React: unknown }).React = React;
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_later_buy__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
let Screen: typeof import('./_components/home-first-screen').HomeFirstScreen | null = null;
test.before(async () => {
  Screen = (await import('./_components/home-first-screen')).HomeFirstScreen;
});

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, '..', '..', 'globals.css'), 'utf8');
const NOW = Date.parse('2026-10-14T12:00:00+08:00');
const BASE: HomeNextInput = { guide: null, hasDate: true, guests: { total: 32, unsent: 12 }, noun: 'wedding', papicReady: false, aiOffer: false };

function home(tile: { shotsLeft: number; shotsTotal: number; photosGathered: number }, eventDate: string): string {
  const g = papicGlance({
    permitted: true,
    tile,
    window: { startDate: '2026-06-01', endIso: manilaCaptureCloseIso(eventDate) },
    eventDate,
    papicOn: true,
    nowMs: NOW,
  });
  const next = pickHomeNext({ ...BASE, papic: g.moment && g.count !== null && g.total !== null ? { moment: g.moment, left: g.count, total: g.total } : null });
  const props: HomeFirstScreenProps = {
    eventId: 'e1',
    cover: { eyebrow: 'Wedding', name: 'Maria & Jose' },
    next,
    days: glanceDays(0),
    coming: glanceCount(21, true),
    noReply: glanceCount(7, true),
    noReplyWaiting: true,
    money: { paid: glanceMoney(0), owing: glanceMoney(0) },
    papicLeft: g.count,
    services: homeServices({
      next: next.kind,
      storeShell: false,
      papic: g.status,
      papicDoors: { glance: g, line: g.line, buy: g.buy, whileNext: papicRowDoubled(next.kind === 'papic' ? next.papicMoment ?? null : null) },
      ai: 'Try it',
    }),
  };
  return renderToStaticMarkup(React.createElement(Screen!, props));
}
const rowOf = (html: string) => html.slice(html.indexOf('data-home-service="papic"'));

for (const [name, tile, day] of [
  ['stopped at zero', { shotsLeft: 0, shotsTotal: 2000, photosGathered: 2000 }, '2026-12-19'],
  ['running low on the day', { shotsLeft: 140, shotsTotal: 2000, photosGathered: 1860 }, '2026-10-14'],
] as const) {
  test(`${name}: the card offers Buy more AND the row still draws its own — marked to stand down only while the card shows`, () => {
    const html = home(tile, day);
    assert.match(html, /data-home-next="papic"/, 'Papic does not hold the Next card here — the fixture is stale');
    const row = rowOf(html);
    assert.match(row, /<span data-while-next="" class="contents">[\s\S]*?aria-label="Buy more"/, `${name}: the row drew no Buy more — "Later" would leave Home with no way to buy`);
  });
}

test('at zero the row also keeps its "stopped" words, marked the same way', () => {
  const row = rowOf(home({ shotsLeft: 0, shotsTotal: 2000, photosGathered: 2000 }, '2026-12-19'));
  assert.match(row, /<span data-while-next="">\s*· Your cameras have stopped<\/span>/);
});

test('…and the ONE rule that hides them reads whether the card is actually on screen', () => {
  assert.match(CSS, /\[data-home-first-screen\]:has\(\[data-home-next="papic"\]:not\(\[hidden\]\)\) \[data-while-next\] \{ display: none; \}/);
  // "Later" is what sets `hidden` on that card.
  const parts = readFileSync(join(HERE, '_components', 'home-parts.tsx'), 'utf8');
  assert.match(parts, /closest<HTMLElement>\('\[data-home-next\]'\)[\s\S]{0,40}card\.hidden = true/);
});

test('when Papic does NOT hold the card, nothing in the row is marked', () => {
  const row = rowOf(home({ shotsLeft: 1240, shotsTotal: 2000, photosGathered: 86 }, '2026-12-19'));
  assert.doesNotMatch(row, /data-while-next/);
  assert.match(row, /aria-label="Buy more"/);
});
