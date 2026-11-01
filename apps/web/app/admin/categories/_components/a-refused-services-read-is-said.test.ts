/**
 * a-refused-services-read-is-said.test.ts — 🔒 when the services read is REFUSED, Admin › Categories says it could not
 * load them; it never draws the refusal as "No service yet", a "no service" pill, "0 of 0 here", or a category counted
 * under "Needs a look · N without a service" (walk 2026-11-01: signed out, the lab's services read is refused and the
 * map told the admin every category had no service — 80 of them).
 *
 * The house rule (`load.ts` / `load-map.ts`): a refused read is SAID, never shown as empty. Parts and cards already
 * carried `partsRead` / `cardsRead`; services now carry `servicesRead`, set from `loadCategories`'s own `failed`.
 *
 * Held against the REAL rendered map (the desktop columns and the phone view both render server-side) and the pure
 * model, on the same fixture with only the services taken away — so the only difference between the two renders is
 * whether the empty list was READ or REFUSED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { FIXTURE } from './four-level-fixture';
import { gapCategories, needsCount, partLinkSummary, type MapData } from './four-level-model';

(globalThis as unknown as { React: unknown }).React = React;
// The map imports its server actions; `server-only` refuses to load outside Next (the-camera-is-the-whole-screen.test.ts).
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

/** The same tree with no services: READ (genuinely none) vs REFUSED (unknown). */
const READ_EMPTY: MapData = { ...FIXTURE, services: [], servicesRead: true };
const REFUSED: MapData = { ...FIXTURE, services: [], servicesRead: false };

async function renderMap(d: MapData): Promise<string> {
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { FourLevelMap } = await import('./four-level-map');
  const map = React.createElement(FourLevelMap, {
    data: d,
    start: { in: 'c:reception', at: '', open: '' },
    q: '',
    show: '',
    drawer: null,
    counts: '',
    groupDefaultIcon: {},
  } as never);
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, map));
}

const NO_SERVICE_YET = 'No service yet';
const COULDNT = 'Couldn’t load the services';
const has = (html: string, words: string) => html.includes(words) || html.includes(words.replace(/’/g, '&#x27;'));

test('the control: a services list READ as empty still says "No service yet" (the words this guard must not fire on)', async () => {
  const html = await renderMap(READ_EMPTY);
  assert.ok(has(html, NO_SERVICE_YET), 'a genuinely empty category must still say so');
  assert.ok(!has(html, COULDNT));
});

test('a REFUSED services read says it could not load them — never "No service yet"', async () => {
  const html = await renderMap(REFUSED);
  assert.ok(has(html, COULDNT), 'the refusal must be said on the map');
  assert.ok(!has(html, NO_SERVICE_YET), 'a refused read rendered as an empty category');
  // No category tile claims the gap either (the amber "no service" pill).
  assert.ok(!/>no service</.test(html), 'a category tile says "no service" for a read that was refused');
});

test('the model counts no category as missing a service it could not read, and claims no "0 of 0 here"', () => {
  assert.ok(gapCategories(READ_EMPTY).length > 0, 'control: a READ empty list is a gap');
  assert.equal(gapCategories(REFUSED).length, 0);
  assert.equal(needsCount(REFUSED), needsCount(READ_EMPTY) - gapCategories(READ_EMPTY).length);
  for (const p of REFUSED.parts.filter((x) => x.services.length > 0)) {
    const s = partLinkSummary(REFUSED, p);
    assert.ok(!/\b0 of\b/.test(s.text), `${p.key}: "${s.text}" states a count of services nobody read`);
  }
});

/** A client whose every read is refused — any chain of builder calls ends in `{ data: null, error }`. */
function refusingClient(): unknown {
  const refused = { data: null, error: { message: 'permission denied (test)', code: '42501' }, count: null };
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => unknown) => Promise.resolve(refused).then(ok) : chain),
    apply: () => chain,
  });
  return { from: () => chain };
}

test('the loader carries `loadCategories`’s refusal of the services onto the map — and only that refusal', async () => {
  const { loadMapData } = await import('./load-map');
  const cats = (failed: string[]) =>
    ({ groups: [], categories: [], services: [], tax: { hiddenCategories: {}, tileCoarseCategory: {} }, failed }) as never;
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.equal((await loadMapData(refusingClient() as never, cats(['services']))).servicesRead, false);
    assert.equal((await loadMapData(refusingClient() as never, cats(['deadlines']))).servicesRead, true);
  } finally {
    console.error = quiet;
  }
});
