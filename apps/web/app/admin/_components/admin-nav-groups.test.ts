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

import { ADMIN_NAV_GROUPS } from './admin-nav-groups';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';

const groupKeys = ADMIN_NAV_GROUPS.map((g) => g.key);
const itemKeys = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key));

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

/* The "every nav group has a hub" check retired with `admin-sidebar.tsx` (2026-11-13): the six-group rail it fed
   is now the approved five tabs (`lib/admin/admin-tabs.ts`), and every admin page's home is held by
   `app/admin/admin-routes-all-have-a-tab.test.ts`. ADMIN_NAV_GROUPS still feeds the search and /admin/more. */

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
