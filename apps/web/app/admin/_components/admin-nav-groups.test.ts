/**
 * GUARD — the admin menu cannot lose a group or an item silently.
 *
 * WHY THIS EXISTS: on 2026-08-02, commit 4604bf718 ("retire the sign-in hero
 * video") intended to delete ONE 7-line nav item and deleted 332 lines — taking
 * the whole `directory` (Accounts) and `media` (Studio) GROUPS with it, plus all
 * 27 Overview queue items. The surviving Studio items were absorbed into the
 * Overview group, so the row labelled "Overview" listed Songs and Referrals.
 *
 * NOTHING CAUGHT IT. A menu is an array of objects; a shorter array is still a
 * valid array, so typecheck, lint, and every unit test stayed green. The
 * regression reached production and was found by a human opening the page.
 *
 * The fix is to check the menu against sources that exist for their OWN reasons,
 * so this is never two hand-typed lists agreeing with each other
 * ([[feedback_a_guard_comparing_two_hand_typed_things]]):
 *
 *   (A) THE NAV REGISTRY — `NAV_SLOT_DEFAULTS` carries one `admin.sidebar.<key>`
 *       slot per menu item so /admin/menus can rename and re-icon it. It is
 *       maintained for the rename feature, not for this test. Every slot must
 *       still have an item. On the broken commit this check reports 28 missing.
 *
 *   (B) MENU_HUBS in admin-sidebar.tsx — one entry per GROUP, giving that
 *       group's hub href + description. It survived the deletion untouched
 *       (`directory` and `media` still have hub entries pointing at
 *       /admin/accounts and /admin/studio), so comparing against it catches a
 *       vanished group even when its items are absorbed elsewhere and the total
 *       item count still looks plausible.
 *
 * Deliberately NOT asserted: an exact group or item COUNT. A number in a test is
 * a number someone updates to make the build pass.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ADMIN_NAV_GROUPS } from './admin-nav-groups';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';

const SIDEBAR = path.join(import.meta.dirname, 'admin-sidebar.tsx');

const groupKeys = ADMIN_NAV_GROUPS.map((g) => g.key);
const itemKeys = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key));

/**
 * MENU_HUBS group keys, read out of the sidebar as text. The sidebar is a
 * 'use client' module that imports next/navigation, so it cannot be imported
 * into a node test — the same text-scanning approach the house nav lints use
 * (scripts/lint-bottom-nav.mjs).
 */
function menuHubKeys(): string[] {
  const src = readFileSync(SIDEBAR, 'utf8');
  const start = src.indexOf('const MENU_HUBS');
  assert.notEqual(
    start,
    -1,
    'MENU_HUBS is gone from admin-sidebar.tsx. It is what maps each nav group to ' +
      'its hub landing; without it this guard is blind. Restore it or rewrite this test.',
  );
  const body = src.slice(start);
  const end = body.indexOf('\n};');
  assert.notEqual(end, -1, 'Could not find the end of the MENU_HUBS object literal.');
  return [...body.slice(0, end).matchAll(/^ {2}'?([a-z][a-z0-9-]*)'?:\s*\{/gm)].map((m) => m[1]!);
}

test('the guard can actually fail — every source it reads is non-empty', () => {
  // A guard that silently matches nothing passes forever. These floors are
  // deliberately far below the real values (78 items · 64 slots · 6 groups):
  // they catch a broken parse or a renamed export, not a shrinking menu.
  assert.ok(groupKeys.length >= 2, `ADMIN_NAV_GROUPS parsed as ${groupKeys.length} groups.`);
  assert.ok(itemKeys.length >= 10, `ADMIN_NAV_GROUPS parsed as ${itemKeys.length} items.`);
  assert.ok(
    NAV_SLOT_DEFAULTS.filter((s) => s.key.startsWith('admin.sidebar.')).length >= 10,
    'Found almost no admin.sidebar.* slots in NAV_SLOT_DEFAULTS — the slot key ' +
      'prefix probably changed, which would make this whole guard inert.',
  );
  assert.ok(menuHubKeys().length >= 2, 'MENU_HUBS parsed as fewer than 2 groups.');
});

test('every renameable admin menu slot still has a nav item', () => {
  const items = new Set(itemKeys);
  const orphaned = NAV_SLOT_DEFAULTS.filter((s) => s.key.startsWith('admin.sidebar.'))
    .map((s) => s.key.slice('admin.sidebar.'.length))
    .filter((k) => !items.has(k));

  assert.deepEqual(
    orphaned,
    [],
    `These admin menu items are registered as renameable in /admin/menus but no longer ` +
      `exist in ADMIN_NAV_GROUPS, so they have no doorway in the sidebar:\n    ` +
      orphaned.join(', ') +
      `\n    → if an item was retired ON PURPOSE, delete its admin.sidebar.<key> slot ` +
      `from lib/nav-registry-defaults.ts in the same commit. If not, it was dropped by ` +
      `accident — see the docblock on this file for the 2026-08-02 precedent.`,
  );
});

test('every nav group has a hub, and every hub has a nav group', () => {
  const hubs = menuHubKeys();

  const groupsWithoutHub = groupKeys.filter((k) => !hubs.includes(k));
  assert.deepEqual(
    groupsWithoutHub,
    [],
    `Nav groups with no MENU_HUBS entry: ${groupsWithoutHub.join(', ')}. ` +
      `deriveSixMenus() would land them on their first child instead of a hub.`,
  );

  const hubsWithoutGroup = hubs.filter((k) => !groupKeys.includes(k));
  assert.deepEqual(
    hubsWithoutGroup,
    [],
    `MENU_HUBS defines a hub for these groups but ADMIN_NAV_GROUPS has no such group: ` +
      `${hubsWithoutGroup.join(', ')}.\n    → deriveSixMenus() maps over the GROUPS, so ` +
      `each of these is a menu row that no longer renders. This is the exact shape of the ` +
      `2026-08-02 regression, where 'directory' (Accounts) and 'media' (Studio) were ` +
      `deleted and their hub entries left behind.`,
  );
});

test('no nav group is empty and no item key is duplicated', () => {
  const empty = ADMIN_NAV_GROUPS.filter((g) => g.items.length === 0).map((g) => g.key);
  assert.deepEqual(empty, [], `Empty nav groups render as a dead menu row: ${empty.join(', ')}.`);

  const seen = new Set<string>();
  const dupes = itemKeys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
  assert.deepEqual(
    [...new Set(dupes)],
    [],
    `Duplicate nav item keys: ${[...new Set(dupes)].join(', ')}. Item keys address the ` +
      `nav registry and the queue-count badges, so a duplicate makes both ambiguous.`,
  );
});
