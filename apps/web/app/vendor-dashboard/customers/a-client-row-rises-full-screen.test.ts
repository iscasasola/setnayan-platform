/**
 * a-client-row-rises-full-screen.test.ts — ⤴ A CLIENTS ROW RISES FULL SCREEN — INTO THE PICKED CLIENT (Build 5 · Lane A
 * slice 2, re-aimed 11 Nov).
 *
 * Owner, 10 Nov, on a Clients screenshot (a row "TEST SetnaProd walk · Asking" opening INLINE as an accordion): *"The
 * event did not grow fullscreen as planned"*. DECISION_LOG 2026-11-10 "RISE FULL SCREEN IS THE NAME; FULL SCREEN
 * EVERYTHING"; HOUSE_TEMPLATES T4; Build 5 plan Step 0 row 30.
 *
 * 🎯 RE-AIMED 11 NOV — the rise stays, its TARGET changed. Slice 2 rose the row's OWN body (the event's lines and, for an
 * ask, Decline · Ask · Accept) in a `RiseScreen`: a separate card with no page menu and no chat. Owner, 11 Nov, live as
 * SetnaProd on that very row: *"Why do i see it this way? The chatbox is not yet done?"* · *"Accepted it and still did not
 * show the chatbox"* · *"When that is pressed it jump to the supplie-client card that was already planned with the
 * details-chat-form-quote-files-report and more menus that would grow to full screen"* (DECISION_LOG 2026-11-11, every
 * Clients row opens the picked supplier-client card; 2026-11-08 "a row opens the picked client on its Chat tab"). The
 * v118 #38 landing (`clientLandingPage` / `openClientHref`) had shipped; the row's own press had not used it.
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. EVERY Clients row (Asking · Booked · Done · All — they are all `RosterRowView`) RISES INTO THE PICKED CLIENT on a
 *      phone: `rise` + `opensTo={href}` (`hrefFor`, the one open path), and the door is decided BEFORE the row's own rise,
 *      so a Clients row never reaches a `RiseScreen` of its own. The picked client rises from the row
 *      (`rememberPickedOrigin`) — the same motion, the ONE shell with its page menu.
 *   2. A rising row is the SAME head (its title, line, avatar, stage) with the arrow pointing on (›) and saying it opens a
 *      screen; shut, its body waits in the fold's inert body exactly once (the page's one read, in the HTML).
 *   3. The shared row's own rise (a row with no `opensTo`) is still the ONE shipped `RiseScreen`, headed by its title,
 *      the body MOVED into it — exactly once (for the other rows that rise their own body).
 *   4. From 701 the row still opens in the right column (the wide Rise is Lane R's owner pick) — the shipped beside rule;
 *      the event's fixed lines are what that column draws, in order.
 *
 * SABOTAGE (each run once, each went red): drop `rise` from `RosterRowView` → 1; drop `opensTo={href}` → 1; move the door
 * below the rise branch → 1; keep `children` in the fold once risen → 3; mount a second shell instead of `RiseScreen` → 3.
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
// The rows are rendered with their body as createElement's third argument (react/no-children-prop); widened here so TS does
// not insist on a `children` prop the third argument already supplies.
type AnyRow = React.ComponentType<Record<string, unknown>>;

test('1 · every Clients row rises INTO the picked client — the door comes before the row’s own rise', () => {
  const roster = code('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  const view = roster.slice(roster.indexOf('export function RosterRowView('), roster.indexOf('export function CustomersRoster('));
  const row = view.slice(view.indexOf('<SupplierOpenRow'), view.indexOf('</SupplierOpenRow>'));
  assert.ok(row.length > 0, 'anti-vacuity: RosterRowView no longer draws a SupplierOpenRow');
  const tag = row.slice(0, row.indexOf('lead={avatar}'));
  assert.match(tag, /\n\s+rise\n/, 'a Clients row opens in place again — it must rise full screen');
  assert.match(tag, /opensTo=\{href\}/, 'a Clients row rises its own card again — it must rise into the picked client');
  assert.match(view, /const href = hrefFor\(r, today\);/, 'the row’s target is not the one open path');
  // Every list on Clients draws its rows through RosterRowView — so "any row" is every row.
  assert.equal([...roster.matchAll(/<SupplierOpenRow\b/g)].length, 1, 'a second, non-rising Clients row');
  assert.match(roster, /<RosterRowView r=\{r\}/);

  // The door is decided before the row's own rise: a Clients row never reaches its own RiseScreen on a phone.
  const shared = code('app/vendor-dashboard/_components/supplier-open-row.tsx');
  const door = shared.indexOf('if (opensTo && !scope?.wide) {');
  const ownRise = shared.indexOf('if (rise && !scope?.wide) {');
  assert.ok(door > 0 && ownRise > 0 && door < ownRise, 'the row’s own rise is decided before its door into the picked client');
  assert.match(shared, /rememberPickedOrigin\(/, 'the picked client no longer rises from the tapped row');
});

test('2 · a rising row is the same head, its arrow on (›); shut, its body waits once in the inert fold', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierOpenRow } = await import('@/app/vendor-dashboard/_components/supplier-open-row');
  const html = renderToStaticMarkup(
    React.createElement(
      SupplierOpenRow as AnyRow,
      { id: 'customer-e1', data: 'customer-row', title: 'Indalecio & Claire · Wedding · Dec 18', line: 'Asking · Photo & video', rise: true },
      React.createElement('p', { 'data-probe': '' }, 'THE BODY'),
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
  const plain = renderToStaticMarkup(React.createElement(Fold as AnyRow, { title: 'Bookings' }, 'x'));
  assert.match(plain, /aria-expanded="false"/);
  assert.doesNotMatch(plain, /data-fold-rises|aria-haspopup/, 'every fold now rises');
});

test('3 · risen, it is the ONE RiseScreen, headed by the event, holding the body exactly once', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierOpenRow } = await import('@/app/vendor-dashboard/_components/supplier-open-row');
  // A row a link names is up from the first paint — the screen simply appears (no tap behind it).
  const html = renderToStaticMarkup(
    React.createElement(
      SupplierOpenRow as AnyRow,
      { id: 'customer-e1', data: 'customer-row', title: 'Indalecio & Claire · Wedding · Dec 18', line: 'Asking · Photo & video', rise: true, defaultOpen: true },
      React.createElement('p', { 'data-probe': '' }, 'THE BODY'),
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
  const roster = code('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  assert.match(roster, /<SupplierOpenRow\b[\s\S]*?<EventLinesBody lines=\{lines\} \/>/, 'the right column lost the event’s fixed lines');
  const lines = code('app/vendor-dashboard/_components/event-lines.tsx');
  const order = ["k: 'Event type'", "k: 'Celebrant'", 'title="Hosted by"', "k: 'Location'", "k: 'Date'", 'Service requested', 'For your service'];
  let at = -1;
  for (const k of order) {
    const i = lines.indexOf(k, at + 1);
    assert.ok(i > at, `the fixed lines are out of order or missing at ${k}`);
    at = i;
  }
  const row = code('app/vendor-dashboard/_components/supplier-open-row.tsx');
  assert.match(row, /if \(rise && !scope\?\.wide\) \{/, 'a rising row also rises from 701 (the wide Rise is the owner’s pick, Lane R)');
  assert.match(row, /if \(!rise \|\| !wideNow \|\| !risen\) return;\s*setRisen\(false\);\s*scope\?\.open\(id\);/, 'a risen row that grows past 701 stays risen');
});
