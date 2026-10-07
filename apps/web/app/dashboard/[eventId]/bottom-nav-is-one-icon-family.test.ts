/**
 * bottom-nav-is-one-icon-family.test.ts — THE FIVE TABS WEAR ONE LINE FAMILY.
 *
 * Owner, verbatim (2026-10-07): *"make the logo of guests, supplier and event
 * hub consistent"* · *"fix the bottom nav and add it to the build. to fix the
 * icons on the bottom nav as well"* — then, from a picker: *"Smart Home ·
 * Address Book · Store · Page · Grid"* (Hub = the browser window). DECISION_LOG
 * "THE BOTTOM NAV'S FIVE ICONS — THE OWNER'S PICK"; plan PR 4g.
 *
 * MEASURED LIVE BEFORE THIS (setnayan.com, 2026-10-07): Home drew the FILLED
 * Setnayan mark among four line icons, and Suppliers a compass. Both came from
 * the nav registry's code defaults (`customer.bottom-nav.home` was
 * `customRef: "SetnayanMark"`), which `getNavSlotMap()` serves for EVERY slot —
 * so the tree's own icon never reached the bar. A test of the tree alone was
 * green the whole time; this one renders the bar the way the layout feeds it.
 *
 * WHAT THIS HOLDS:
 *   1 · The tree's five tabs are HouseWifi · BookUser · Store · AppWindow · Grip.
 *   2 · The registry defaults for the five (bar AND rail) name those same five.
 *   3 · The RENDERED bar — fed the registry defaults, as production is — draws
 *       those five lucide line icons at one stroke, and no mark, no image.
 *   4 · An override may relabel a tab and pick ANOTHER lucide icon; an emoji, an
 *       uploaded image, the Setnayan mark or `none` falls back to the family.
 *   5 · The desktop rail's five rows draw the same five icons.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HouseWifi, BookUser, Store, AppWindow, Grip, Heart, type LucideIcon } from 'lucide-react';

import { buildCustomerMenuTree, EVENT_MENU_ICONS, type CustomerMenuKey } from '@/lib/customer-menu';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';
import { getLucideIcon } from '@/lib/nav-icons';
import { navLineIcon } from '@/lib/nav-line-icon';
import type { NavIconDescriptor, NavSlotLite } from '@/lib/nav-registry-types';
import { CustomerBottomNav } from './_components/customer-bottom-nav';
import { buildCustomerNavGroups } from './_components/customer-nav-config';
import { applyRegistry } from './_components/customer-sidebar';

/* tsconfig's `"jsx": "preserve"` → classic runtime; set React before render
   (precedent: `the-phone-bar-is-anchored.test.ts`). */
(globalThis as unknown as { React: unknown }).React = React;

const EVENT_ID = 'S89E-ONEFAMILY1';

/** THE OWNER'S PICK, in tab order. */
const FAMILY: ReadonlyArray<[CustomerMenuKey, LucideIcon, string]> = [
  ['home', HouseWifi, 'lucide-house-wifi'],
  ['guests', BookUser, 'lucide-book-user'],
  ['explore', Store, 'lucide-store'],
  ['launch', AppWindow, 'lucide-app-window'],
  ['studio', Grip, 'lucide-grip'],
];

/** The slot map production serves when nobody has overridden anything —
 *  `getNavSlotMap()`'s default branch, rebuilt from the same defaults. */
function defaultSlots(): Record<string, NavSlotLite> {
  const out: Record<string, NavSlotLite> = {};
  for (const d of NAV_SLOT_DEFAULTS) {
    out[d.key] = {
      label: d.label,
      icon: { kind: d.iconKind, lucideName: d.lucideName, customRef: d.customRef, customUrl: null },
      isHidden: false,
    };
  }
  return out;
}

const renderBar = (navSlots?: Record<string, NavSlotLite>) =>
  renderToStaticMarkup(
    createElement(CustomerBottomNav, { eventId: EVENT_ID, websiteEnabled: true, navSlots }),
  );

/** Every lucide glyph class the bar drew, in order. */
const glyphs = (html: string) => [...html.matchAll(/class="lucide (lucide-[a-z0-9-]+)/g)].map((m) => m[1]!);

test('1 · the tree gives the five tabs the owner’s five line icons', () => {
  const tree = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true });
  assert.deepEqual(
    tree.map((t) => t.key),
    FAMILY.map(([k]) => k),
  );
  for (const [key, icon] of FAMILY) {
    assert.equal(tree.find((t) => t.key === key)?.icon, icon, `the ${key} tab is not ${icon.displayName}`);
  }
});

test('2 · the registry defaults for the five — bar AND rail — name the same five', () => {
  for (const area of ['bottom-nav', 'sidebar'] as const) {
    for (const [key, icon] of FAMILY) {
      const d = NAV_SLOT_DEFAULTS.find((s) => s.key === `customer.${area}.${key}`);
      assert.ok(d, `customer.${area}.${key} has no default slot`);
      assert.equal(d.iconKind, 'lucide', `customer.${area}.${key} is a ${d.iconKind} icon, not a line icon`);
      assert.equal(d.customRef, null, `customer.${area}.${key} still carries ${d.customRef}`);
      assert.equal(
        getLucideIcon(d.lucideName),
        icon,
        `customer.${area}.${key} names "${d.lucideName}" — the owner picked ${icon.displayName}`,
      );
    }
  }
});

test('3 · the RENDERED bar, fed the registry as production is, draws the five at one stroke', () => {
  for (const slots of [defaultSlots(), undefined]) {
    const html = renderBar(slots);
    assert.deepEqual(
      glyphs(html),
      FAMILY.map(([, , cls]) => cls),
      `the bar drew ${glyphs(html).join(' · ')}`,
    );
    assert.doesNotMatch(html, /viewBox="0 0 5333/, 'the filled Setnayan mark is back on the bar');
    assert.doesNotMatch(html, /<img\b/, 'the bar drew an image icon');
    const strokes = new Set([...html.matchAll(/<svg[^>]*stroke-width="([^"]+)"/g)].map((m) => m[1]));
    assert.equal(strokes.size, 1, `the five icons are drawn at ${[...strokes].join(' and ')} strokes`);
  }
});

const MARK: NavIconDescriptor = { kind: 'custom', lucideName: null, customRef: 'SetnayanMark', customUrl: null };
const IMAGE: NavIconDescriptor = { kind: 'custom', lucideName: null, customRef: null, customUrl: 'https://x.test/a.png' };
const EMOJI: NavIconDescriptor = { kind: 'lucide', lucideName: '🏠', customRef: null, customUrl: null };
const NONE: NavIconDescriptor = { kind: 'none', lucideName: null, customRef: null, customUrl: null };

test('4 · an override may relabel and re-pick a line icon — never a mark, an image or an emoji', () => {
  for (const bad of [MARK, IMAGE, EMOJI, NONE]) {
    assert.equal(navLineIcon(bad, Store), Store, `a ${bad.kind} override replaced the line icon`);
  }
  assert.equal(navLineIcon({ ...NONE, kind: 'lucide', lucideName: 'Heart' }, Store), Heart);

  // Through the rendered bar: every slot carries a bad icon and a new word.
  const bads = [MARK, IMAGE, EMOJI, NONE, EMOJI];
  const slots = defaultSlots();
  FAMILY.forEach(([key], i) => {
    slots[`customer.bottom-nav.${key}`] = { label: `Word${i}`, icon: bads[i]!, isHidden: false };
  });
  const html = renderBar(slots);
  assert.deepEqual(glyphs(html), FAMILY.map(([, , cls]) => cls), 'an override pushed a tab out of the family');
  assert.doesNotMatch(html, /<img\b|viewBox="0 0 5333|🏠/);
  for (let i = 0; i < FAMILY.length; i++) assert.match(html, new RegExp(`>Word${i}<`), 'the override’s word was dropped');

  // A real re-pick lands.
  slots['customer.bottom-nav.explore'] = { label: 'Suppliers', icon: { ...NONE, kind: 'lucide', lucideName: 'Heart' }, isHidden: false };
  assert.ok(glyphs(renderBar(slots)).includes('lucide-heart'), 'a lucide re-pick did not reach the bar');
});

test('5 · the desktop rail’s five rows draw the same five icons', () => {
  for (const slots of [undefined, defaultSlots()]) {
    const groups = buildCustomerNavGroups(EVENT_ID, { websiteEnabled: true });
    const rows = (slots ? applyRegistry(groups, slots) : groups).flatMap((g) => g.items);
    for (const [key, icon] of FAMILY) {
      assert.equal(rows.find((r) => r.key === key)?.icon, icon, `the rail’s ${key} row is not ${icon.displayName}`);
    }
  }
  // And the family is the menu's own map, not a second list.
  assert.equal(EVENT_MENU_ICONS.overview, HouseWifi);
});
