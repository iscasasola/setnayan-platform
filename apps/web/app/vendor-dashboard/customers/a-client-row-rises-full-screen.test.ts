/**
 * a-client-row-rises-full-screen.test.ts — ⤴ A CLIENTS ROW RISES FULL SCREEN (Build 5 · Lane A slice 2).
 *
 * Owner, 10 Nov, on a Clients screenshot (a row "TEST SetnaProd walk · Asking" opening INLINE as an accordion): *"The
 * event did not grow fullscreen as planned"*. DECISION_LOG 2026-11-10 "RISE FULL SCREEN IS THE NAME; FULL SCREEN
 * EVERYTHING"; HOUSE_TEMPLATES T4; Build 5 plan Step 0 row 30.
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. EVERY Clients row (Asking · Booked · Done · All — they are all `RosterRowView`) asks the shared row to RISE, and
 *      the risen body is the event's fixed lines in order: Event type · Celebrant · Hosted by · Location · Date ·
 *      Est. pax · Service requested · For your service — then its door or the inquiry's answers.
 *   2. A rising row is the SAME head (its title, line, avatar, stage) with the arrow pointing on (›) and saying it opens a
 *      screen; shut, its body waits in the fold's inert body exactly once (the page's one read, in the HTML).
 *   3. Risen, it is the ONE shipped `RiseScreen` (the motion, the bars, ✕ / Esc / Back back into the row, the page held on
 *      its pixel are that part's, held by `the-rise-screen-is-one-full-screen.test.ts`), headed by the event's title,
 *      and the body MOVES into it — exactly once, never also under the row (one form, one id).
 *   4. From 701 the row still opens in the right column (the wide Rise is Lane R's owner pick) — the shipped beside rule.
 *
 * SABOTAGE (each run once, each went red): drop `rise` from `RosterRowView` → 1; keep `children` in the fold once risen → 3;
 * mount a second shell instead of `RiseScreen` → 3.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

test('1 · every Clients row rises, and the risen body is the event’s fixed lines in order', () => {
  const roster = code('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  const view = roster.slice(roster.indexOf('export function RosterRowView('), roster.indexOf('export function CustomersRoster('));
  const row = view.slice(view.indexOf('<SupplierOpenRow'), view.indexOf('</SupplierOpenRow>'));
  assert.ok(row.length > 0, 'anti-vacuity: RosterRowView no longer draws a SupplierOpenRow');
  assert.match(row.slice(0, row.indexOf('>\n')), /\n\s+rise\n/, 'a Clients row opens in place again — it must rise full screen');
  assert.match(row, /<EventLinesBody lines=\{lines\} \/>/, 'the risen row lost the event’s fixed lines');
  // Every list on Clients draws its rows through RosterRowView — so "any row" is every row.
  assert.equal([...roster.matchAll(/<SupplierOpenRow\b/g)].length, 1, 'a second, non-rising Clients row');
  assert.match(roster, /<RosterRowView r=\{r\}/);

  const lines = code('app/vendor-dashboard/_components/event-lines.tsx');
  const order = ["k: 'Event type'", "k: 'Celebrant'", 'title="Hosted by"', "k: 'Location'", "k: 'Date'", 'Service requested', 'For your service'];
  let at = -1;
  for (const k of order) {
    const i = lines.indexOf(k, at + 1);
    assert.ok(i > at, `the fixed lines are out of order or missing at ${k}`);
    at = i;
  }
});

test('2 · a rising row is the same head, its arrow on (›); shut, its body waits once in the inert fold', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierOpenRow } = await import('@/app/vendor-dashboard/_components/supplier-open-row');
  const html = renderToStaticMarkup(
    React.createElement(
      SupplierOpenRow,
      { id: 'customer-e1', data: 'customer-row', title: 'Indalecio & Claire · Wedding · Dec 18', line: 'Asking · Photo & video', rise: true, children: React.createElement('p', { 'data-probe': '' }, 'THE BODY') },
    ),
  );
  assert.match(html, /data-open-rises=""/, 'the row does not say it rises');
  assert.match(html, /data-fold-head=""[^>]*data-fold-rises=""/, 'the head is not the rising head');
  assert.match(html, /aria-haspopup="dialog"/, 'the head does not say it opens a screen');
  assert.doesNotMatch(html.slice(html.indexOf('data-fold-head'), html.indexOf('</button>')), /aria-expanded/, 'a rising head still says it expands');
  assert.match(text(html), /Indalecio & Claire · Wedding · Dec 18 Asking · Photo & video/, 'the head lost its title or its line');
  // Shut, the body waits in the fold's shut body — inert and hidden, as every row's does — exactly once.
  assert.equal([...html.matchAll(/THE BODY/g)].length, 1, 'the shut row does not hold its body exactly once');
  assert.match(html, /data-fold-body=""[^>]*inert=""[\s\S]*THE BODY/, 'the shut row’s body is not in its inert fold body');
  assert.doesNotMatch(html, /data-rise-screen/, 'the screen is up before anybody pressed the row');

  // The shipped fold, unchanged for every other row: no `rises` → ▾ and aria-expanded, exactly as before.
  const { Fold } = await import('@/app/_components/fold');
  const plain = renderToStaticMarkup(React.createElement(Fold, { title: 'Bookings', children: 'x' }));
  assert.match(plain, /aria-expanded="false"/);
  assert.doesNotMatch(plain, /data-fold-rises|aria-haspopup/, 'every fold now rises');
});

test('3 · risen, it is the ONE RiseScreen, headed by the event, holding the body exactly once', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierOpenRow } = await import('@/app/vendor-dashboard/_components/supplier-open-row');
  // A row a link names is up from the first paint — the screen simply appears (no tap behind it).
  const html = renderToStaticMarkup(
    React.createElement(
      SupplierOpenRow,
      { id: 'customer-e1', data: 'customer-row', title: 'Indalecio & Claire · Wedding · Dec 18', line: 'Asking · Photo & video', rise: true, defaultOpen: true, children: React.createElement('p', { 'data-probe': '' }, 'THE BODY') },
    ),
  );
  assert.match(html, /data-rise-screen="customer-row"/, 'the risen row is not the shared RiseScreen');
  const screen = html.slice(html.indexOf('data-rise-screen'));
  assert.match(text(screen.slice(0, screen.indexOf('data-rise-body'))), /Indalecio & Claire · Wedding · Dec 18/, 'the risen screen is not headed by the event');
  assert.equal([...html.matchAll(/THE BODY/g)].length, 1, 'the body is not drawn exactly once');
  assert.ok(html.indexOf('THE BODY') > html.indexOf('data-rise-body'), 'the body is not inside the risen screen');

  const row = code('app/vendor-dashboard/_components/supplier-open-row.tsx');
  assert.match(row, /import \{ RiseScreen \} from '@\/app\/_components\/rise\/rise-screen';/, 'the row does not rise through the ONE screen');
  assert.match(row, /<RiseScreen title=\{paneTitle \?\? title\} line=\{line\} onClose=\{\(\) => setRisen\(false\)\}/, 'the risen screen is not the row’s own title, or ✕ does not put it back');
});

test('4 · from 701 the row still opens beside the list — the shipped right column, never risen AND beside', () => {
  const row = code('app/vendor-dashboard/_components/supplier-open-row.tsx');
  assert.match(row, /if \(rise && !scope\?\.wide\) \{/, 'a rising row also rises from 701 (the wide Rise is the owner’s pick, Lane R)');
  assert.match(row, /if \(!rise \|\| !wideNow \|\| !risen\) return;\s*setRisen\(false\);\s*scope\?\.open\(id\);/, 'a risen row that grows past 701 stays risen');
});
