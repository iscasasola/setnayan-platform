/**
 * create-follows-the-surface.test.ts — the button makes what THIS place makes.
 *
 * 🔴 THE BUG, IN THE OWNER'S WORDS (2026-08-26): *"this needs to change
 * depending on where they are. Home - Create Event. Shop - Create Service Card.
 * HQ - Create what?"* One hardcoded `+ Create event` rendered on all six
 * signed-in trees, so **a supplier standing in their own Shop was one press from
 * a couple's wedding wizard.** That is a wrong button, not a matter of taste.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('a surface that says nothing still gets "+ Create event"', () => {
  // The five other trees pass no slot. If this default goes, the couple's own
  // create button disappears from every one of them at once.
  const shell = read('app/_components/frontdoor/front-door-shell.tsx');
  assert.match(
    shell,
    /createSlot === undefined \? \(\s*<Link href="\/dashboard\/create-event" className="fd-btn-gold">\s*\+ Create event/,
    'the default create button changed or vanished',
  );
  // `undefined`, not a falsy check: `null` has to mean something different from
  // "you said nothing", or HQ cannot turn the button off.
  assert.ok(
    !/createSlot \?\? \(/.test(shell),
    'a ?? fallback would make null fall back to the event button — HQ needs null to mean none',
  );
});

test('the Shop makes a service card, and the press opens the maker', () => {
  const vendor = read('app/vendor-dashboard/layout.tsx');
  assert.match(vendor, /createSlot=\{/, 'the Shop lost its own create button');
  assert.match(vendor, /\+ Create service card/, 'the Shop button stopped naming what it makes');
  // ⚠ THIS ASSERTION HAS PINNED A BROKEN DESTINATION ONCE ALREADY, AND PASSED
  // THROUGHOUT. It read `href="/vendor-dashboard/services#add-service-picker"`
  // and, three lines down, checked that an element with that id EXISTED. Both
  // were true and the button still did nothing. **Existing is not the same as
  // reachable**, so what is asserted here is the DESTINATION KIND: the press
  // must open the maker itself, not a page of links to it (owner 2026-08-28).
  assert.match(
    vendor,
    /href=\{SERVICE_MAKER_HREF\}/,
    'the Shop button stopped using the one shared maker href',
  );
  assert.ok(
    !/href="\/vendor-dashboard\/services#/.test(vendor),
    'the Shop button went back to the retired address, whose redirect eats the fragment',
  );
  // The maker route has to be a real page, or the button opens a 404 — the
  // reachability half, kept here because this file owns the button.
  const maker = read('app/vendor-dashboard/services/new/page.tsx');
  assert.match(maker, /<CanvasMaker/, 'the create route stopped rendering the maker');
  assert.ok(maker.length > 500, 'the maker route read back empty — this check is pointed at nothing');
  // And it must not still offer a wedding.
  assert.ok(
    !/\/dashboard\/create-event/.test(vendor),
    'the Shop still links a supplier at the couple wizard',
  );
});

test('HQ makes nothing — and null is how it says so', () => {
  const admin = read('app/admin/layout.tsx');
  assert.match(admin, /createSlot=\{null\}/, 'HQ grew a create button again');
});

test('the locked gold treatment is reused, never re-styled per surface', () => {
  // Owner-locked 2026-08-14: one chrome, one button colour. A surface may change
  // the words and the destination; it may not invent its own button.
  const vendor = read('app/vendor-dashboard/layout.tsx');
  assert.match(vendor, /className="fd-btn-gold"/, 'the Shop button stopped using the locked treatment');
});

test('the slot is threaded, not swallowed by the rail', () => {
  // Both admin and vendor mount AppRailShell, which wraps FrontDoorShell. If the
  // rail forgets to pass it on, both surfaces silently fall back to the default
  // and every assertion above still passes on its own file.
  const rail = read('app/_components/frontdoor/app-rail-shell.tsx');
  assert.match(rail, /createSlot=\{createSlot\}/, 'the rail stopped passing the slot through');
  assert.match(rail, /createSlot\?: React\.ReactNode;/, 'the rail stopped accepting the slot');
});

test('exactly two surfaces override it — everyone else is untouched', () => {
  // A floor and a ceiling: if this grows silently, the "one chrome" lock is
  // being eroded one layout at a time.
  const layouts = [
    'app/(shell)/layout.tsx',
    'app/dashboard/(account)/layout.tsx',
    'app/dashboard/(launcher)/layout.tsx',
    'app/dashboard/[eventId]/layout.tsx',
  ];
  for (const l of layouts) {
    assert.ok(!/createSlot/.test(read(l)), `${l} started overriding the create button`);
  }
});
