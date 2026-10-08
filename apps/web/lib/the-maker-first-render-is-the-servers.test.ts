/**
 * 🧷 THE MAKER'S FIRST RENDER IN THE BROWSER IS THE SERVER'S.
 *
 * Measured by the controller on 2026-10-08 (375 × 812, the dev lab, idle): open
 * the new Maker, tap Studio › Look, load the Maker again — React threw
 * "Hydration failed because the server rendered HTML didn't match the client",
 * and the lines only the browser had were the guest's tab bar
 * (`<nav data-stage-guest-bar>`), right after the part's edges.
 *
 * The cause was one line in the Stages panel: the Maker's shell was looked up
 * in the page WHILE RENDERING (`typeof document === 'undefined' ? null :
 * document.querySelector('[data-maker-shell]')`). The server has no page, so it
 * drew no bar; the browser has one, so its first render drew the bar. React
 * hydrates a portal's children against the tree around it, finds no <nav>
 * there, refuses the server's panel and builds it again in the browser.
 *
 * WHAT THIS TESTS — the claim itself, on the real component: the Stages panel
 * is rendered twice with the same props, once as the server renders it (no
 * `document`, no `window`) and once as the browser's FIRST render computes it
 * (a page that holds the Maker's shell, exactly as the server's HTML gives the
 * browser; no effect has run — `renderToString` runs none). The rule React
 * holds a hydrating render to: outside its portals the HTML is the server's,
 * and a portal draws NOTHING (an empty portal is harmless — the part's edges
 * are one; a portal with an element in it is the fault). The server renderer
 * refuses a portal outright, so for these two renders `createPortal` is stood
 * in by a marker element that shows what the portal would have drawn.
 *
 * WHAT IT DOES NOT TEST: a real browser hydrating a real page (there is no DOM
 * in this suite). That is measured by hand on the review server — see the
 * changelog fragment.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';

/* The panel's own imports reach server actions; their `server-only` mark is the house shim's
   (a-background-pick-shows-at-once). The same door stands a marker in for `createPortal`. */
(globalThis as unknown as { React: unknown }).React = React;
const PORTAL = 'sn-portal';
{
  const Mod = require('node:module');
  const load = Mod._load;
  let dom: unknown = null;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    const real = load.call(this, request, ...rest);
    if (request !== 'react-dom') return real;
    dom ??= { ...real, createPortal: (children: React.ReactNode) => React.createElement(PORTAL, null, children) };
    return dom;
  };
}

const PANEL = '../app/dashboard/[eventId]/launch/_components/stage-tools.tsx';
const SRC = stripComments(readFileSync(join(import.meta.dirname, PANEL), 'utf8'));

/** A page that holds the Maker's shell — what the browser has when it hydrates the server's HTML. */
function browserLike() {
  const rect = { top: 0, left: 0, right: 375, bottom: 812, width: 375, height: 812 };
  const shell = { nodeType: 1, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [], getBoundingClientRect: () => rect };
  const document = {
    querySelector: (sel: string) => (sel.includes('[data-maker-shell]') ? shell : null),
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    body: shell,
    documentElement: shell,
  };
  const store = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const window = {
    document,
    innerWidth: 375,
    innerHeight: 812,
    location: { href: 'http://localhost/dev/maker-lab?studio=1', origin: 'http://localhost', search: '?studio=1' },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: store,
    sessionStorage: store,
  };
  return { document, window };
}

const GLOBALS = ['document', 'window'] as const;

async function firstRender(env: 'server' | 'browser'): Promise<string> {
  const { renderToString } = await import('react-dom/server');
  const { StageTools } = await import(PANEL);
  const g = globalThis as Record<string, unknown>;
  const before = GLOBALS.map((k) => [k, Object.prototype.hasOwnProperty.call(g, k), g[k]] as const);
  if (env === 'browser') Object.assign(g, browserLike());
  try {
    return renderToString(
      React.createElement(StageTools, {
        stage: 'event',
        rsvpOpen: false,
        options: [],
        value: '',
        onPickPage: () => {},
        onOpenStudio: () => {},
        suppliersHref: '/dashboard/EV/vendors',
        onPx: () => {},
      }),
    );
  } finally {
    for (const [k, had, was] of before) {
      if (had) g[k] = was;
      else delete g[k];
    }
  }
}

/** What each portal of a render would draw. */
const portals = (html: string) => [...html.matchAll(new RegExp(`<${PORTAL}>([\\s\\S]*?)</${PORTAL}>`, 'g'))].map((m) => m[1]!);
const outsidePortals = (html: string) => html.replace(new RegExp(`<${PORTAL}>[\\s\\S]*?</${PORTAL}>`, 'g'), '');

test('the Stages panel’s first render in the browser is the server’s — the same HTML, and no portal draws an element', async () => {
  const server = await firstRender('server');
  assert.match(server, /data-stage-tools/, 'the panel did not render on the server at all — this test would compare two blanks');
  assert.deepEqual(portals(server), [], 'the server drew a portal');
  const browser = await firstRender('browser');
  assert.ok(portals(browser).length > 0, 'the browser-like render reached no portal — the stand-in page is not being seen, so this test proves nothing');
  for (const drawn of portals(browser)) {
    assert.equal(drawn, '', `a portal draws an element on the browser's FIRST render — the server's HTML has nothing for it, so React refuses the server's panel: ${drawn.slice(0, 160)}`);
  }
  assert.equal(outsidePortals(browser), server, 'the browser’s first render differs from the server’s HTML');
});

test('the guest bar’s host is found after the first render, never during it', () => {
  assert.doesNotMatch(SRC, /typeof (?:document|window) (?:===|!==) 'undefined'/, 'a render-time "am I in a browser?" branch is back in the Stages panel — the two first renders can differ again');
  // The bar is still drawn into the shell (it must sit over the page, under the panel) — only the lookup moved.
  assert.match(SRC, /const \[shellEl, setShellEl\] = useState<HTMLElement \| null>\(null\);/);
  assert.match(SRC, /useLayoutEffect\(\(\) => setShellEl\(document\.querySelector<HTMLElement>\('\[data-maker-shell\]'\)\), \[\]\);/);
  assert.match(SRC, /\{shellEl && !away\s*\? createPortal\(\s*<nav[\s\S]{0,120}data-stage-guest-bar=""/, 'the guest bar is no longer the shell’s portal');
});
