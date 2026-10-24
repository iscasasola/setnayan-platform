/**
 * GUARD — Home never takes Buy more away (couple walk batch 6, F1 · WRONG, 2026-10-14; RE-AIMED 2026-10-24).
 *
 * NEVER TWICE (owner 2026-10-14) once kept the Papic row's Buy more (and at zero its "stopped" words) off the page
 * while Papic held the Next card, and a "Later" on that card left Home with a red meter and no way to buy — fixed by
 * marking the row `data-while-next` and hiding it only while the card was on screen.
 *
 * The Next card is gone (owner-approved 2026-10-24, `home_control_center_2026-10-24_fable.html`): the Today line names
 * Papic's moment and POINTS at the Papic card — it offers no button of its own. So nothing stands down any more:
 *   · the page marks nothing `whileNext` and the CSS rule that hid a marked part is gone;
 *   · at every Papic moment (stopped at zero, low on the day) the Papic row draws its Buy more and its words;
 *   · "Later" folds the Today line only — it never touches the Papic row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { homeServices, pickHomeNext, type HomeNextInput } from '@/lib/home-first-screen';
import { papicGlance } from '@/lib/papic-glance';
import { fixtureControl } from '@/lib/home-control-fixture';
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
    control: fixtureControl('e1', { next }),
    papicLeft: g.count,
    // The page's own shape: `next: 'plan'` and no `whileNext` (page.tsx `homeServicesInput`).
    services: homeServices({ next: 'plan', storeShell: false, papic: g.status, papicDoors: { glance: g, line: g.line, buy: g.buy }, ai: 'Try it' }),
  };
  return renderToStaticMarkup(React.createElement(Screen!, props));
}
const rowOf = (html: string) => html.slice(html.indexOf('data-home-service="papic"'));

for (const [name, tile, day] of [
  ['stopped at zero', { shotsLeft: 0, shotsTotal: 2000, photosGathered: 2000 }, '2026-12-19'],
  ['running low on the day', { shotsLeft: 140, shotsTotal: 2000, photosGathered: 1860 }, '2026-10-14'],
] as const) {
  test(`${name}: Today points at Papic, and the Papic row draws its own Buy more — nothing marked to stand down`, () => {
    const html = home(tile, day);
    assert.match(html, /data-home-today="papic"/, 'Papic is not Today here — the fixture is stale');
    const row = rowOf(html);
    assert.match(row, /aria-label="Buy more"/, `${name}: the row drew no Buy more — Home would have no way to buy`);
    assert.doesNotMatch(row, /data-while-next/, `${name}: a part of the row is marked to stand down`);
  });
}

test('at zero the row keeps its "stopped" words, plainly', () => {
  const row = rowOf(home({ shotsLeft: 0, shotsTotal: 2000, photosGathered: 2000 }, '2026-12-19'));
  assert.match(row, /Your cameras have stopped/);
  assert.doesNotMatch(row, /data-while-next/);
});

test('…and nothing hides a marked part any more; Later folds the Today line only', () => {
  assert.doesNotMatch(CSS, /\[data-while-next\] \{ display: none; \}/, 'the stand-down rule is back');
  const page = readFileSync(join(HERE, 'page.tsx'), 'utf8');
  assert.doesNotMatch(page.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), /whileNext:/, 'the page marks a service to stand down again');
  const parts = readFileSync(join(HERE, '_components', 'home-parts.tsx'), 'utf8');
  assert.match(parts, /if \(f\?\.folded\) \{\s*return \(\s*<p[^>]*data-home-today="later"/, 'Later no longer folds the Today line to its one line');
});
