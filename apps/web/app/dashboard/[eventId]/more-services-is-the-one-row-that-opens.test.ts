/**
 * 📂 MORE SERVICES IS THE ONE ROW THAT OPENS (owner 2026-09-30, DECISION_LOG
 * "THE SIDEBAR ROW 'MORE SERVICES' EXPANDS TO THE FIVE"):
 *   *"so it will be Setnayan AI, Papic, Live Studio, Music Maker, then Patiktok"*
 *   · *"the sidebar will expand and collapse to show these"* · *"1. ok 2. expand
 *   only 3. yes 4. no. no more subrows"*; then, for the phone: tapping "More"
 *   opens a small chooser sheet with the same five — never a sub-row.
 *
 * It reverses the 2026-07-15 "solid menu with no submenus" lock for THIS ONE
 * ROW. So this pins, each in the place it would silently break:
 *   1. exactly one row in the tree has children, and it is `studio`;
 *   2. those children ARE `buildOurServices`' cards, in its order;
 *   3. the layout builds them with that builder (not a second list);
 *   4. the rail opens only that row, with a button (no navigation) that says
 *      whether it is open; closed by default (2026-10-01), not remembered;
 *   5. the phone bar has no sub-rows — its "More" tab opens the chooser, which
 *      is loaded lazily (the shared bundle has no room).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import {
  buildCustomerMenuTree,
  buildEventMenuSections,
  eventMenuRows,
  type EventMenuChild,
} from '@/lib/customer-menu';
import { buildOurServices, ourServicesMenuChildren, type OurServicesInput } from '@/lib/our-services';
import { studioHubHref } from '@/lib/studio-hub';
import { stripComments } from '@/lib/strip-comments';
import { buildCustomerNavGroups } from './_components/customer-nav-config';

const HERE = import.meta.dirname;
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));
const EVENT = 'S89E-MORESVC001';

function input(over: Partial<OurServicesInput> = {}): OurServicesInput {
  return {
    eventId: EVENT,
    catalogue: ADD_ONS,
    owned: { active: new Set(), pending: new Set() },
    prices: new Map(),
    offered: () => true,
    sellableNow: () => true,
    aiSellable: true,
    papicOwnedBy: ['PAPIC_UNLOCK', 'PAPIC_SEATS', 'PAPIC_GUEST'],
    refusesPath: () => false,
    ...over,
  };
}

const services = (i = input()): EventMenuChild[] =>
  ourServicesMenuChildren(buildOurServices(i), studioHubHref(EVENT));

test('1 · exactly one row opens, and it is More Services (`studio`)', () => {
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const rows = eventMenuRows(
      buildEventMenuSections(EVENT, { phase, websiteEnabled: true, services: services() }),
    );
    const parents = rows.filter((r) => r.children?.length);
    assert.deepEqual(parents.map((r) => r.key), ['studio'], `${phase}: the rows that open`);
    // The rail's projection carries the same, and no other item grows children.
    const items = buildCustomerNavGroups(EVENT, { phase, websiteEnabled: true, services: services() })
      .flatMap((g) => g.items);
    assert.deepEqual(items.filter((i) => i.children?.length).map((i) => i.key), ['studio']);
  }
  // No services handed in → no children at all (a plain leaf, as before).
  const bare = eventMenuRows(buildEventMenuSections(EVENT, { websiteEnabled: true }));
  assert.ok(!bare.some((r) => r.children), 'a row has children nobody handed in');
});

test('2 · its children are buildOurServices’ cards, in that order, under those names', () => {
  for (const i of [
    input(),
    input({ aiSellable: false }), // Setnayan AI not sellable → not listed
    input({ offered: (e) => e.key !== 'papic' }), // no Papic → the Gallery in its place
  ]) {
    const cards = buildOurServices(i);
    const kids = eventMenuRows(
      buildEventMenuSections(EVENT, { websiteEnabled: true, services: services(i) }),
    ).find((r) => r.key === 'studio')!.children!;
    assert.deepEqual(kids.map((k) => k.key), cards.map((c) => c.key));
    assert.deepEqual(kids.map((k) => k.label), cards.map((c) => c.name));
    for (const [n, c] of cards.entries()) {
      assert.equal(kids[n]!.href, c.href ?? studioHubHref(EVENT), `${c.key} opens somewhere else`);
    }
  }
  // The owner's five, by name, on an event offered everything.
  assert.deepEqual(
    services().map((s) => s.label),
    ['Setnayan AI (SAI)', 'Papic', 'Live Studio', 'Music Maker', 'Patiktok'],
  );
  // A card with no door (its day has passed) opens the More Services page.
  const closed = services(input({ sellableNow: () => false }));
  assert.ok(closed.every((s) => s.href), 'a child with no href');
});

test('3 · the layout builds the five with buildOurServices and hands them to both menus', () => {
  const src = read('layout.tsx');
  assert.match(src, /ourServicesMenuChildren\(\s*buildOurServices\(/, 'the layout lists the five some other way');
  assert.match(src, /eventRailInputs: EventRailInputs = \{[^}]*\bservices,/, 'the rail is not handed the five');
  assert.match(src, /<CustomerBottomNav[^>]*services=\{services\}/, 'the phone bar is not handed the five');
});

test('4 · the rail opens ONLY More Services — a button that expands, closed by default', () => {
  const src = read('_components/event-rail-context.tsx');
  assert.match(src, /item\.key === 'studio' && item\.children\?\.length/, 'the open branch is not keyed to `studio`');
  // Exactly one place renders children.
  assert.equal((src.match(/\.children\.map\(/g) ?? []).length, 1, 'children are rendered in more than one place');
  // Expand only — a <button>, never a link to the page; it says whether it is open.
  const branch = src.slice(src.indexOf("item.key === 'studio'"), src.indexOf('<ul id='));
  assert.match(branch, /<button\s+type="button"/);
  assert.ok(!/<Link/.test(branch), 'tapping More Services navigates again');
  assert.match(branch, /aria-expanded=\{open\}/);
  assert.match(branch, /aria-controls="fd-more-services"/);
  assert.match(src, /<ul id="fd-more-services" className="fd-msub" hidden=\{!open\}/);
  // CLOSED by default and NOT remembered (owner 2026-10-01): a remembered
  // "open" would bring the five back as eleven rows on the next visit. It
  // opens on a tap, or when the lit row is More Services (`studio`).
  assert.match(src, /useMoreOpen\(activeKey === 'studio'\)/);
  assert.ok(!/localStorage/.test(src), 'More Services is remembered open again');
});

test('5 · the phone bar has no sub-rows — its "More" tab opens the chooser sheet', () => {
  const tree = buildCustomerMenuTree(EVENT, { websiteEnabled: true, services: services() });
  for (const tab of tree) assert.ok(!('children' in tab), `the ${tab.key} tab grew sub-rows`);
  const nav = read('_components/customer-bottom-nav.tsx');
  assert.match(nav, /<BottomNav items=\{items\}/, 'the bar left the flat path');
  assert.ok(!/<BottomNav[^>]*menus=/.test(nav), 'the bar is an accordion again');
  assert.match(nav, /m\.key === 'studio' && services\?\.length/, 'More does not open the chooser');
  assert.match(nav, /onSelect:/);
  // Lazy: the sheet (and the shared Sheet it uses) never ride the first load —
  // a plain `import()` on the first tap. NOT `next/dynamic`, whose loadable
  // runtime cost the Maker 0.5 KB over its ceiling (measured 2026-10-01).
  assert.match(nav, /import\('\.\/more-services-sheet'\)\.then/);
  assert.ok(!/from '\.\/more-services-sheet'/.test(nav), 'the chooser is imported eagerly');
  assert.ok(!/from 'next\/dynamic'/.test(nav), 'next/dynamic is back in the event layout chunk');
  // The sheet draws exactly what it is handed.
  const sheet = read('_components/more-services-sheet.tsx');
  assert.match(sheet, /services\.map\(/);
  assert.match(sheet, /<Sheet /);
  // Portalled to <body>: inside <BottomDock> a fixed sheet is clipped to the
  // bar (measured 2026-09-30 — only the scrim's blur showed).
  assert.match(sheet, /createPortal\(/);
  assert.match(sheet, /document\.body,?\s*\)/);
});
