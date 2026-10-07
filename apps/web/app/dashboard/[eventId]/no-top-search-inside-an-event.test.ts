/**
 * no-top-search-inside-an-event.test.ts — INSIDE AN EVENT THE TOP BAR HAS NO
 * SEARCH; ON THE ACCOUNT PAGES IT STILL DOES.
 *
 * Owner 2026-10-08, looking at the round search button with ⌘K beside the
 * messages and notifications buttons inside an event: *"when we enter and
 * event dashboard. i don't think we need search on top anymore"*.
 *
 * Rendered, not grepped: the palette trigger is the only `aria-haspopup=
 * "dialog"` button the bar draws and the only place "⌘K" is printed, so its
 * absence in the markup is the property itself. The wiring half (who decides
 * "inside an event") is a source read, because it lives in a server component.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

// The components compile with the classic JSX runtime under tsx.
(globalThis as unknown as { React: unknown }).React = React;

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

async function renderBar(pathname: string, insideEvent: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime');
  const { HomeCommandBar } = await import('@/app/dashboard/(launcher)/_components/home-command-bar');
  const { InsideEventContext } = await import('@/app/_components/frontdoor/inside-event-context');
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        PathnameContext.Provider,
        { value: pathname },
        React.createElement(
          InsideEventContext.Provider,
          { value: insideEvent },
          React.createElement(HomeCommandBar, { items: [], variant: 'rail' }),
        ),
      ),
    ),
  );
}

const PALETTE_TRIGGER = /aria-haspopup="dialog"/;

test('an event page’s top bar draws no search button and no ⌘K', async () => {
  for (const path of ['/dashboard/S89E-ABCDEFGHJK', '/dashboard/S89E-ABCDEFGHJK/vendors']) {
    const html = await renderBar(path, true);
    assert.doesNotMatch(html, PALETTE_TRIGGER, `${path}: the top-bar search button is back inside an event`);
    assert.doesNotMatch(html, /⌘K/, `${path}: the ⌘K hint is back inside an event`);
  }
});

test('an account page’s top bar still has the search button and its ⌘K', async () => {
  for (const path of ['/dashboard', '/dashboard/profile']) {
    const html = await renderBar(path, false);
    assert.match(html, PALETTE_TRIGGER, `${path}: the account-level search button disappeared`);
    assert.match(html, /⌘K/, `${path}: the ⌘K hint disappeared from an account page`);
  }
});

test('"inside an event" is the event layout’s studioEventId — and only it sets it', () => {
  const APP = join(process.cwd(), 'app');
  const shell = stripComments(readFileSync(join(APP, '_components', 'frontdoor', 'app-rail-shell.tsx'), 'utf8'));
  assert.match(shell, /insideEvent=\{Boolean\(studioEventId\)\}/, 'AppRailShell no longer derives insideEvent from studioEventId');
  const fds = stripComments(readFileSync(join(APP, '_components', 'frontdoor', 'front-door-shell.tsx'), 'utf8'));
  assert.match(fds, /<InsideEventContext\.Provider value=\{insideEvent\}>/, 'FrontDoorShell no longer tells the top-bar search it is inside an event');
  const bar = stripComments(readFileSync(join(APP, 'dashboard', '(launcher)', '_components', 'home-command-bar.tsx'), 'utf8'));
  assert.match(bar, /useContext\(InsideEventContext\)/, 'the top-bar search stopped reading the inside-an-event switch');
  // Every layout that passes studioEventId is, by that act, inside an event.
  // An account layout passing it would strip the account search silently.
  const passers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== 'node_modules') walk(p);
      } else if (name === 'layout.tsx' && /studioEventId=/.test(readFileSync(p, 'utf8'))) {
        passers.push(p.slice(APP.length + 1));
      }
    }
  };
  walk(APP);
  assert.deepEqual(passers, [join('dashboard', '[eventId]', 'layout.tsx')]);
});
