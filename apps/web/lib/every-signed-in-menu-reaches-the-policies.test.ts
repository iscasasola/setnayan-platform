/**
 * EVERY SIGNED-IN ROLE'S MENU REACHES PRIVACY, TERMS AND ACCOUNT DELETION (sweep 2026-10-19, row A2).
 *
 * App Store review asks for two things a signed-in person can find without leaving the app: the privacy policy
 * (5.1.1(i)) and a way to delete the account (5.1.1(v)). The sweep's code audit reported the supplier had no policy
 * link. This holds the property for EVERY role the code knows, not for a hand-typed pair:
 *
 *   · the roles are read from `UserRoleSummary` in `lib/roles.ts` — each `has<Role>Access` flag is a console a person
 *     can sign into. A new flag with no menu named here FAILS, so a third console cannot ship without the doors;
 *   · each role's tree mounts the shared shell (`<AppRailShell>` → `<FrontDoorShell>`, whose ☰ drawer carries the
 *     policies from `lib/policy-links.ts`) AND the account sheet (`<AccountSwitcher>`, whose "Profile & settings" is
 *     `/dashboard/profile`, the page with "Delete my account");
 *   · supplier Settings is RENDERED, for an owner and for a scoped team member, in the web and in the store shell, and
 *     the markup must carry every required policy and the Account row;
 *   · none of the policies is refused in the store shell (middleware's marketing bounce, `lib/store-shell.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { POLICY_LINKS, REQUIRED_POLICY_HREFS } from '@/lib/policy-links';
import { isStoreShellWebOnlyPath, storeShellHidesHref } from '@/lib/store-shell';
import { SettingsView } from '@/app/vendor-dashboard/settings/settings-view';
import { settingsMoreTools } from '@/app/vendor-dashboard/settings/settings-rows';

// tsx compiles components with the classic JSX runtime (tsconfig keeps JSX as `preserve` for Next).
(globalThis as { React?: unknown }).React = React;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/**
 * Each console's tree: the layouts a signed-in person of that role is drawn inside. Keyed by the `has<Role>Access`
 * flag's <Role>. The couple's tree is three layouts (the board, the account pages, an event).
 */
const TREES: Record<string, readonly string[]> = {
  Customer: ['app/dashboard/(launcher)/layout.tsx', 'app/dashboard/(account)/layout.tsx', 'app/dashboard/[eventId]/layout.tsx'],
  Vendor: ['app/vendor-dashboard/layout.tsx'],
  Admin: ['app/admin/layout.tsx'],
};

const DELETION_PAGE = '/dashboard/profile';

function rolesFromCode(): string[] {
  const roles = readFileSync(join(WEB, 'lib/roles.ts'), 'utf8');
  const body = roles.match(/export type UserRoleSummary = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  return [...stripComments(body).matchAll(/\bhas([A-Z]\w*)Access\s*:\s*boolean/g)].map((m) => m[1] ?? '');
}

test('the roles come from the code, and every one has a tree named here', () => {
  const roles = rolesFromCode();
  assert.ok(roles.length >= 2, `read ${roles.length} roles from UserRoleSummary — the reader is broken, not the menus`);
  assert.ok(roles.includes('Customer') && roles.includes('Vendor'), `couple and supplier must be among them: ${roles.join(', ')}`);
  const unnamed = roles.filter((r) => !TREES[r]);
  assert.deepEqual(unnamed, [], `a console with no menu checked: ${unnamed.join(', ')} — name its layouts in TREES`);
});

test('every role’s tree mounts the shell (☰ drawer → policies) and the account sheet (→ deletion)', () => {
  for (const role of rolesFromCode()) {
    for (const layout of TREES[role] ?? []) {
      assert.ok(existsSync(join(WEB, layout)), `${role}: ${layout} is gone`);
      const code = src(layout);
      assert.match(code, /<AppRailShell\b/, `${role}: ${layout} no longer mounts the shell, so its ☰ drawer and its policies are gone`);
      assert.match(code, /<AccountSwitcher\b/, `${role}: ${layout} no longer mounts the account sheet, so "Profile & settings" (deletion) is gone`);
    }
  }
});

test('the shell’s drawer draws the policies from the one list, behind the ☰ that opens it', () => {
  assert.match(src('app/_components/frontdoor/app-rail-shell.tsx'), /<FrontDoorShell\b/);
  const shell = src('app/_components/frontdoor/front-door-shell.tsx');
  assert.match(shell, /aria-label="Menu"/, 'the ☰ that opens the drawer below 1024 is gone');
  const at = shell.indexOf('className="fd-smallprint"');
  assert.ok(at > 0, 'the drawer’s small print is gone');
  const smallprint = shell.slice(at, shell.indexOf('</div>', shell.indexOf('fd-tag2', at)));
  assert.match(smallprint, /POLICY_LINKS\.map\(/, 'the drawer no longer reads lib/policy-links.ts');
  for (const p of POLICY_LINKS) {
    assert.ok(!shell.includes(`href="${p.href}"`), `${p.href} is typed by hand in the drawer again — read POLICY_LINKS`);
  }
});

test('the list holds what a reviewer looks for, and each is a real page', () => {
  const hrefs = POLICY_LINKS.map((p) => p.href);
  for (const h of REQUIRED_POLICY_HREFS) {
    assert.ok(hrefs.includes(h), `${h} left lib/policy-links.ts`);
  }
  for (const h of hrefs) {
    assert.ok(existsSync(join(WEB, 'app/(shell)', h.slice(1), 'page.tsx')), `${h} has no page`);
  }
});

test('no policy is refused in the store shell', () => {
  const mw = readFileSync(join(WEB, 'middleware.ts'), 'utf8');
  const excluded = mw.match(/const APP_EXCLUDED_MARKETING_PATHS = new Set\(\[([\s\S]*?)\]\)/)?.[1];
  assert.ok(excluded, 'APP_EXCLUDED_MARKETING_PATHS moved — point this reader at it');
  const bounced = [...excluded.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(bounced.length > 0);
  for (const { href } of POLICY_LINKS) {
    assert.ok(!bounced.includes(href), `${href} is bounced off the app by middleware`);
    assert.equal(isStoreShellWebOnlyPath(href), false, `${href} is web-only in the store shell`);
    assert.equal(storeShellHidesHref(href, 'https://www.setnayan.com/vendor-dashboard/settings'), false, `${href} is hidden in the store shell`);
  }
});

test('supplier Settings, rendered, carries every policy and the Account row — for an owner and a team member, web and app', () => {
  const tools = settingsMoreTools({ hasMoodboardLibraryAccess: false, hasMusicRepertoireAccess: false, storeShell: false });
  for (const manager of [true, false]) {
    for (const storeShell of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(SettingsView, { unread: 0, manager, payout: 'unreadable', tools }),
      );
      const who = `${manager ? 'owner' : 'team member'}${storeShell ? ' · app' : ' · web'}`;
      for (const h of REQUIRED_POLICY_HREFS) {
        assert.ok(html.includes(`href="${h}"`), `${who}: Settings has no ${h}`);
      }
      assert.ok(html.includes(`href="${DELETION_PAGE}"`), `${who}: Settings lost the Account row (${DELETION_PAGE}, where deletion lives)`);
    }
  }
});

test('the account sheet and the Account row land on the page that deletes the account, and a supplier is let in', () => {
  assert.ok(src('app/_components/account-switcher/account-switcher.tsx').includes(`href="${DELETION_PAGE}"`), 'the account sheet lost "Profile & settings"');
  const profile = src('app/dashboard/(account)/profile/page.tsx');
  assert.match(profile, /<form action=\{requestAccountDeletion\}/, 'the profile page no longer holds the deletion request');
  for (const layout of ['app/dashboard/layout.tsx', 'app/dashboard/(account)/layout.tsx']) {
    assert.doesNotMatch(src(layout), /redirect\(\s*['"`]\/vendor-dashboard/, `${layout} sends a supplier away from the deletion page`);
  }
});
