import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * the-bottom-bar-stays.test.ts
 *
 * 🚨 THE THUMB BAR VANISHED THE MOMENT YOU USED IT. `HomePillNav` was rendered
 * in exactly ONE place — `(launcher)/page.tsx`, i.e. the single route
 * `/dashboard` — while three of its four targets live in the `(account)` group.
 * Pressing People, Memories or Create landed you on a screen with no bottom bar.
 *
 * 🪤 AND THE DEAD DOORWAYS THAT LOOKED ALIVE. Four components in that same file
 * had ZERO call sites app-wide, and a naive `grep -rn '<OpenShopRow' app`
 * returns ONE hit — inside a guard's own regex. The guard's assertion contains
 * the component name it is looking for.
 *
 * 🛡 Every assertion mutation-checked BY OCCURRENCE COUNT; comments stripped
 * before matching, because the fixes quote what they removed.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '../../..');
const code = (p: string) =>
  readFileSync(join(WEB, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const LAUNCHER_LAYOUT = 'app/dashboard/(launcher)/layout.tsx';
const ACCOUNT_LAYOUT = 'app/dashboard/(account)/layout.tsx';
const LAUNCHER_PAGE = 'app/dashboard/(launcher)/page.tsx';
const PILL = 'app/dashboard/(launcher)/_components/home-pill-nav.tsx';

test('the bar is chrome — both layouts that cover its targets render it', () => {
  assert.match(code(LAUNCHER_LAYOUT), /<HomePillNav/, '/dashboard itself');
  assert.match(code(ACCOUNT_LAYOUT), /<HomePillNav/, 'People · Memories · Create all live here');
});

test('and no page renders it — a page-level nav bar exists on one route only', () => {
  assert.ok(
    !/<HomePillNav/.test(code(LAUNCHER_PAGE)),
    'rendered by the page it disappeared the moment anyone used it',
  );
});

test('the account spokes reserve room for it, so nothing hides under it', () => {
  assert.match(code(ACCOUNT_LAYOUT), /<main className="pb-28 sm:pb-0">/);
});

test('it is NOT pushed into the shared rail, which the event trees also use', () => {
  // Those trees carry their own phone bottom nav; a second bar under the first
  // is a worse bug than the missing one.
  assert.ok(
    !/HomePillNav/.test(code('app/_components/frontdoor/app-rail-shell.tsx')),
    'the shared shell must stay free of it',
  );
});

test('the current page is read, not assumed', () => {
  const pill = code(PILL);
  assert.match(pill, /'use client'/, 'it needs the pathname');
  assert.match(pill, /usePathname\(\)/);
  assert.ok(
    !/aria-current="page"/.test(pill),
    'a hardcoded current page was true on one route and a lie on every other',
  );
  assert.match(pill, /pathname === href \|\| pathname\.startsWith/, 'spokes match their subtree');
  assert.match(pill, /exact \? pathname === href/, 'and Home is exact, or it lights everywhere');
});

test('the four unmounted Spaces components are gone, and stay gone', () => {
  /*
    Counted across the WHOLE app with test files excluded — the exclusion is the
    point. `open-shop/has-a-doorway.test.ts` contains the string `OpenShopRow`
    inside its own explanation, so an app-wide grep that includes tests reports
    a component as rendered by the guard that says it is not.
  */
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(rel);
    }
  };
  walk('app');
  walk('lib');
  assert.ok(files.length > 500, `the sweep must actually sweep — saw ${files.length} files`);
  for (const name of ['SpaceRow', 'CreateSamahanRow', 'OpenShopRow', 'BecomeStorytellerRow']) {
    const hits = files.filter((f) => new RegExp(`<${name}\\b|function ${name}\\b`).test(code(f)));
    assert.deepEqual(hits, [], `${name} came back — it has no call site and never had one`);
  }
});

test('the doors those rows carried are still on the account switcher', () => {
  // Deleting a component is only safe if the destination survives elsewhere.
  const switcher = code('app/_components/account-switcher/account-switcher.tsx');
  assert.match(switcher, /href="\/open-shop"/);
  assert.match(switcher, /href="\/dashboard\/creator"/);
});

test('the FAB action is settled, not "provisional"', () => {
  const raw = readFileSync(join(WEB, 'app/dashboard/[eventId]/_components/customer-nav-fab.tsx'), 'utf8');
  assert.ok(
    !/PROVISIONAL \(owner to confirm\)/.test(raw),
    'a settled choice labelled provisional gets re-opened by the next reader',
  );
  assert.match(code('app/dashboard/[eventId]/_components/customer-nav-fab.tsx'), /label="Add guest"/);
});
