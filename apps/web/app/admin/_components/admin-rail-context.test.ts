/**
 * GUARD — the console's rows, under the shared rail.
 *
 * One Shell slice 3 (2026-08-14). Every rule here fails SILENTLY if it
 * regresses: a hardcoded active state still renders a rail, a lost account
 * menu still renders a top bar, a seventh group still renders six rows plus
 * one. Nothing errors. The console just quietly stops being right.
 *
 * 🛡 EVERY ASSERTION WAS MUTATION-CHECKED — each rule was broken on purpose and
 * this file confirmed RED, BY OCCURRENCE COUNT before and after, before being
 * trusted. Five guards in one week of this project's history passed while the
 * thing they guarded was already gone.
 *
 * ⚠ THIS TEST IS NOT THE DESIGN. It says nothing about spacing, wording or
 * colour. If a change needs this file edited to go green, stop and look.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_TABS, activeAdminTabKey } from '@/lib/admin/admin-tabs';

const HERE = __dirname;
const RAIL = readFileSync(join(HERE, 'admin-rail-context.tsx'), 'utf8');
const LAYOUT = readFileSync(join(HERE, '..', 'layout.tsx'), 'utf8');

/** Comments stripped. Both files carry long notes that quote the very strings
 *  being asserted — a guard reading raw source would find its needle inside the
 *  sentence explaining the needle, and pass forever. That is the documented
 *  "a removal comment blinds the guard" failure in this repo. */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

const RAIL_CODE = code(RAIL);
const LAYOUT_CODE = code(LAYOUT);

test('ANCHOR — both sources were read and stripping left code behind', () => {
  // Every assertion below passes vacuously against an empty string.
  assert.ok(RAIL.length > 2000, `admin-rail-context.tsx read as ${RAIL.length} chars`);
  assert.ok(LAYOUT.length > 4000, `admin/layout.tsx read as ${LAYOUT.length} chars`);
  assert.ok(
    RAIL_CODE.includes('export function AdminRailContext'),
    'comment-stripping ate the rail component; the scan would prove nothing',
  );
  assert.ok(
    LAYOUT_CODE.includes('export default async function AdminLayout'),
    'comment-stripping ate the layout; the scan would prove nothing',
  );
});

/* ── 1 · THE ACTIVE ROW IS RESOLVED, NEVER TYPED ──────────────────────────
   The front-door rail shipped with `Home` hardcoded `data-on="true"`. That
   read correctly on the ONE url it rendered on, and would have lit Home on
   every page the moment the same rail moved inside the app. This is the admin
   half of that rule. */
test('no rail row hardcodes its own active state', () => {
  const literalOn = RAIL_CODE.match(/data-on=(?:"(?:true|false)"|\{\s*['"](?:true|false)['"]\s*\})/g) ?? [];
  assert.deepEqual(
    literalOn,
    [],
    `A rail row states its active state as a literal: ${literalOn.join(', ')}. ` +
      `It must come from activeAdminTabKey() — a literal is not a match, and ` +
      `nothing throws when it is wrong.`,
  );
  const literalCurrent = RAIL_CODE.match(/aria-current=(?:"page"|\{\s*['"]page['"]\s*\})/g) ?? [];
  assert.deepEqual(
    literalCurrent,
    [],
    `aria-current is hardcoded: ${literalCurrent.join(', ')}. A rail that only ` +
      `LOOKS right is only half right — a screen reader would be told every page ` +
      `is the current one.`,
  );
  assert.match(
    RAIL_CODE,
    /activeAdminTabKey\(/,
    'the rail no longer resolves an active key at all',
  );
});

/* ── 2 · ONE WINNER, NEVER TWO ────────────────────────────────────────────
   Two lit rows is not a smaller bug than zero — it tells the reader they are
   in two places at once. Exercised against the REAL menu list, not a copy of
   it: on 2026-08-13 a rail test declared its own rows and a mutation to the
   real list passed every assertion. */
/*
   🛠 REWRITTEN 2026-11-13 for the approved five tabs (owner: "admin has been
   ok'ed", `prototypes/admin_pub/`). The rail is no longer the six groups + All
   surfaces — it is Work · Money · People · Catalogue · Insights, drawn from
   `lib/admin/admin-tabs.ts`. The RULE is unchanged: one winner, never two,
   never a fallback, read from the real list. */
test('the rail draws the five tabs from the one source, in order', () => {
  assert.deepEqual(
    ADMIN_TABS.map((t) => t.key),
    ['work', 'money', 'people', 'catalogue', 'insights'],
  );
  assert.match(RAIL_CODE, /ADMIN_TABS\.map\(/, 'the rail no longer draws its rows from ADMIN_TABS');
});

/** A stand-in for `useSearchParams()` — the matcher only ever calls `.get`. */
const params = (q: string) => new URLSearchParams(q);

for (const [pathname, query, expected] of [
  ['/admin', '', 'work'],
  ['/admin/work', '', 'work'],
  ['/admin/more', '', 'work'],
  ['/admin/verify', '', 'people'],
  ['/admin/accounts', '', 'people'],
  ['/admin/accounts', 'tab=users', 'people'],
  ['/admin/directory', '', 'people'],
  ['/admin/studio', '', 'catalogue'],
  ['/admin/ugat', '', 'catalogue'],
  ['/admin/app-performance', '', 'insights'],
  ['/admin/money', '', 'money'],
  // Query-aware: one page, two tabs — the query decides.
  ['/admin/pricing', 'tab=pricing', 'catalogue'],
  ['/admin/pricing', 'tab=free-windows', 'money'],
  ['/admin/studio', 'tab=discount-codes', 'money'],
  // The old "bare tabbed URL lights nothing" gap is CLOSED: /admin/pricing with
  // no query is Catalogue › Prices.
  ['/admin/pricing', '', 'catalogue'],
] as const) {
  const url = query ? `${pathname}?${query}` : pathname;
  test(`${url} lights exactly one tab — ${expected}`, () => {
    assert.equal(activeAdminTabKey(pathname, params(query)), expected, `${url} must light "${expected}" and nothing else`);
  });
}

test('admin-of-admin lights no tab — it lives under the avatar', () => {
  assert.equal(activeAdminTabKey('/admin/settings', params('tab=notifications')), null);
  assert.equal(activeAdminTabKey('/admin/secrets', params('')), null);
});

test('a page no tab owns lights NOTHING, and never falls back to the first tab', () => {
  /*
    `null` IS A REAL ANSWER. A person on a page the rail does not list is
    better told nothing than told they are somewhere they are not — and a
    silent fallback to the first tab is indistinguishable from a correct match.
  */
  assert.equal(activeAdminTabKey('/dashboard', null), null);
  assert.equal(activeAdminTabKey('/', null), null);
});

/* ── 3 · THE ACCOUNT MENU SURVIVED THE CHROME SWAP ────────────────────────
   The desktop account panel used to open from the HQ plaque in the old
   sidebar header. That header is gone and the shared rail has no account menu
   in its app variant, so the top bar's pill is now the ONLY route to sign out
   on this doorway. `lg:hidden` on it would strand that control on desktop
   while the console looked completely fine. */
test('the admin account menu is reachable at every width', () => {
  assert.match(
    LAYOUT_CODE,
    /<AccountSwitcher\s+data=\{switcherData\}[^>]*\/>/,
    'the AccountSwitcher is gone from the admin top bar — with the old sidebar ' +
      'plaque retired, that is the only way to sign out of HQ',
  );
  /*
    Anchored on the IMMEDIATELY ENCLOSING opening tag (`[^>]*` cannot cross a
    `>`), not on "an lg:hidden somewhere nearby". The layout already carries six
    unrelated `lg:hidden` classes, and a proximity window would cry wolf the
    first time one of them moved — and a guard that cries wolf teaches you to
    skim past the one time it is right.
  */
  const gated = LAYOUT_CODE.match(/lg:hidden[^>]*>\s*<AccountSwitcher/g) ?? [];
  assert.deepEqual(
    gated,
    [],
    'the AccountSwitcher is inside an `lg:hidden` wrapper again. On desktop the ' +
      'old sidebar plaque used to carry it; that plaque no longer exists, so this ' +
      'hides the only sign-out on every desktop admin page.',
  );
});

/* ── 4 · THE SLA PILL IS THE ALWAYS-VISIBLE CHANNEL ───────────────────────
   Between 1024 and 1280 the rail is a 72px icon strip and the stylesheet hides
   `.fd-ct`, so the per-menu queue badge is not visible there. That is only
   acceptable because the overdue / due-soon pill renders on every admin page
   at every width. If the pill goes, the badge must stop being a `.fd-ct`. */
test('the overdue / due-soon escalation pill still renders in the top bar', () => {
  assert.match(LAYOUT_CODE, /urgency\.overdue\s*>\s*0/, 'the overdue pill branch is gone');
  assert.match(LAYOUT_CODE, /urgency\.dueSoon\s*>\s*0/, 'the due-soon pill branch is gone');
  assert.match(
    LAYOUT_CODE,
    /urgency\.unknownCount\s*>\s*0/,
    'the DEGRADED branch is gone — a failed digest would render pixel-identical ' +
      'to a clear day, so an outage reads as "all clear"',
  );
});

/* ── 5 · THE MOBILE PAGE SLIDE STILL HAS SOMETHING TO SLIDE ───────────────
   `NavSlideController` lists `/admin` among its base tabs and animates exactly
   one named element (`.sn-vt-page` → `view-transition-name: sn-page`), freezing
   the rest. That name rode on SidebarShell's <main>, which this tree no longer
   mounts. Without it the tap still starts a transition — and animates NOTHING. */
test('the admin content still carries the view-transition name', () => {
  const named = LAYOUT_CODE.match(/\bsn-vt-page\b/g) ?? [];
  assert.equal(
    named.length,
    1,
    `expected exactly one sn-vt-page in the admin layout, saw ${named.length}. ` +
      `Zero kills the mobile bottom-nav page slide silently; two is a DUPLICATE ` +
      `view-transition-name, which makes the browser skip the transition entirely.`,
  );
});

/* ── 6 · THE PHONE IS STILL A BOTTOM BAR ──────────────────────────────────
   The shared rail paints nothing below 1024 by design. If the bottom nav ever
   left this layout with the rail in place, the console would have no
   navigation at all on a phone. */
test('the admin bottom nav and ⌘K are mounted, once each and unconditionally', () => {
  /*
    🪤 THE FIRST CUT OF THIS TEST WAS DECORATION, and the mutation run said so.
    It asserted the string `<AdminBottomNav` appeared. Sabotaging the layout to
    `{null && <AdminBottomNav …}` — the bar gone from every phone — left that
    string in place and the guard GREEN. A guard can match a STRING and miss the
    ACT.

    So: count it (deletion and duplication both fail), and refuse the two shapes
    that render nothing while reading as a mount.
  */
  for (const [name, what] of [
    ['AdminBottomNav', 'the mobile bottom nav — the whole of navigation below 1024, where the shared rail paints nothing'],
    ['AdminCommandPalette', '⌘K across all 108 admin pages'],
  ] as const) {
    const mounts = LAYOUT_CODE.match(new RegExp(String.raw`<${name}\b`, 'g')) ?? [];
    assert.equal(mounts.length, 1, `expected exactly one <${name}>, saw ${mounts.length} — ${what}`);
    assert.doesNotMatch(
      LAYOUT_CODE,
      new RegExp(String.raw`(?:&&|\?)\s*<${name}\b`),
      `<${name}> is rendered behind a condition. It must be unconditional — ${what}.`,
    );
  }
});

/* ── 7 · THE ROWS WEAR THE RAIL'S GRAMMAR ─────────────────────────────────
   One shell means one row grammar. The old admin row styled itself from
   `--m-sidebar-*`, the tokens of the panel that no longer exists; inside the
   front door's cream rail they read as a second rail pasted into the first. */
test('the rail rows use the shared row class, not the retired panel tokens', () => {
  assert.match(RAIL_CODE, /className="fd-row"/, 'the admin rows left the shared rail grammar');
  const retired = RAIL_CODE.match(/--m-sidebar-[a-z-]+/g) ?? [];
  assert.deepEqual(
    retired,
    [],
    `the rows reference retired sidebar-panel tokens: ${retired.join(', ')}`,
  );
});
