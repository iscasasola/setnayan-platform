/**
 * the-event-wears-one-pinned-row.test.ts — 🔒 EVERY COUPLE EVENT PAGE WEARS THE APP'S ONE PINNED ROW, MOUNTED ONCE.
 *
 * Design template, owner-approved 14 Nov 2026, rule 1: every page wears the ONE shared pinned row at the top —
 * `Page · View ▾` — and the page's name lives in its picker. The admin mounts `<AdminPinnedRow>` once in its layout; the
 * couple event layout now mounts `<EventPinnedRow>` once, in the same way — never page by page.
 *
 * Held:
 *   1 · the event layout mounts the row EXACTLY ONCE, inside the content column, above the page;
 *   2 · the row is the shared `PinnedRow` (never a copy), and "where am I" comes from the event menu's own tree and the
 *       rail's own resolver — no second list of the couple's pages;
 *   3 · the event HOME is the exception (its cover band) and draws no row; nor do the pages that keep their own first
 *       row (Guests · Suppliers · Schedule · Memories · Hub · Details · Seat plan…) — so no page wears two;
 *   4 · on the pages it does draw, the face is `Page · View` from the tree (Today · Budget, Guests · Your access, a
 *       product's catalogue name), and a page the tree does not hold draws nothing;
 *   5 · every FIXED page the tree claims has a word, and no word names a path the tree never claims.
 *
 * Sabotage (2026-11-14, each run and reverted, each RED): the layout's `<EventPinnedRow` line deleted (1) · a second
 * mount added (1) · `''` dropped from `EVENT_OWN_ROW.exact` → the Home drew the row (3) · `budget` dropped from the words
 * (4, 5) · `<PinnedRow` swapped for a hand-drawn `<div data-pinned-row>` (2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { buildEventMenuSections, eventMenuRows, STUDIO_ABSORBED } from '@/lib/customer-menu';
import {
  EVENT_FAMILY_CLAIMS,
  EVENT_HELD_PAGE_WORDS,
  eventPinFace,
  eventPinPlaceOf,
  eventPinTable,
} from './_components/event-pin-places';

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]');
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const E = 'e1';
const B = `/dashboard/${E}`;
const STUDIO = [
  { key: 'papic', href: `${B}/studio/papic?from=menu`, name: 'Papic' },
  { key: 'pa3d', href: `${B}/plan3d`, name: '3D Plan' },
  { key: 'mood-board', href: `${B}/studio/mood-board`, name: 'Mood Board' },
];
const table = eventPinTable({ eventId: E, websiteEnabled: true, seatingEnabled: true, studioRows: STUDIO, phase: 'plan' });
const face = (path: string) => {
  const p = eventPinPlaceOf(table, path);
  return p ? eventPinFace(p) : null;
};

test('the event layout mounts the ONE pinned row exactly once, above the page', () => {
  const layout = read('layout.tsx');
  assert.equal(count(layout, /<EventPinnedRow\b/g), 1, 'the event layout does not mount the pinned row exactly once');
  assert.match(layout, /<EventPinnedRow table=\{eventPinTable\(eventRailInputs\)\} \/>/, 'the row is not built from the rail’s own inputs');
  const row = layout.indexOf('<EventPinnedRow');
  assert.ok(row > layout.indexOf('<main') && row < layout.indexOf('{children}'), 'the row is not inside the content column, above the page');
  const src = read('_components', 'event-pinned-row.tsx');
  assert.match(src, /<PinnedRow\b/, 'the event row draws its own row instead of the shared PinnedRow');
  assert.doesNotMatch(src, /data-pinned-row|data-first-row/, 'the event row re-draws a piece of the shared row');
  assert.doesNotMatch(src, /MenuSettingsButton/, 'a second ⚙ — each couple menu’s ⚙ is mounted once, on its own page');
});

test('the Home and the pages with their own first row draw no layout row', () => {
  for (const own of ['', '/guests', '/vendors', '/schedule', '/memories', '/launch', '/details', '/seating', '/website/editor', '/seating/lab', '/studio/mood-board']) {
    assert.equal(face(`${B}${own}`), null, `${own || '(home)'} wears two rows`);
  }
});

test('the face is Page · View from the event menu tree', () => {
  assert.equal(face(`${B}/budget`), 'Today · Budget');
  assert.equal(face(`${B}/hosts`), 'Guests · Your access');
  assert.equal(face(`${B}/guests/checkin`), 'Guests');
  assert.equal(face(`${B}/studio/papic/crew`), 'Today · Papic', 'a product page is named by its catalogue row');
  assert.equal(face(`${B}/vendors/v1/workspace`), 'Suppliers');
  assert.equal(face(`${B}/story`), 'Hub · Story Maker');
  assert.equal(face(`${B}/galleries`), 'Memories · More from your day');
  assert.equal(face(`${B}/orders`), null, 'a page the menu does not hold is given a guessed name');
  const today = table.pillars.find((p) => p.key === 'home')!;
  assert.equal(today.views[0]!.exact, true, 'Today’s door matches every event page by prefix');
  assert.ok(!today.views.some((v) => v.path === `${B}/studio`), 'a family claim with no page is offered as a view');
});

test('every fixed page the tree claims has a word, and no word names an unclaimed path', () => {
  const claimed = new Set<string>();
  for (const ctx of [{ websiteEnabled: true }, { websiteEnabled: false }, { seatingEnabled: false }]) {
    for (const r of eventMenuRows(buildEventMenuSections(E, ctx))) for (const m of r.alsoMatch ?? []) claimed.add(m.slice(B.length + 1));
  }
  const absorbed = new Set(Object.values(STUDIO_ABSORBED).flatMap((a) => a.routes(B).map((r) => r.slice(B.length + 1))));
  for (const c of claimed) {
    if (EVENT_FAMILY_CLAIMS.includes(c) || absorbed.has(c)) continue;
    assert.ok(EVENT_HELD_PAGE_WORDS[c], `the menu holds /${c} but the pinned row has no word for it`);
  }
  for (const w of Object.keys(EVENT_HELD_PAGE_WORDS)) assert.ok(claimed.has(w), `"${w}" names a page the menu does not hold`);
});
