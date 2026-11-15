/**
 * discover-way-back.test.ts — A WAY BACK FROM WHAT DISCOVER OPENS; THE HOST'S EVENT PAGE GETS ONE ONLY FROM DISCOVER.
 *
 * 2026-11-12, DECISION_LOG "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED WITH FOUR ANSWERS". Owner, verbatim: *"and
 * then when we enter a shop, event or anything, we should be able to go back to home"*; answer 3: a back button on
 * someone's public event page shows ONLY to a visitor who arrived from Discover, never to an invited guest.
 *
 * What it holds:
 *   1. THE MARKER: Discover's event cards put `?via=discover` on the event's address (query and #hash kept); the event
 *      page reads exactly that, and can take it back out. Cold ("home"): Discover signed out, Home signed in.
 *   2. THE EVENT PAGE: no back control by default — the server draws nothing (the first render is empty), the browser
 *      draws `‹ Discover` only when the address carries the marker; it returns in place, and the map says `/[slug]`
 *      works its back out per visit.
 *   3. NO LEAK: the marker is touched by three files only (this module, the card that sets it, the button that reads
 *      it) — so no canonical URL, OG tag, sitemap, share or copy-link can carry it; no server code reads `via`
 *      (it is in neither the page's query type nor the Event Hub's live params — the cached hub still answers); and
 *      the reader strips it from the address at once.
 *   4. THE DOORS: Discover's event card carries the marker on its event link, and Discover's shelves and search
 *      results draw their events through that one card.
 *
 * Sabotage (each must fail, 2026-11-12, red then restored): the card's link back to `card.href`; the button drawn
 * without the arrival check; the `replaceState` strip removed; `withDiscoverArrival` used in the sitemap; `via` added
 * to the page's query type.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';

import { stripComments } from '@/lib/strip-comments';
import { WEB } from '@/lib/design-rules-scan';
import { pageHome } from '@/lib/page-home';
import { HUB_LIVE_PARAMS } from '@/lib/hub-view-key';
import {
  DISCOVER_ARRIVAL_PARAM,
  arrivedFromDiscover,
  coldWayBack,
  withDiscoverArrival,
  withoutDiscoverArrival,
} from '@/lib/discover-way-back';

(globalThis as unknown as { React: unknown }).React = React;

const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const CARD = 'app/_components/frontdoor/discover-event-card.tsx';
const READER = 'app/[slug]/_components/discover-arrival-back.tsx';
const EVENT_PAGE = 'app/[slug]/page.tsx';

/* ── 1 · the marker ─────────────────────────────────────────────────────────────────────────────────────────────── */

test('the marker: on, read, and taken off — the address is otherwise untouched', () => {
  assert.equal(DISCOVER_ARRIVAL_PARAM, 'via');
  assert.equal(withDiscoverArrival('/maria-and-jose'), '/maria-and-jose?via=discover');
  assert.equal(withDiscoverArrival('/maria-and-jose?tab=schedule#map'), '/maria-and-jose?tab=schedule&via=discover#map');
  assert.ok(arrivedFromDiscover('?via=discover'));
  assert.ok(arrivedFromDiscover('tab=x&via=discover'));
  for (const s of ['', '?', '?invite=abc', '?via=explore', '?src=discover', '?from=landing']) assert.ok(!arrivedFromDiscover(s), s);
  assert.equal(withoutDiscoverArrival('/maria-and-jose?tab=schedule&via=discover#map'), '/maria-and-jose?tab=schedule#map');
  assert.equal(withoutDiscoverArrival('/maria-and-jose?via=discover'), '/maria-and-jose');
});

test('home, for a page opened cold: Discover signed out, Home signed in', () => {
  assert.deepEqual(coldWayBack(false), { href: '/', label: 'Discover' });
  assert.deepEqual(coldWayBack(true), { href: '/dashboard?hub=1', label: 'Home' });
});

/* ── 2 · the event page ─────────────────────────────────────────────────────────────────────────────────────────── */

test('the event page shows NO back control by default — the first render is empty', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DiscoverArrivalBack } = await import('@/app/[slug]/_components/discover-arrival-back');
  assert.equal(renderToStaticMarkup(React.createElement(DiscoverArrivalBack)), '', 'the host’s page draws a back for everyone');
});

test('the event page shows ‹ Discover WITH the marker, returning in place', () => {
  const r = src(READER);
  assert.match(r, /^\s*(['"])use client\1/, 'the reader must run in the browser — the server never sees the marker');
  // Nothing until the address is read, and only when it carries the marker.
  assert.match(r, /useState<string \| null>\(null\)/);
  assert.match(r, /if \(!arrivedFromDiscover\(window\.location\.search\)\) return;/);
  assert.match(r, /if \(arrivedAt === null\) return null;/);
  const check = r.indexOf('arrivedFromDiscover(window.location.search)');
  const set = r.indexOf('setArrivedAt(');
  assert.ok(check > -1 && set > check, 'the button is switched on before (or without) the arrival check');
  assert.equal((r.match(/setArrivedAt\(/g) ?? []).length, 1, 'one way to switch it on');
  // The shipped BackButton, in place (while still where the visit arrived).
  assert.match(r, /<BackButton href="\/" label="Discover" className="mb-0" inPlace=\{\{ whileAt: arrivedAt \}\} \/>/);
  // The page mounts it once; the map says the route works its back out per visit.
  assert.equal((src(EVENT_PAGE).match(/<DiscoverArrivalBack \/>/g) ?? []).length, 1);
  assert.deepEqual(pageHome('/[slug]'), { kind: 'none', reason: 'computed', by: 'lib/discover-way-back.ts' });
  // Its sub-pages still go back to the event's own hub.
  assert.equal((pageHome('/[slug]/invite/reply') as { home: string }).home, '/[slug]');
});

/* ── 3 · no leak ─────────────────────────────────────────────────────────────────────────────────────────────────── */

function sources(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '.next') continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|mjs)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(relative(WEB, p));
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  out.push('middleware.ts');
  return out;
}

/** Who may touch the marker, and with what. Everything else touching it is a leak. */
const ALLOWED: Readonly<Record<string, RegExp>> = {
  'lib/discover-way-back.ts': /./,
  [CARD]: /^withDiscoverArrival$/,
  [READER]: /^(?:arrivedFromDiscover|withoutDiscoverArrival)$/,
  // The shop's top ‹ asks only for the cold "home".
  'lib/shop-back.ts': /^coldWayBack$/,
};

test('the marker reaches no canonical URL, OG tag, sitemap, share or copy-link — three files touch it', () => {
  const leaks: string[] = [];
  for (const rel of sources()) {
    let s: string;
    try {
      s = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    } catch {
      continue;
    }
    const allow = ALLOWED[rel];
    if (/via=discover|[?&]via=/.test(s) && rel !== 'lib/discover-way-back.ts') leaks.push(`${rel}: a literal via= marker`);
    const imp = /import\s*\{([^}]*)\}\s*from\s*['"](?:@\/lib|\.{1,2}(?:\/[\w.-]+)*)\/discover-way-back['"]/.exec(s);
    if (!imp) continue;
    if (!allow) {
      leaks.push(`${rel}: imports the arrival marker`);
      continue;
    }
    for (const name of imp[1]!.split(',').map((n) => n.trim()).filter(Boolean)) {
      if (!allow.test(name)) leaks.push(`${rel}: uses ${name}`);
    }
  }
  assert.deepEqual(leaks, [], `the Discover arrival marker travels further than Discover's card and the event page's button:\n  ${leaks.join('\n  ')}`);
});

test('no server code reads `via` — the cached Event Hub still answers, and metadata never sees it', () => {
  assert.ok(!HUB_LIVE_PARAMS.includes(DISCOVER_ARRIVAL_PARAM), 'via became a live param — every Discover visitor skips the cache');
  const page = src(EVENT_PAGE);
  const start = page.indexOf('searchParams: Promise<{');
  const end = page.indexOf('}>;', start);
  assert.ok(start > -1 && end > start, 'the page’s query type moved — point this reader at it');
  assert.doesNotMatch(page.slice(start, end), /\bvia\??:/, 'the server page reads `via` — it could reach the canonical/OG URL');
  assert.doesNotMatch(page, /search\.via\b|searchParams\.get\(['"]via['"]\)/);
});

test('the reader takes the marker out of the address at once — a copied address never carries it', () => {
  assert.match(src(READER), /window\.history\.replaceState\(window\.history\.state, '', clean\)/);
  assert.match(src(READER), /const clean = withoutDiscoverArrival\(/);
});

/* ── 4 · the doors ──────────────────────────────────────────────────────────────────────────────────────────────── */

test('Discover’s event cards carry the marker — and Discover draws its events through that card', () => {
  const card = src(CARD);
  assert.match(card, /<Link href=\{withDiscoverArrival\(card\.href\)\} className="fd-stretch">/, 'the event card’s link lost the marker');
  assert.doesNotMatch(card, /href=\{card\.href\}/, 'a bare card.href link — that door is unmarked');
  for (const rel of ['app/_components/frontdoor/front-door-discover.tsx', 'app/_components/frontdoor/front-door-results.tsx']) {
    assert.match(src(rel), /from '\.\/discover-event-card'/, `${rel} no longer draws its events through DiscoverEventCard`);
  }
});
