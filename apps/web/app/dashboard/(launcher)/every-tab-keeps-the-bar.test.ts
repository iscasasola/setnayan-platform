/**
 * every-tab-keeps-the-bar.test.ts — every tab of the account bar lands on a page
 * that draws a bar, exactly one, for a signed-in viewer.
 *
 * Owner, 22 Oct 2026, over the signed-in Events board: *"Discover needs to show
 * the bottom nav still."* The account bar (#6753) was mounted by the two
 * `/dashboard` layouts, and its Discover tab is `/` — outside both — so the one
 * tab that left them took the bar away. Then: *"bottom nav should not disappear
 * when going to a different menu."*
 *
 * 🔑 A PROPERTY, NOT A LIST OF FILES. For every tab the REAL bar draws (all five,
 * from `accountBarItems`), the tab's address is resolved through `app/` the way
 * the router resolves it — literal folders, route groups, dynamic segments — to
 * its page and every layout above it. From those files the server components
 * they render are followed (a client component is a leaf: it is the bar, or it
 * draws one). Along that tree the bar mounts are counted:
 *   · Events · Discover · Memories · People → exactly ONE `<AccountBarSlot>`;
 *   · Shop → the shop's own bar, exactly one, and no account bar beside it.
 * A tab whose landing draws none fails, and so does one that draws two (two docks
 * share one view-transition name, and the browser then skips every slide).
 *
 * And Discover's bar is the SIGNED-IN viewer's only: signed out, `/` is the
 * public front door as it always was.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { accountBarItems } from './_components/account-bottom-nav';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const APP = join(WEB, 'app');
const src = (abs: string) => stripComments(readFileSync(abs, 'utf8'));

/** The folders a URL path resolves through, root first, ending at the page's folder. */
function routeDirs(urlPath: string): string[] | null {
  const segs = urlPath.split('?')[0]!.split('/').filter(Boolean);
  const walk = (dir: string, rest: string[]): string[] | null => {
    const kids = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    if (rest.length === 0) {
      if (existsSync(join(dir, 'page.tsx'))) return [dir];
    } else {
      const lit = kids.find((e) => e.name === rest[0]);
      if (lit) {
        const r = walk(join(dir, lit.name), rest.slice(1));
        if (r) return [dir, ...r];
      }
    }
    for (const g of kids.filter((e) => /^\(.+\)$/.test(e.name))) {
      const r = walk(join(dir, g.name), rest);
      if (r) return [dir, ...r];
    }
    if (rest.length > 0)
      for (const d of kids.filter((e) => /^\[[^.\]]+\]$/.test(e.name))) {
        const r = walk(join(dir, d.name), rest.slice(1));
        if (r) return [dir, ...r];
      }
    return null;
  };
  return walk(APP, segs);
}

/** The page + every layout above it — the files the router renders for that address. */
function routeFiles(urlPath: string): string[] {
  const dirs = routeDirs(urlPath);
  assert.ok(dirs, `${urlPath} resolves to no page in app/ — the tab is a dead door`);
  const files = dirs.map((d) => join(d, 'layout.tsx')).filter((f) => existsSync(f));
  files.push(join(dirs[dirs.length - 1]!, 'page.tsx'));
  return files;
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx')])
    if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

const BARS = ['AccountBarSlot', 'VendorBottomNav', 'CustomerBottomNav', 'AdminBottomNav'] as const;
type Count = Record<(typeof BARS)[number], number>;

/** Count bar mounts over the server-component tree those files render. */
function barMounts(entry: string[]): Count {
  const count = Object.fromEntries(BARS.map((b) => [b, 0])) as Count;
  const seen = new Set<string>();
  const visit = (file: string, depth: number) => {
    if (seen.has(file) || depth > 5) return;
    seen.add(file);
    const code = src(file);
    for (const b of BARS) count[b] += (code.match(new RegExp(`<${b}\\b`, 'g')) ?? []).length;
    const imports = new Map<string, string>();
    for (const m of code.matchAll(/import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*'([^']+)'/g)) {
      const names = [m[1], ...(m[2] ?? '').split(',').map((n) => n.trim().split(/\s+as\s+/).pop())].filter(Boolean);
      for (const n of names) imports.set(n!, m[3]!);
    }
    for (const tag of new Set([...code.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]!))) {
      if ((BARS as readonly string[]).includes(tag)) continue;
      const spec = imports.get(tag);
      const next = spec ? resolveImport(file, spec) : null;
      // A client component is a leaf: it is drawn on the phone as it is.
      if (next && !/^\s*['"]use client['"]/.test(readFileSync(next, 'utf8'))) visit(next, depth + 1);
    }
  };
  for (const f of entry) visit(f, 0);
  return count;
}

const TABS = accountBarItems(['events', 'discover', 'memories', 'people', 'shop']);

test('the sweep reads the real bar: five tabs, five addresses', () => {
  assert.deepEqual(
    TABS.map((t) => t.key),
    ['events', 'discover', 'memories', 'people', 'shop'],
  );
});

for (const tab of TABS) {
  test(`📱 ${tab.label} (${tab.href}) lands on a page that draws exactly one bar`, () => {
    const c = barMounts(routeFiles(tab.href));
    const total = BARS.reduce((n, b) => n + c[b], 0);
    if (tab.key === 'shop') {
      assert.equal(c.VendorBottomNav, 1, `the shop draws ${c.VendorBottomNav} shop bars`);
      assert.equal(total, 1, `the shop draws ${total} bars in all: ${JSON.stringify(c)}`);
    } else {
      assert.equal(c.AccountBarSlot, 1, `${tab.label} draws ${c.AccountBarSlot} account bars — the bar disappears on this tab`);
      assert.equal(total, 1, `${tab.label} draws ${total} bars in all: ${JSON.stringify(c)}`);
    }
  });
}

test('🔒 Discover draws the bar for a signed-in viewer only — signed out, the front door is unchanged', () => {
  const fd = src(join(APP, '_components/frontdoor/front-door.tsx'));
  assert.match(fd, /\{account\.signedIn \? <FrontDoorAccountBar \/> : null\}/);
  assert.equal((fd.match(/<FrontDoorAccountBar\b/g) ?? []).length, 1);
  const bar = src(join(APP, '_components/frontdoor/front-door-account-bar.tsx'));
  assert.match(bar, /const user = await getCurrentUser\(\);\s*if \(!user\) return null;/);
  // The same tab rule the layouts use — Shop for an owner, Discover where `/` opens.
  assert.match(
    bar,
    /<AccountBarSlot tabs=\{accountBarTabs\(\{ ownsShop: ownsAShop\(switcherData\.context\), discoverOpen \}\)\} \/>/,
  );
  assert.match(bar, /discoverOpensHere\(\)/);
  // OUTSIDE the shell's <main>: the dock is fixed, and the page takes a
  // view-transition name during a set-change slide.
  const shellClose = fd.indexOf('</FrontDoorShell>');
  assert.ok(shellClose > 0 && fd.indexOf('<FrontDoorAccountBar') > shellClose, 'the bar is rendered inside the shell');
});
