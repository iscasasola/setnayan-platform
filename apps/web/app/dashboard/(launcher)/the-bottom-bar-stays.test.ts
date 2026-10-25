import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * the-bottom-bar-stays.test.ts
 *
 * ⚓ 2026-10-21: the floating `HomePillNav` became `AccountBottomNav` — the
 * canonical <BottomNav> inside <BottomDock>, anchored like every other phone
 * bar (owner "yes to all", DECISION_LOG "THE ACCOUNT BAR"). Its tabs are held
 * by `the-account-bar-is-the-ruling.test.ts`; THIS file still holds where it
 * is mounted, which is the bug it was written for.
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
const BAR = 'app/dashboard/(launcher)/_components/account-bottom-nav.tsx';

test('the bar is chrome — both layouts that cover its targets render it', () => {
  assert.match(code(LAUNCHER_LAYOUT), /<AccountBarSlot\b/, '/dashboard itself');
  assert.match(code(ACCOUNT_LAYOUT), /<AccountBarSlot\b/, 'People · Memories · the account spokes all live here');
});

test('and no page renders it — a page-level nav bar exists on one route only', () => {
  assert.ok(
    !/<AccountBarSlot\b|<AccountBottomNav\b|<HomePillNav\b/.test(code(LAUNCHER_PAGE)),
    'rendered by the page it disappeared the moment anyone used it',
  );
});

test('both layouts reserve the dock\'s MEASURED height, to the dock\'s own line', () => {
  /* The bar is fixed, so the page must end above it. It reserves
     `--sn-bottomdock-h` (published by <BottomDock>) — never a flat number,
     which is how the event tree hid its last row on an iPhone — and stops at
     `lg`, where the dock is `lg:hidden` and the rail takes over. */
  for (const f of [LAUNCHER_LAYOUT, ACCOUNT_LAYOUT]) {
    assert.match(
      code(f),
      // `sn-vt-page` leads since 2026-10-24 — the bar's page slide moves this <main> (one-tab-slide-everywhere.test.ts).
      /<main\s+className="sn-vt-page pb-\[calc\(var\(--sn-bottomdock-h,[^"]*\] lg:pb-0"/,
      `${f}: <main> no longer reserves the dock's measured height up to lg`,
    );
  }
});

test('it is NOT pushed into the shared rail, which the event trees also use', () => {
  // Those trees carry their own phone bottom nav; a second bar under the first
  // is a worse bug than the missing one.
  assert.ok(
    !/HomePillNav|AccountBottomNav|AccountBarSlot/.test(code('app/_components/frontdoor/app-rail-shell.tsx')),
    'the shared shell must stay free of it',
  );
});

test('the current page is read, not assumed — by the canonical bar', () => {
  /* The pill read the pathname itself (it once hardcoded Home as current, true
     on one route and a lie on every other). The account bar delegates to
     <BottomNav>, whose matcher reads the pathname; this holds that it does
     delegate, inside the dock, and hardcodes no current page. */
  const bar = code(BAR);
  assert.match(bar, /'use client'/);
  assert.match(bar, /from '@\/app\/_components\/nav\/bottom-nav'/, 'it must delegate to the canonical bar');
  assert.match(bar, /<BottomDock>\s*<BottomNav items=\{accountBarItems\(tabs\)\} \/>\s*<\/BottomDock>/, 'mounted inside the dock');
  assert.ok(!/aria-current/.test(bar), 'a hardcoded current page was true on one route and a lie on every other');
  assert.ok(
    !existsSync(join(WEB, 'app/dashboard/(launcher)/_components/home-pill-nav.tsx')),
    'home-pill-nav.tsx is back — a hand-rolled floating bar beside the canonical one',
  );
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

test('the couple has no floating button over the bar (owner 2026-10-01)', () => {
  /* Owner, pointing at the round "Add guest" button in the live bar: "this will
     be gone, correct? we only have our simple bottom nav?". The component is
     deleted, not hidden, and the event layout mounts nothing beside the dock. */
  assert.ok(
    !existsSync(join(WEB, 'app/dashboard/[eventId]/_components/customer-nav-fab.tsx')),
    'customer-nav-fab.tsx is back — a round button floats over the couple\'s bar again',
  );
  const layout = code('app/dashboard/[eventId]/layout.tsx');
  assert.ok(!/<NavFab\b|NavFab\s/.test(layout), 'the event layout mounts a floating button again');
});
