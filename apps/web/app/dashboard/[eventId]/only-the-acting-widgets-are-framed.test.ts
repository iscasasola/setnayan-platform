/**
 * only-the-acting-widgets-are-framed.test.ts — 🧱 FRAMES ONLY WHERE YOU ACT (owner 2026-11-01, DECISION_LOG "EVENT HOME:
 * FRAMES ONLY WHERE YOU ACT" · "HOME PROTOTYPE APPROVED"; the approved prototype
 * `prototypes/home_frames_where_you_act_2026-11-01/`, its Proposed view).
 *
 * Owner, with an iPhone Safari Start Page screenshot: *"look at how there are widgets with frame and without frame. i
 * looks clean rather than all having frames."* The approved Home: cards only for the Schedule, the Budget and Papic;
 * Countdown, the glance row (Guests · Event Hub · Suppliers · To do), Who's here, Prints and Your services sit on the page.
 *
 * THE PROPERTY, ON THE RENDERED HOME (never on a class list in code): every Home widget's root is FRAMED exactly when it
 * is one of the three acting widgets — framed = it wears a frame class (`hc-tile` · `sg-row` · `home-tile` ·
 * `home-card`) without `hc-plain`; and `hc-plain` really takes the frame off (its CSS clears the border and the fill).
 * The acting set is written HERE, from the ruling — not imported — so moving a widget in or out of the code's list is red.
 *
 *   1 · the phone: Countdown and the glance row unframed, Schedule and Budget cards, the glance row closed by a divider;
 *   2 · from md: the same widgets, the same frames;
 *   3 · Papic is a card; Who's here, Prints and Your services are not;
 *   4 · the CSS: `hc-plain` and the plain services list clear the border and the fill, in light and dark.
 *
 * SABOTAGE (seen red, 2026-11-01): add 'guests' to `HOME_FRAMED_WIDGETS` (1 + 2 red) · drop `hc-plain` from the Prints
 * line (3 red) · delete `background: transparent` from the `hc-plain` rule (4 red) · drop the `html.dark` half of the
 * `hc-plain` rule (4 red — the dark card fill wins, seen in WebKit on 2026-11-02).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl } from '@/lib/home-control-fixture';
import { drawHome, loadHome, slice } from './home-render.harness';
import type { HomeScheduleFacts } from '@/lib/home-schedule';

test.before(loadHome);

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const CSS = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));

/** The owner's ruling — the widgets you act on. */
const ACTING = new Set(['sched', 'budget', 'papic']);

const SCHEDULE: HomeScheduleFacts & { pro: boolean } = {
  chapters: 3,
  now: [],
  next: [{ chapterId: 'c1', k: 'Food tasting', v: 'Sat, Nov 7 · 2:00 PM · Hain Catering' }],
  then: [{ chapterId: 'c2', k: 'Final fitting', v: 'Sat, Nov 21 · 10:00 AM' }],
  toApprove: 2,
  needYou: 3,
  oweTimes: 6,
  pro: false,
};

/** Every opening tag that carries `marker="…"`, with its value and its class list. */
function roots(html: string, marker: string): Array<{ key: string; cls: string[] }> {
  return [...html.matchAll(new RegExp(`<[a-z]+\\b[^>]*\\b${marker}="([a-z-]*)"[^>]*>`, 'g'))].map((m) => ({
    key: m[1]!,
    cls: (/\bclass="([^"]*)"/.exec(m[0])?.[1] ?? '').split(/\s+/),
  }));
}
const FRAMES = ['hc-tile', 'sg-row', 'home-tile', 'home-card'];
const framed = (cls: string[]) => cls.some((c) => FRAMES.includes(c)) && !cls.includes('hc-plain');

function home(): string {
  return drawHome({
    control: fixtureControl('e1', { schedule: SCHEDULE }),
    prints: true,
    whosHere: React.createElement('section', { className: 'sg-row hc-plain', 'data-home-whos-here': '' }),
  });
}

test('1 · the phone: only the Schedule and the Budget are cards; the glance row is closed by a divider', () => {
  const compact = slice(home(), 'data-home-control="compact"', ['data-home-control="detail"']);
  const tiles = roots(compact, 'data-home-tile');
  // 🎴 Home redraw 2026-11-02 (round 3): the Countdown is the event card's figure and To do is the list under the card.
  assert.deepEqual(tiles.map((t) => t.key), ['sched', 'guests', 'hub', 'sup', 'budget'], 'the phone order is not the prototype’s');
  for (const t of tiles) assert.equal(framed(t.cls), ACTING.has(t.key), `phone: the ${t.key} widget is ${framed(t.cls) ? 'framed' : 'unframed'}`);
  const glance = slice(compact, 'data-home-glance=""', ['data-home-tile="budget"']);
  assert.deepEqual(roots(glance, 'data-home-tile').map((t) => t.key), ['guests', 'hub', 'sup'], 'the glance row is not Guests · Event Hub · Suppliers');
  assert.match(glance, /class="hc-rule"/, 'the glance row is not closed by a divider');
});

test('2 · from md: the same widgets wear the same frames', () => {
  const detail = slice(home(), 'data-home-control="detail"', ['data-home-services']);
  const cards = roots(detail, 'data-home-card-key');
  // Guests · Event Hub · Suppliers · Budget (the Countdown and To do left the grid, Home redraw 2026-11-02).
  assert.ok(cards.length >= 4, 'the detail cards are not drawn');
  for (const c of cards) assert.equal(framed(c.cls), ACTING.has(c.key), `md: the ${c.key} card is ${framed(c.cls) ? 'framed' : 'unframed'}`);
  const sched = roots(detail, 'data-home-tile').find((t) => t.key === 'sched');
  assert.ok(sched && framed(sched.cls), 'md: the Schedule is not a card');
});

test('3 · Papic is a card; Who’s here, Prints and Your services sit on the page', () => {
  const html = home();
  const prints = roots(html, 'data-home-prints-line')[0];
  assert.ok(prints, 'the Prints line is not drawn');
  assert.equal(framed(prints.cls), false, 'Prints is framed');
  const services = /<div class="([^"]*\bhome-svc\b[^"]*)"/.exec(slice(html, 'data-home-services', []))?.[1]?.split(/\s+/) ?? [];
  assert.ok(services.includes('hc-plain-list'), 'Your services are framed tiles');
  // Who's here's own card (the page hands it in) — its root, read from the component.
  const whos = stripComments(readFileSync(join(HERE, '_components/home-cards/home-whos-here-card.tsx'), 'utf8'));
  const whosRoot = /<section className="([^"]*)" data-home-whos-here=/.exec(whos)?.[1]?.split(/\s+/) ?? [];
  assert.ok(whosRoot.length > 0, 'Who’s here has no root to read');
  assert.equal(framed(whosRoot), false, 'Who’s here is framed');
  // Papic: its one card keeps the frame.
  const papic = stripComments(readFileSync(join(HERE, '_components/papic-home-card.tsx'), 'utf8'));
  const papicRoot = /<div className="([^"]*\bsg-row\b[^"]*)" \{\.\.\.marker\}>/.exec(papic)?.[1]?.split(/\s+/) ?? [];
  assert.equal(framed(papicRoot), ACTING.has('papic'), 'Papic is not a card');
});

test('4 · `hc-plain` really takes the frame off — the border and the fill — in light and dark', () => {
  const rule = /:is\([^)]*\)\.hc-plain(?:,\s*html\.dark :is\([^)]*\)\.hc-plain)?\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'no `.hc-plain` rule');
  assert.match(rule[1]!, /border-color:\s*transparent/, '`hc-plain` keeps the border');
  assert.match(rule[1]!, /background:\s*transparent/, '`hc-plain` keeps the fill');
  assert.match(rule[0]!, /^:is\(\.hc-tile, \.sg-row, \.home-tile, \.home-card\)\.hc-plain/, 'the plain rule names fewer frames than Home draws');
  // DARK: the dark card fill (`html.dark :is(.hc-today, .hc-tile)`, 0-2-1) outranks a bare `.hc-plain` (0-2-0) — seen in
  // WebKit, 2026-11-02: the glance row drew cards in dark. The plain rule must carry its own `html.dark` selector.
  const darkFill = /html\.dark :is\([^)]*\.hc-tile[^)]*\)\s*\{[^}]*background/.test(CSS);
  if (darkFill) assert.match(rule[0]!, /html\.dark :is\(\.hc-tile, \.sg-row, \.home-tile, \.home-card\)\.hc-plain/, 'in dark, the card fill beats `hc-plain` — unframed widgets draw as cards');
  const list = /\.home-svc\.hc-plain-list :is\([^)]*\)\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(list, 'no plain rule for Your services');
  assert.match(list[1]!, /background:\s*transparent/);
  assert.match(list[1]!, /border-color:\s*transparent/);
});
