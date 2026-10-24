import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeTabIndex, tabSlideDir, type SlideTab } from '@/lib/nav-slide';

/**
 * ONE TAB SLIDE ON EVERY DASHBOARD.
 *
 * Owner, 24 Oct 2026: *"The transition animation between menus found in event
 * dashboard does not apply to the user and shop dashboard."*
 *
 * There was always ONE slide — `NavSlideController` in the root layout, one
 * set of keyframes in globals.css — and all three bars are the same
 * `<BottomNav>`. Two things kept it off the other two dashboards, and neither
 * threw or logged anything:
 *
 *   · THE ACCOUNT (Events · Discover · Memories · People): its content carried
 *     no `view-transition-name`, so the controller started a transition that
 *     animated NOTHING — the page swapped under a frozen screen.
 *   · THE SHOP (Today · Customers · Shop · Hub): the controller found the lit
 *     tab by address alone, but the shop's tabs are lit by `activeMatch` lists
 *     of OTHER addresses (`/bookings`, `/messages`, `/verify`, `/team` …). On
 *     every such page it found no lit tab, which is a deliberate no-slide.
 *
 * What this pins, each of which would revert silently:
 *   1 · the direction rule reads the bar's own lit tab (behaviour, below);
 *   2 · the controller asks THAT rule, and nothing else in the app starts a
 *       view transition of its own — one implementation, not one per dashboard;
 *   3 · every dashboard shell hands the slide exactly one content element
 *       (`.sn-vt-page`), and every one of their bars is the shared `<BottomNav>`;
 *   4 · the account's content is named only WHILE a slide runs, and both
 *       listeners raise the flag that names it BEFORE the transition starts;
 *   5 · one name, one timing: `sn-page` is declared once, and its keyframes run
 *       320 ms on one easing for every dashboard.
 */

const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, '..', '..', '..');
const read = (...p: string[]) => readFileSync(join(WEB, ...p), 'utf8');
/** Source with comments removed — a docblock that mentions a symbol must not satisfy a guard. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const CSS = read('app', 'globals.css');

/* ── 1 · behaviour ─────────────────────────────────────────────────────── */

const SHOP = ['/vendor-dashboard', '/vendor-dashboard/customers', '/vendor-dashboard/shop', '/vendor-dashboard/on-the-day'];
const ACCOUNT = ['/dashboard', '/', '/dashboard/library', '/dashboard/people', '/vendor-dashboard'];
const bar = (paths: string[], lit: number): SlideTab[] => paths.map((path, i) => ({ path, current: i === lit }));

test('1 · a shop page lit through activeMatch slides — the bar names its own lit tab', () => {
  // On /vendor-dashboard/bookings the bar lights Customers (its activeMatch list).
  const lit = bar(SHOP, 1);
  assert.equal(activeTabIndex(lit, '/vendor-dashboard/bookings'), 1);
  assert.equal(tabSlideDir(2, activeTabIndex(lit, '/vendor-dashboard/bookings')), 'fwd', 'Customers → Shop leaves to the left');
  assert.equal(tabSlideDir(0, activeTabIndex(lit, '/vendor-dashboard/bookings')), 'back', 'Customers → Today leaves to the right');
  // THE DEFECT, as it was: by address alone that page has no lit tab, so no slide.
  assert.equal(activeTabIndex(bar(SHOP, -1), '/vendor-dashboard/bookings'), -1);
  assert.equal(tabSlideDir(2, -1), null);
});

test('1 · the account bar slides by its order, one slide however far the press', () => {
  const lit = bar(ACCOUNT, 3); // People
  assert.equal(tabSlideDir(0, activeTabIndex(lit, '/dashboard/people')), 'back', 'People → Events');
  assert.equal(tabSlideDir(4, activeTabIndex(lit, '/dashboard/people')), 'fwd', 'People → Shop');
  assert.equal(tabSlideDir(3, 3), null, 'the lit tab itself is not a slide');
  // The address fallback still works for a bar that lights nothing: Discover is `/`, exact.
  assert.equal(activeTabIndex(bar(ACCOUNT, -1), '/'), 1);
  assert.equal(activeTabIndex(bar(ACCOUNT, -1), '/dashboard/library'), 2);
  // A dashboard's home is exact, never a prefix of its own pages.
  assert.equal(activeTabIndex(bar(SHOP, -1), '/vendor-dashboard/shop'), 2);
});

/* ── 2 · one implementation ────────────────────────────────────────────── */

test('2 · the controller asks the one direction rule, and reads the bar\'s lit tab', () => {
  const src = code(read('app', '_components', 'nav', 'nav-slide-controller.tsx'));
  assert.match(src, /import \{[^}]*\bactiveTabIndex\b[^}]*\btabSlideDir\b[^}]*\} from '@\/lib\/nav-slide'/);
  assert.match(src, /getAttribute\('aria-current'\)\s*===\s*'page'/, 'the lit tab is no longer read from the bar');
  assert.doesNotMatch(src, /function resolveActiveIndex/, 'a second, private copy of the direction rule came back');
});

test('2 · nothing else in the app starts a view transition of its own', () => {
  const ALLOWED = new Set(['app/_components/nav/nav-slide-controller.tsx', 'app/_components/nav/bar-set-slide.tsx']);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        if (/\bstartViewTransition!?\s*\(/.test(code(readFileSync(p, 'utf8')))) found.push(relative(WEB, p));
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.ok(found.includes('app/_components/nav/nav-slide-controller.tsx'), `the scan found no controller at all: ${found.join(', ')}`);
  assert.deepEqual(
    found.filter((f) => !ALLOWED.has(f)),
    [],
    'A file outside the two bar listeners starts its own view transition. A dashboard with its own slide is ' +
      'exactly how the three drifted apart — extend NavSlideController / lib/nav-slide.ts instead.',
  );
});

/* ── 3 · every dashboard shell hands over one content element ──────────── */

const SHELLS: { name: string; file: string[]; whileSliding: boolean }[] = [
  { name: 'event', file: ['app', 'dashboard', '[eventId]', 'layout.tsx'], whileSliding: false },
  { name: 'shop', file: ['app', 'vendor-dashboard', 'layout.tsx'], whileSliding: false },
  { name: 'account · Events', file: ['app', 'dashboard', '(launcher)', 'layout.tsx'], whileSliding: true },
  { name: 'account · spokes', file: ['app', 'dashboard', '(account)', 'layout.tsx'], whileSliding: true },
  { name: 'account · Discover', file: ['app', '_components', 'frontdoor', 'front-door.tsx'], whileSliding: true },
];

test('3 · every dashboard shell carries exactly one .sn-vt-page', () => {
  for (const s of SHELLS) {
    const n = (code(read(...s.file)).match(/\bsn-vt-page\b/g) ?? []).length;
    assert.equal(n, 1, `${s.name} (${s.file.join('/')}) carries ${n} .sn-vt-page — zero is a tab press that animates nothing; two make the browser skip the slide`);
  }
});

test('3 · every dashboard\'s bar is the one shared <BottomNav>', () => {
  for (const f of [
    ['app', 'dashboard', '[eventId]', '_components', 'customer-bottom-nav.tsx'],
    ['app', 'vendor-dashboard', '_components', 'vendor-bottom-nav.tsx'],
    ['app', 'dashboard', '(launcher)', '_components', 'account-bottom-nav.tsx'],
  ]) {
    const src = code(read(...f));
    assert.match(src, /import \{[^}]*\bBottomNav\b[^}]*\} from '@\/app\/_components\/nav\/bottom-nav'/, `${f.join('/')} no longer draws the shared bar`);
    assert.match(src, /<BottomNav\b/, `${f.join('/')} imports the shared bar but does not render it`);
  }
});

/* ── 4 · the account's content is named only while it slides ───────────── */

test('4 · the account trees opt in with while-sliding; the event and shop keep their name at rest', () => {
  for (const s of SHELLS) {
    const marked = /data-sn-slide="while-sliding"/.test(code(read(...s.file)));
    assert.equal(marked, s.whileSliding, `${s.name}: data-sn-slide="while-sliding" ${s.whileSliding ? 'missing' : 'added'}`);
  }
  assert.match(
    CSS,
    /html:not\(\[data-sn-nav-dir\]\) \.sn-vt-page\[data-sn-slide='while-sliding'\]\s*\{\s*view-transition-name:\s*none;\s*\}/,
    'the account content is named at REST — a stacking context and a containing block for its fixed sheets it never had',
  );
  assert.match(
    CSS,
    /html\[data-sn-bar-dir\] \.sn-vt-page\[data-sn-slide='while-sliding'\]\s*\{\s*view-transition-name:\s*sn-acct-page;\s*\}/,
    'a set change (account ↔ shop ↔ event) no longer gives the account content its own name',
  );
});

test('4 · both listeners raise the flag BEFORE the transition starts (or the old snapshot is unnamed)', () => {
  for (const f of ['nav-slide-controller.tsx', 'bar-set-slide.tsx']) {
    const src = code(read('app', '_components', 'nav', f));
    const flag = src.search(/\.dataset\.snNavDir\s*=/);
    const start = src.search(/startViewTransition!?\(/);
    assert.ok(flag >= 0 && start >= 0, `${f}: flag or transition not found`);
    assert.ok(flag < start, `${f}: data-sn-nav-dir is set after startViewTransition — the leaving page is captured without a name`);
  }
  // Reduced motion: no slide at all — checked before anything is prevented.
  const ctl = code(read('app', '_components', 'nav', 'nav-slide-controller.tsx'));
  assert.ok(ctl.search(/\breduced\b[^;]*\)\s*return/) < ctl.search(/e\.preventDefault\(\)/), 'reduced motion is no longer gated before the slide');
});

/* ── 5 · one name, one timing ──────────────────────────────────────────── */

test('5 · sn-page is declared once, on .sn-vt-page, and runs 320 ms on one easing', () => {
  const decl = [...CSS.matchAll(/([^{}]*)\{[^}]*view-transition-name\s*:\s*sn-page\s*;[^}]*\}/g)].map((m) => m[1]!.trim().split('\n').pop()!.trim());
  assert.deepEqual(decl, ['.sn-vt-page']);
  const timing = /::view-transition-old\(sn-page\),\s*::view-transition-new\(sn-page\)\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.match(timing, /animation-duration:\s*320ms/);
  assert.match(timing, /animation-timing-function:\s*cubic-bezier\(0\.22, 0\.61, 0\.36, 1\)/);
});
