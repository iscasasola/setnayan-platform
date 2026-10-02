/**
 * 🔥 `warmDynamic` HOLDS AGAINST THE INSTALLED REACT AND NEXT.
 *
 * `lib/warm-dynamic.ts` reaches into two shapes it does not own: the element
 * tree a `next/dynamic` component returns, and `React.lazy`'s `_init`/
 * `_payload`. If an upgrade changes either, warming would silently do nothing
 * and every Maker tool would open behind its placeholder again (measured
 * 400–800 ms on a phone). These cases use the REAL app-router `dynamic`
 * (`next/dist/shared/lib/app-dynamic`, what `next/dynamic` is inside `app/`)
 * and the REAL `react-dom/server`, so they fail on the upgrade, not in a phone.
 *
 *   1. a cold dynamic component suspends on its first render (the cost);
 *   2. warmed, it renders its real piece on the first render (the fix);
 *   3. a warm whose load FAILED leaves it loadable — the next render asks again
 *      and draws the piece (no tool is poisoned by a dropped connection);
 *   4. anything that is not a dynamic component is ignored.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Suspense, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { isDynamicComponent, warmDynamic, warmDynamicExports } from './warm-dynamic';

import appDynamic from 'next/dist/shared/lib/app-dynamic';

const dynamic = appDynamic as unknown as (
  loader: () => Promise<ComponentType<{ who?: string }>>,
  opts?: { loading?: ComponentType },
) => ComponentType<{ who?: string }>;

const Piece = ({ who = 'piece' }: { who?: string }) => createElement('b', null, `real ${who}`);
const Slot = () => createElement('i', null, 'placeholder');

/** What the FIRST synchronous render draws — renderToString never waits for a lazy. */
function firstRender(C: ComponentType<{ who?: string }>) {
  return renderToString(createElement(Suspense, { fallback: createElement('u', null, 'outer') }, createElement(C, { who: 'x' })));
}

test('1 · a cold next/dynamic component suspends on its first render', () => {
  const Cold = dynamic(() => Promise.resolve(Piece), { loading: Slot });
  assert.ok(isDynamicComponent(Cold), 'next/dynamic no longer returns a LoadableComponent — warm-dynamic cannot find it');
  assert.match(firstRender(Cold), /placeholder/, 'a cold dynamic piece drew without suspending — React.lazy changed; re-measure before trusting warm-dynamic');
});

test('2 · warmed, it draws the real piece on the first render — no placeholder', async () => {
  const Warm = dynamic(() => Promise.resolve(Piece), { loading: Slot });
  await warmDynamic(Warm);
  const html = firstRender(Warm);
  assert.match(html, /real x/, `a warmed piece still suspended: ${html}`);
  assert.doesNotMatch(html, /placeholder/);
});

test('3 · a failed warm is put back — the next render asks again and draws the piece', async () => {
  let calls = 0;
  const Flaky = dynamic(
    () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(Piece);
    },
    { loading: Slot },
  );
  await assert.rejects(warmDynamic(Flaky), /offline/, 'a failed warm must say so (the progress line must not fill)');
  // The render after the failure loads afresh (a second call) instead of throwing the old error.
  assert.match(firstRender(Flaky), /placeholder/);
  assert.equal(calls, 2, 'the failed load was not retried — React.lazy kept the rejection');
  await new Promise((r) => setTimeout(r, 0));
  assert.match(firstRender(Flaky), /real x/);
});

test('4 · warmDynamicExports warms every dynamic export and ignores the rest', async () => {
  const A = dynamic(() => Promise.resolve(Piece), { loading: Slot });
  const B = dynamic(() => Promise.resolve(Piece));
  await warmDynamicExports({ A, B, helper: () => 1, value: 3, Plain: Piece });
  assert.match(firstRender(A), /real x/);
  assert.match(firstRender(B), /real x/);
  assert.equal(isDynamicComponent(Piece), false);
  await warmDynamic(Piece); // a plain component: nothing to do, no throw
});
