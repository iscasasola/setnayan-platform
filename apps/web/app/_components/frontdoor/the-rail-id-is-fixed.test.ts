/**
 * the-rail-id-is-fixed.test.ts — the ☰ button names its rail with an id that
 * does not depend on where the shell sits in the tree.
 *
 * QA 2026-10-22 (F3): app pages logged a hydration attribute mismatch — the ☰
 * button's `aria-controls` and the rail `<nav id>` were a `useId()`, and the
 * client computed a different one than the server (`_R_5bn…` vs `_R_pbn…`).
 * BISECTED (lab `/dev/home-lab?shell=1`, `/dev/suppliers-lab?shell=1`, 3 loads
 * each, WebKit iPhone 375 + Chromium 1280):
 *   · the QA tree (eee049e3d7, before #6774): 3 of 8 loads warned;
 *   · main at 3c18aed168 (after #6774 removed the PostHog provider): 0 of 12;
 *   · 3c18aed168 + ONLY a `<Suspense><useSearchParams tracker/></Suspense>`
 *     sibling before `{children}` in the root providers — the PostHog
 *     provider's shape: 4 of 12, the same two ids.
 * A `useId` moves whenever anything above the shell renders a different shape
 * on the client, and a provider of that shape can come back at any time. The
 * shell is mounted once per page, so the rail's id is a fixed constant.
 *
 * Property, by RENDERING: the shell painted under two different ancestor
 * shapes gives the ☰ the same `aria-controls`, and that id names the rail in
 * the same markup.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only' || /\.css$/.test(request)) return {};
    return load.call(this, request, ...rest);
  };
}

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

async function paint(wrap: (el: React.ReactElement) => React.ReactElement) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime');
  const { FrontDoorShell } = await import('./front-door-shell');
  const shell = React.createElement(
    FrontDoorShell,
    {
      variant: 'app',
      boundary: 'tab',
      account: { signedIn: true, initials: 'AM', shopName: null, isAdmin: false },
      navLabels: {},
    } as unknown as React.ComponentProps<typeof FrontDoorShell>,
    React.createElement('main', null, 'page'),
  );
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(PathnameContext.Provider, { value: '/dashboard' }, wrap(shell)),
    ),
  );
}

function wiring(html: string) {
  const button = /<button\b[^>]*aria-label="Menu"[^>]*>/.exec(html)?.[0] ?? '';
  const controls = /aria-controls="([^"]+)"/.exec(button)?.[1] ?? null;
  const navId = /<nav\b[^>]*class="fd-rail"[^>]*>/.exec(html)?.[0].match(/\bid="([^"]+)"/)?.[1] ?? null;
  const navId2 = /<nav\b[^>]*\bid="([^"]+)"[^>]*class="fd-rail"/.exec(html)?.[1] ?? null;
  return { button, controls, nav: navId ?? navId2 };
}

test('the ☰ names its rail with the same id whatever sits above the shell (F3)', async () => {
  const plain = wiring(await paint((el) => el));
  // A different ancestor shape: a sibling Suspense before the shell, inside an extra fragment level.
  const shaped = wiring(
    await paint((el) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(React.Suspense, { fallback: null }, React.createElement('span')),
        React.createElement('div', null, React.createElement('i'), el),
      ),
    ),
  );
  console.log(`[rail-id] plain ${plain.controls} → ${plain.nav} · shaped ${shaped.controls} → ${shaped.nav}`);
  assert.ok(plain.button, 'the shell painted no ☰ button — re-point this guard');
  assert.ok(plain.controls, 'the ☰ names no rail (aria-controls missing)');
  assert.equal(plain.nav, plain.controls, 'the ☰ names an id the rail does not carry');
  assert.equal(shaped.nav, shaped.controls, 'the ☰ names an id the rail does not carry');
  assert.equal(
    shaped.controls,
    plain.controls,
    "the rail's id moved with the tree above the shell — a provider of a different shape on the client is a hydration mismatch on every app page",
  );
});
