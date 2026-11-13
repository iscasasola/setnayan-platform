/**
 * GUARD — a menu is renamed once, or it is not renamed.
 *
 * ─── WHY THIS FILE EXISTS ─────────────────────────────────────────────────
 * On 2026-08-25 the console's six menus were recut and renamed in
 * `ADMIN_NAV_GROUPS`: Today · People & shops · Studio · Root map · Numbers ·
 * Money. Every test passed, the PR merged, production served it — and the next
 * morning the owner opened the console and said, correctly, *"it still looks
 * the same."*
 *
 * He was right and the rename was real. The name he READS just wasn't the one
 * that had been renamed. It lives in THREE places:
 *
 *   1. `ADMIN_NAV_GROUPS[].label`   — the full word in the wide rail.  RENAMED.
 *   2. `STRIP_CAPTION`              — the word under the icon between 1024 and
 *      1280px, where the stylesheet hides `.fd-label-text` and shows
 *      `.fd-icon-caption`. At that width THIS IS THE MENU.        NOT renamed.
 *   3. `NAV_SLOT_DEFAULTS['admin.bottom-nav.*'].label` — which the bottom nav
 *      overlays ON TOP of its own hardcoded label, so the registry WINS on
 *      every phone.                                               NOT renamed.
 *
 * Both stale copies out-ranked the renamed one on the exact two screens the
 * owner uses. 🔑 **A rename that reaches the source and not the copies is not a
 * rename — it is a diff.** The tell was in the product the whole time: Money
 * was the one phone tab reading correctly, and it is the one tab with NO
 * registry slot.
 *
 * ─── WHAT THIS FILE DOES NOT DO ───────────────────────────────────────────
 * It never asserts a WORD. Pinning "Today" would just be a fourth copy, and the
 * next rename would edit it to go green — which is how a guard becomes
 * decoration. It asserts the RELATIONSHIP: every copy must still be derivable
 * from the one source. Rename a group to anything at all and the copies that
 * did not follow go red, naming themselves.
 *
 * 🛡 Every assertion here was mutation-checked — broken on purpose, confirmed
 * RED by occurrence count before → after, then restored.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ADMIN_NAV_GROUPS } from './admin-nav-groups';
import { ADMIN_TABS } from '@/lib/admin/admin-tabs';
import { ADMIN_BOTTOM_NAV_ITEMS } from './admin-bottom-nav';
import { ADMIN_NAV_ALIASES } from './admin-nav-descriptions';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';
import { readdirSync, statSync } from 'node:fs';

const RAIL_SRC = readFileSync(
  join(__dirname, 'admin-rail-context.tsx'),
  'utf8',
);

/** Comments stripped BEFORE matching. This file's own docblock quotes the menu
 *  names it is checking, and the rail's docblock quotes them too — a guard
 *  reading raw source finds its needle inside the sentence explaining the
 *  needle and passes forever. Documented failure in this repo. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/*
 * 🛠 2026-11-13 — THE FIVE TABS RETIRE THE SECOND COPY OUTRIGHT.
 * The rail is now the approved five tabs (`lib/admin/admin-tabs.ts`: Work ·
 * Money · People · Catalogue · Insights). Each name is ONE word, so the 72px
 * strip's caption is the label itself — `STRIP_CAPTION`, the copy that drifted,
 * no longer exists. Rules 1–3 now pin that: the caption IS the label, and every
 * tab name is one word, so it never has to be shortened into a second name.
 */
test('ANCHOR — the rail source was read', () => {
  assert.ok(RAIL_SRC.length > 2000, `admin-rail-context.tsx read as ${RAIL_SRC.length} chars`);
  assert.ok(ADMIN_TABS.length === 5, 'the five tabs did not load');
  assert.ok(ADMIN_BOTTOM_NAV_ITEMS.length >= 3, 'bottom nav items not loaded');
  assert.ok(NAV_SLOT_DEFAULTS.length > 100, 'nav slot defaults not loaded');
});

test('1 · the strip caption is the tab name itself — no second copy', () => {
  const code = codeOnly(RAIL_SRC);
  assert.match(code, /<span className="fd-icon-caption">\{label\}<\/span>/, 'the 72px caption is not the label');
  assert.doesNotMatch(code, /STRIP_CAPTION/, 'a separate caption map is back — the copy that drifted on 2026-08-25');
});

test('2 · every tab name is one word, so the strip never shortens it', () => {
  const long = ADMIN_TABS.filter((t) => /\s/.test(t.label)).map((t) => t.label);
  assert.deepEqual(long, []);
});

test('3 · the phone bar and the rail draw the same five names in the same order', () => {
  assert.deepEqual(
    ADMIN_BOTTOM_NAV_ITEMS.map((i) => i.label),
    ADMIN_TABS.map((t) => t.label),
  );
});

test('4 · every bottom-nav registry slot names a tab that exists', () => {
  const tabKeys = new Set(ADMIN_BOTTOM_NAV_ITEMS.map((i) => i.key));
  const orphans = NAV_SLOT_DEFAULTS.filter(
    (s) =>
      s.key.startsWith('admin.bottom-nav.') &&
      !tabKeys.has(s.key.slice('admin.bottom-nav.'.length)),
  ).map((s) => `${s.key} ("${s.label}")`);

  assert.deepEqual(
    orphans,
    [],
    'the bottom nav looks a slot up as `admin.bottom-nav.<tab key>`, so a ' +
      'slot for a retired tab is never read — but /admin/menus still offers ' +
      'it as a renameable row, i.e. a control for a tab nobody can see.',
  );
});

test('5 · a bottom-nav slot may not disagree with the tab it overlays', () => {
  const byKey = new Map(ADMIN_BOTTOM_NAV_ITEMS.map((i) => [i.key, i.label]));
  const conflicts = NAV_SLOT_DEFAULTS.filter((s) =>
    s.key.startsWith('admin.bottom-nav.'),
  )
    .map((s) => ({ s, code: byKey.get(s.key.slice('admin.bottom-nav.'.length)) }))
    .filter(({ s, code }) => code !== undefined && code !== s.label)
    .map(({ s, code }) => `${s.key}: registry "${s.label}" overrides code "${code}"`);

  assert.deepEqual(
    conflicts,
    [],
    'THE REGISTRY WINS ON EVERY PHONE. `admin-bottom-nav.tsx` overlays the ' +
      'slot label on top of its own, so a stale default here silently ' +
      'out-ranks a correct rename in code and the tab keeps its old name. ' +
      'This is not an admin rename — those live in nav_slot_override; this ' +
      'is the shipped DEFAULT, and it must agree with the code it replaces.',
  );
});

/* ───────────────────────────────────────────────────────────────────────────
 * 2026-08-26 — THE SECOND HALF OF THE SAME BUG.
 *
 * Fixing the rail and the phone made the owner say *"do it"* about the pages,
 * and measuring those turned up the same shape twice more:
 *
 *   · the SIDEBAR overlays registry labels onto items exactly as the bottom nav
 *     does — 62 slots, and one ("Real Stories" in code, "Stories" in the
 *     registry) had been silently drifting, the registry winning;
 *   · five page titles still named a menu that no longer exists, and one of
 *     them — "Money & Settings" — had become plainly FALSE, because the recut
 *     moved every settings surface out of Money and into Set up.
 *
 * ⚠ AND RENAMING A MENU ITEM SILENTLY DELETES ITS OLD NAME FROM THE SEARCH BOX.
 * A menu item's searchable words are label + group label + description + alias.
 * The route is NOT among them. So "app performance", typed for months, would
 * have returned nothing with no clue why. Rule 8 is what keeps that honest.
 * ─────────────────────────────────────────────────────────────────────────── */

test('6 · a sidebar registry slot may not disagree with the item it overlays', () => {
  const byKey = new Map<string, string>();
  for (const g of ADMIN_NAV_GROUPS) for (const it of g.items) byKey.set(it.key, it.label);

  const conflicts = NAV_SLOT_DEFAULTS.filter((s) => s.key.startsWith('admin.sidebar.'))
    .map((s) => ({ s, code: byKey.get(s.key.slice('admin.sidebar.'.length)) }))
    .filter(({ s, code }) => code !== undefined && code !== s.label)
    .map(({ s, code }) => `${s.key}: registry "${s.label}" overrides code "${code}"`);

  assert.deepEqual(
    conflicts,
    [],
    'the desktop sidebar overlays the slot label on top of the item label, so a ' +
      'stale default here silently out-ranks a correct rename — the same ' +
      'mechanism that made the whole menu recut invisible. Fix the registry.',
  );
});

/** Names the six menus carried BEFORE the 2026-08-25 recut. This is a CLOSED
 *  historical record, not a list anybody has to keep feeding: these words were
 *  retired on one day and nothing can retire more of them. A page still calling
 *  itself one of these is naming a menu that does not exist. */
const RETIRED_MENU_NAMES = [
  'Overview HQ',
  'Money & Settings',
  'Accounts · Admin',
  'Menu · Admin',
  'Ugat Console',
];

/** Every source file under app/admin, found by walking — never hand-listed, so
 *  a file added tomorrow is covered without anybody remembering. */
function adminSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) adminSourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

test('7 · no retired menu name survives anywhere a person can read it', () => {
  /*
    🪤 REV 1 OF THIS RULE WAS DECORATION EXACTLY WHERE IT MATTERED, and only a
    mutation said so. It walked `page.tsx` files and matched `title:`, so it
    caught five browser-tab titles and was BLIND to the single genuinely
    VISIBLE offender: "Ugat Console", rendered 391x23px as the entity map's own
    heading — from a `_components` file, as JSX text rather than a title.
    Putting that string back left the whole suite GREEN. The rule now walks
    every admin source and matches the name anywhere in code.

    The banned names are all DISTINCTIVE multi-word strings. The bare words
    "Overview" and "Accounts" are NOT banned and must not be — "Overview" is a
    live tab name on two hubs, and a guard that cries wolf teaches you to skim
    past the one time it is right.
  */
  const files = adminSourceFiles(join(__dirname, '..'));
  assert.ok(files.length > 100, `walked only ${files.length} admin sources — the walk is wrong`);

  const offenders: string[] = [];
  for (const file of files) {
    const src = codeOnly(readFileSync(file, 'utf8'));
    for (const name of RETIRED_MENU_NAMES) {
      if (src.includes(name)) offenders.push(`${file.split('/app/admin/')[1]} still says "${name}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a page naming a retired menu sends the reader looking for a menu that is ' +
      'not there — and "Money & Settings" is worse than mismatched, it is FALSE: ' +
      'the recut moved every settings surface out of Money into Set up.',
  );
});

test('8 · a renamed menu item keeps its old name findable', () => {
  // The search box indexes label + group + description + alias, NOT the route.
  // These two items were renamed to match their menus; without the alias their
  // old names stop resolving and the box answers a confident nothing.
  const RENAMED: { key: string; oldName: string }[] = [
    { key: 'overview', oldName: 'overview' },
    { key: 'app-performance', oldName: 'app performance' },
  ];
  const lost = RENAMED.filter(
    ({ key, oldName }) => !(ADMIN_NAV_ALIASES[key] ?? '').toLowerCase().includes(oldName),
  ).map(({ key, oldName }) => `${key}: "${oldName}" is no longer searchable`);

  assert.deepEqual(
    lost,
    [],
    'renaming deleted a word people have been typing for months, and a search ' +
      'that finds nothing looks identical to a page that does not exist.',
  );
});
