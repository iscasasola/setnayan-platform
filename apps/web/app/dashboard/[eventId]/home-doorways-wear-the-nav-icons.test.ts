/**
 * home-doorways-wear-the-nav-icons.test.ts — A DOORWAY WEARS ITS TAB'S ICON.
 *
 * Owner, verbatim (2026-10-07): *"make the logo of guests, supplier and event
 * hub consistent"*. Home's doorway row — "Edit your Guest list · Edit your
 * Suppliers · Edit your Event Hub" (PR 4e) — opens the Guests, Suppliers and Hub
 * tabs, so each button draws EXACTLY that tab's icon: BookUser · Store ·
 * AppWindow (the owner's pick, DECISION_LOG "THE BOTTOM NAV'S FIVE ICONS").
 *
 * WHAT THIS HOLDS:
 *   1 · `HOME_DOORWAY_ICONS` is the bar's own three icons, not a second pick.
 *   2 · `homeDoorwayIcon(key, navSlots)` resolves the SAME registry slot the
 *       tab reads, through the same line-only rule — an admin re-icon moves the
 *       doorway with its tab; an emoji, image or mark moves neither.
 *   3 · Any file that draws the doorway row takes its icons from 1 or 2 — a
 *       hand-picked glyph (a Pencil on Event Hub) cannot sit beside them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BookUser, Store, AppWindow } from 'lucide-react';

import { buildCustomerMenuTree, HOME_DOORWAY_ICONS } from '@/lib/customer-menu';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';
import { homeDoorwayIcon, navLineIcon, type HomeDoorwayKey } from '@/lib/nav-line-icon';
import type { NavIconDescriptor, NavSlotLite } from '@/lib/nav-registry-types';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const APP = join(HERE, '..', '..');
const KEYS: HomeDoorwayKey[] = ['guests', 'explore', 'launch'];

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

test('1 · the three doorway icons ARE the Guests · Suppliers · Hub tab icons', () => {
  assert.deepEqual({ ...HOME_DOORWAY_ICONS }, { guests: BookUser, explore: Store, launch: AppWindow });
  const tree = buildCustomerMenuTree('S89E-DOORWAYS01', { websiteEnabled: true });
  for (const k of KEYS) {
    assert.equal(HOME_DOORWAY_ICONS[k], tree.find((t) => t.key === k)?.icon, `the ${k} doorway is not its tab's icon`);
  }
});

test('2 · a doorway resolves the same registry slot as its tab, line-only', () => {
  const tree = buildCustomerMenuTree('S89E-DOORWAYS01', { websiteEnabled: true });
  const tabIcon = (slots: Record<string, NavSlotLite>, k: HomeDoorwayKey) =>
    navLineIcon(slots[`customer.bottom-nav.${k}`]?.icon, tree.find((t) => t.key === k)!.icon);

  const slots = defaultSlots();
  for (const k of KEYS) {
    assert.equal(homeDoorwayIcon(k, slots), HOME_DOORWAY_ICONS[k]);
    assert.equal(homeDoorwayIcon(k, undefined), HOME_DOORWAY_ICONS[k]);
  }
  const emoji: NavIconDescriptor = { kind: 'lucide', lucideName: '✏️', customRef: null, customUrl: null };
  const image: NavIconDescriptor = { kind: 'custom', lucideName: null, customRef: null, customUrl: 'https://x.test/p.png' };
  const repick: NavIconDescriptor = { kind: 'lucide', lucideName: 'Heart', customRef: null, customUrl: null };
  for (const icon of [emoji, image, repick]) {
    for (const k of KEYS) {
      const s = { ...slots, [`customer.bottom-nav.${k}`]: { label: 'x', icon, isHidden: false } };
      assert.equal(homeDoorwayIcon(k, s), tabIcon(s, k), `the ${k} doorway and its tab disagree on a ${icon.kind} override`);
    }
  }
});

/** Every .tsx under app/ — the doorway row may land in any Home file. */
function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) tsxFiles(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const PHRASES = ['Edit your Guest list', 'Edit your Suppliers', 'Edit your Event Hub'];

test('3 · a file that draws the doorway row takes its icons from the nav', () => {
  const rows = tsxFiles(APP).filter((f) => {
    const src = stripComments(readFileSync(f, 'utf8'));
    return PHRASES.filter((p) => src.includes(p)).length >= 2;
  });
  // Printed, so a reader can see whether part 3 bound anything this run
  // (0 until PR 4e lands the row; 1+ after).
  console.log(`doorway-row files: ${rows.length} ${rows.map((f) => relative(APP, f)).join(', ')}`);
  for (const f of rows) {
    const src = stripComments(readFileSync(f, 'utf8'));
    assert.match(
      src,
      /\bHOME_DOORWAY_ICONS\b|\bhomeDoorwayIcon\(/,
      `${relative(APP, f)} draws the doorway row but does not take its icons from HOME_DOORWAY_ICONS / homeDoorwayIcon`,
    );
  }
});
