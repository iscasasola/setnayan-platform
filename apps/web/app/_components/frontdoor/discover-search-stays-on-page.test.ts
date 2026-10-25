/**
 * discover-search-stays-on-page.test.ts — DISCOVER ANSWERS ON DISCOVER (owner 2026-10-24).
 *
 * Owner, on Discover, typed "seda" and pressed search: the app left for `/dashboard/search` — "Results for “seda” ·
 * 1 thing · Clear", the search row gone — *"it went to a different page?"*. Pressing Clear there landed on a page that
 * said only "Type what you're looking for in the search at the top." — no search at the top, none at the bottom:
 * stuck. Ruling: *"we will show the result on the page itself. not a new screen."*
 *
 * Held here, each at the grain it can be held:
 *   1. the Discover row's every navigation keeps the page it stands on — only `?q=` changes (`stayOnPageSearchHref`,
 *      executed), and the row reaches no other destination (source);
 *   2. `/?q=` for a member is not sent anywhere — `app/page.tsx` redirects nothing, and `FrontDoor` draws the results
 *      in the sections' place, under the same row, in the shell's form;
 *   3. AN EMPTY QUERY IS DISCOVER, NEVER A BLANK PAGE — `FrontDoor` trims and draws the feed for no words, and the old
 *      results address with no words goes to `/` before it draws anything; the "search at the top" sentence is gone;
 *   4. a supplier the couple added themselves reads "Your own supplier · on {event}" (executed);
 *   5. nothing found, with an event to file it under: the last row is the shipped add (rendered).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { stayOnPageSearchHref } from '@/lib/shell-search';
import { ownSupplierItems, YOUR_OWN_SUPPLIER, ON_YOUR_EVENT } from '@/lib/own-supplier-items';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The add row's walk imports the shipped server actions, whose modules import `server-only` (the guests render
     harness does the same); a CSS module is its class names. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the Discover row only ever edits ?q= on the address it stands on', () => {
  for (const here of ['/', '/?q=seda', '/dev/search-lab?state=discover', '/dev/search-lab?state=discover&q=old']) {
    const base = new URL(here, 'https://x.test');
    for (const words of ['seda', '  Seda Vertis North ', 'doves & lilies', '']) {
      const href = stayOnPageSearchHref(`https://x.test${here}`, words);
      const to = new URL(href, 'https://x.test');
      assert.equal(to.pathname, base.pathname, `${here} + "${words}" left the page for ${to.pathname}`);
      assert.equal(to.searchParams.get('q'), words.trim() || null, `${here} + "${words}": the words did not ride in ?q=`);
      for (const [k, v] of base.searchParams) if (k !== 'q') assert.equal(to.searchParams.get(k), v, `${here}: dropped ${k}`);
    }
  }
});

test('1 · the Discover row reaches no other destination', () => {
  const src = code('app/_components/frontdoor/shell-thumb-rows.tsx');
  const row = src.slice(src.indexOf('export function DiscoverThumbRow'));
  assert.ok(row.length > 100, 'premise: DiscoverThumbRow moved — re-anchor');
  const pushes = [...row.matchAll(/router\.(push|replace)\(([^,)]*)/g)].map((m) => m[2]!.trim());
  assert.ok(pushes.length > 0, 'premise: the row navigates nowhere — the search would do nothing');
  for (const p of pushes) assert.match(p, /^stayOnPageSearchHref\(window\.location\.href\b/, `the Discover row navigates to ${p}`);
  assert.doesNotMatch(row, /useEnterSearches|searchRowHref|marketplaceEscapeItem|href:/, 'the Discover row gained a second destination');
});

test('2 · a member’s /?q= stays on / and draws the results in the sections’ place', () => {
  assert.doesNotMatch(code('app/page.tsx'), /redirect\(/, 'app/page.tsx sends a search somewhere else again');
  const fd = code('app/_components/frontdoor/front-door.tsx');
  assert.match(fd, /<DiscoverThumbRow key=\{searchQuery\} q=\{searchQuery\} \/>/, 'the row is not redrawn with the words it searched');
  assert.match(fd, /\{searchQuery \? \(\s*shellSearch \? \(\s*<div data-discover-results="" data-search-results="">\s*<FrontDoorResults[\s\S]*?place="discover"/);
});

test('3 · an empty query renders the normal Discover feed, never a blank page', () => {
  const fd = code('app/_components/frontdoor/front-door.tsx');
  assert.match(fd, /const searchQuery = \(q \?\? ''\)\.trim\(\);/, 'the words are no longer trimmed — "   " would be a search');
  // No words → the sections; the results only ever stand in their place.
  assert.match(fd, /\) : \(\s*<>\s*<FrontDoorFeed\b/, 'with no words, Discover no longer draws its feed');
  // The old results address with no words: back to Discover before anything is drawn.
  const page = code('app/dashboard/(account)/search/page.tsx');
  const bare = page.indexOf("if (!query) redirect('/');");
  assert.ok(bare > 0, '/dashboard/search with no words no longer goes back to Discover');
  assert.ok(bare < page.indexOf('return ('), 'the empty page draws something before it goes back');
  // Clear on Discover's results is Discover.
  const results = code('app/_components/frontdoor/front-door-results.tsx');
  assert.match(results, /<Link href=\{place === 'shell' \? SHELL_SEARCH_PATH : '\/'\} className="fd-sechead-go">/);
  for (const f of ['app/dashboard/(account)/search/page.tsx', 'app/_components/frontdoor/front-door.tsx', 'app/_components/frontdoor/front-door-results.tsx']) {
    assert.doesNotMatch(code(f), /in the search at the top/, `${f} points at a search that is not there`);
  }
});

test('4 · a supplier you added yourself says so — and a shop on your event still says "On your event"', () => {
  const events = [{ event_id: 'e1', display_name: 'Indalecio & Claire' }];
  const [own, shop, unread] = ownSupplierItems(events, [
    { vendor_id: 'v1', event_id: 'e1', vendor_name: 'Seda Vertis North', marketplace_vendor_id: null },
    { vendor_id: 'v2', event_id: 'e1', vendor_name: 'Lumina Studio', marketplace_vendor_id: 'p-lumina' },
    { vendor_id: 'v3', event_id: 'e1', vendor_name: 'Not read' },
  ]);
  assert.equal(own!.sublabel, `${YOUR_OWN_SUPPLIER} · on Indalecio & Claire`);
  assert.equal(shop!.sublabel, `${ON_YOUR_EVENT} · Indalecio & Claire`);
  assert.equal(unread!.sublabel, `${ON_YOUR_EVENT} · Indalecio & Claire`, 'an unread column must not claim "your own"');
  assert.equal(YOUR_OWN_SUPPLIER, 'Your own supplier');
});

test('5 · nothing found on Discover: the last row is the shipped add, a button, never a link', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DiscoverAddOwn } = await import('./discover-add-own');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const router = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
  const html = renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: router as never },
      React.createElement(DiscoverAddOwn, {
        query: 'seda',
        eventId: 'e1',
        eventName: 'Indalecio & Claire',
        categories: [{ category: 'catering', tile: 'catering', label: 'Catering' }],
      }),
    ),
  );
  assert.match(html, /aria-label="Add “seda” as your own supplier"/);
  assert.doesNotMatch(html, /href=/, 'the add row navigates');
  const src = code('app/_components/frontdoor/discover-add-own.tsx');
  assert.match(src, /<AddYourOwnWalk\b[\s\S]*?initialName=\{query\}/, 'the add does not open the shipped walk with the name filled in');
  const results = code('app/_components/frontdoor/front-door-results.tsx');
  // 2026-10-25: Discover draws its own results (`DiscoverResults`) — the add follows "nothing shown", and never a
  // search that could not finish (a refused read is not "nothing found").
  assert.match(results, /shown === 0 && !incomplete && addOwnEvent \? \(\s*<DiscoverAddOwnSlot/, 'the add is drawn outside "nothing found on Discover"');
});
