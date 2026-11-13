/**
 * The phone reaches the whole console — five tabs, no More.
 *
 * ⚖ THIS REPLACES "the phone answers, it does not edit" (owner 2026-08-26), BY THE OWNER'S OWN LATER RULINGS:
 *   · 2026-10-28 (DECISION_LOG "ADMIN — OWNER ANSWERS …"): *"edit from the phone → YES (lifts the August 'the phone
 *     answers, it doesn't edit' rule)"*;
 *   · 2026-11-13 (DECISION_LOG "ADMIN DRAWING APPROVED — BUILD IT"): *"admin has been ok'ed"* — the bottom bar is
 *     Work · Money · People · Catalogue · Insights, no More; admin-of-admin is under the avatar.
 *
 * What the old guard protected still holds, in a new shape: More was kept because deleting "the only route from a
 * phone to sixty pages" would be a capability deletion. It is gone now only because every page has a tab › view
 * reached from the pinned row's `Page · View ▾` — `admin-routes-all-have-a-tab.test.ts` fails if any page is left
 * without one. And the line that told a phone "Prices, the website and settings are on the computer" is retired:
 * after the 10-28 ruling it was false.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_TABS } from '@/lib/admin/admin-tabs';
import { stripComments } from '@/lib/strip-comments';

const ADMIN = join(process.cwd(), 'app/admin');
const read = (rel: string) => readFileSync(join(ADMIN, rel), 'utf8');
const code = stripComments;

const bar = code(read('_components/admin-bottom-nav.tsx'));
const layout = code(read('layout.tsx'));
const rows = code(read('_components/admin-tab-rows.tsx'));
const home = code(read('page.tsx'));

test('the phone bar is the five tabs, drawn from the one source — and has no More', () => {
  assert.match(bar, /export const ADMIN_BOTTOM_NAV_ITEMS: BottomNavItem\[\] = ADMIN_TABS\.map\(/);
  assert.deepEqual(
    ADMIN_TABS.map((t) => t.label),
    ['Work', 'Money', 'People', 'Catalogue', 'Insights'],
  );
  assert.ok(ADMIN_TABS.length <= 5, 'the bar is a ≤5 primitive');
  assert.doesNotMatch(bar, /label: 'More'|\/admin\/more/, 'a More tab is back');
});

test('every page wears the pinned row (Page · View ▾ + ⚙) and the phone wears the thumb row', () => {
  assert.match(layout, /<AdminPinnedRow queueCounts=\{queueCounts\} \/>\s*\{children\}/, 'the pinned row is not above every page');
  assert.match(layout, /<AdminThumbRow \/>/, 'the thumb row is not mounted');
  // The view picker is the shared PickMenu inside the shared PinnedRow; the ⚙ is the shared MenuSettingsButton.
  assert.match(rows, /<PinnedRow\b/);
  assert.match(rows, /<MenuSettingsButton\s+menu="admin"/);
  // The thumb row's search opens the console's existing search panel — not a second search.
  assert.match(rows, /ADMIN_SEARCH_OPEN_EVENT/);
  // …and it is the phone's: from 1024 the top bar's box is the search.
  assert.match(rows, /<div className="lg:hidden" data-admin-thumb=/);
});

test('the "edit on the computer" line is retired — it became false on 2026-10-28', () => {
  assert.doesNotMatch(home, /EditingIsOnTheComputer/);
  assert.doesNotMatch(code(read('_components/what-you-change.tsx')), /are on the computer/);
});
