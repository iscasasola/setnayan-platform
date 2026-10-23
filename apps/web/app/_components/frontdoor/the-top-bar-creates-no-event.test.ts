/**
 * the-top-bar-creates-no-event.test.ts — the shared top bar carries no
 * "+ Create event", at any width, on any couple surface.
 *
 * Owner, 22 Oct 2026 ("follow your recommendation"): the account-bar ruling of
 * the same day put Create on the Events board — the Planning header's (+) and
 * "Create an event" — and the phone's bar had already lost it. At ≥ 1024 the
 * shell still drew its DEFAULT "+ Create event" on every couple tree. The
 * default is now nothing.
 *
 * 🔑 A PROPERTY, BY RENDERING. A CSS `display:none` would leave the button in
 * the markup and a width check could only ever test the widths it tried, so
 * "at any width" is proved the only way it can be: the button is not in the
 * HTML at all. The shell is painted signed in, both variants, with the slot
 * left unsaid (every couple layout) and with `null` (HQ), and the bar is read
 * out of the markup. The Shop's own button — the one surface that hands a
 * create in — must still paint, so a guard that read nothing cannot pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only' || /\.css$/.test(request)) return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

type Slot = { createSlot?: React.ReactNode };

async function paint(variant: 'app' | 'front-door', slot: Slot, pathname = '/dashboard') {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime');
  const { FrontDoorShell } = await import('./front-door-shell');
  const shell = React.createElement(
    FrontDoorShell,
    {
      variant,
      account: { signedIn: true, initials: 'AM', shopName: null, isAdmin: false },
      navLabels: {},
      ...slot,
    } as unknown as React.ComponentProps<typeof FrontDoorShell>,
    React.createElement('main', null, 'page'),
  );
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(PathnameContext.Provider, { value: pathname }, shell),
    ),
  );
}

/** The top bar's own markup — the `.fd-topbar` element up to the body. */
function topBar(html: string): string {
  const at = html.search(/<[a-z]+\b[^>]*class="[^"]*\bfd-topbar\b/);
  assert.ok(at >= 0, 'the shell painted no `.fd-topbar` — this guard is reading the wrong markup');
  const body = html.indexOf('fd-body', at);
  return html.slice(at, body > at ? body : undefined);
}

const EVENT_CREATE = /href="\/dashboard\/create-event[^"]*"|Create event/;

test('no "+ Create event" in the bar — every couple surface, both variants, slot unsaid or null', async () => {
  let painted = 0;
  for (const variant of ['app', 'front-door'] as const) {
    for (const [why, slot] of [
      ['unsaid (every couple layout)', {}],
      ['null (HQ)', { createSlot: null }],
    ] as const) {
      for (const path of ['/dashboard', '/dashboard/people', '/']) {
        const bar = topBar(await paint(variant, slot, path));
        assert.ok(bar.length > 200, `the ${variant} bar read back nearly empty — re-point this guard`);
        assert.ok(/fd-avatar|Your account|fd-topright/.test(bar), `the ${variant} bar painted no account cluster — signed-in render failed`);
        assert.ok(
          !EVENT_CREATE.test(bar),
          `the ${variant} bar (${why}, ${path}) draws a "Create event" door — Create lives on the Events board (owner 2026-10-22)`,
        );
        assert.ok(!/fd-btn-gold/.test(bar), `the ${variant} bar (${why}) paints a gold create button nobody handed in`);
        painted++;
      }
    }
  }
  assert.equal(painted, 12);
});

test("the Shop's own create still paints — the slot is not swallowed", async () => {
  const shop = React.createElement('a', { href: '/vendor-dashboard/services/new', className: 'fd-btn-gold' }, '+ Create service card');
  const bar = topBar(await paint('app', { createSlot: shop }, '/vendor-dashboard'));
  assert.match(bar, /\+ Create service card/, "the surface's own create button no longer reaches the bar");
  assert.ok(!EVENT_CREATE.test(bar), 'the Shop bar offers a couple event');
});

test('no layout hands the bar an event-create button through the slot', () => {
  // The render above proves the default; this proves no surface puts it back.
  const hits: string[] = [];
  let scanned = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== 'node_modules' && name !== '.next') walk(p);
        continue;
      }
      if (!/\.tsx$/.test(name) || /\.test\./.test(name)) continue;
      const src = stripComments(readFileSync(p, 'utf8'));
      if (!/createSlot=\{/.test(src)) continue;
      scanned++;
      const at = src.indexOf('createSlot={');
      // The slot's own expression — up to the next prop on the shell.
      const window = src.slice(at, at + 600);
      if (/\/dashboard\/create-event|Create event/.test(window)) hits.push(p.slice(WEB.length + 1));
    }
  };
  walk(join(WEB, 'app'));
  assert.ok(scanned >= 2, `found ${scanned} createSlot callers — expected the Shop and HQ at least; this scan reads nothing`);
  assert.deepEqual(hits, [], `a surface hands the bar a Create-event button: ${hits.join(', ')}`);
});
