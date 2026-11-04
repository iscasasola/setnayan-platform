/**
 * for-suppliers-wears-the-shell.test.ts — /for-suppliers wears the ONE shared
 * shell, and draws no second chrome on top of it.
 *
 * Owner, 2026-11-04, looking at www.setnayan.com/for-suppliers on his phone:
 * *"the page is on the wrong shell"*. Every other public page (/, /explore,
 * /pricing, /papic …) renders inside `app/(shell)/layout.tsx` — the front-door
 * bar + rail, mounted once so navigation never reloads it. /for-suppliers sat
 * OUTSIDE the group and wore the older SiteChrome glass nav + reskin footer, so
 * one press from /pricing to the supplier plans swapped the whole header.
 *
 * 🔑 THE PROPERTY IS WHERE THE PAGE FILE LIVES (a route group is invisible in
 * the URL and present on disk), plus three ways a second chrome could come
 * back: the route re-entering `NAV_ROUTES` (SiteChrome draws its fixed glass
 * nav on top of the shell's bar), a page or section importing a header, or a
 * second `app/for-suppliers/page.tsx` shadowing the shelled one.
 *
 * SABOTAGE (run 2026-11-04, see the PR): put '/for-suppliers' back in
 * NAV_ROUTES → RED; move page.tsx back to app/for-suppliers/ → RED; import
 * SiteChrome into vendor-grow-hero.tsx → RED; drop it from
 * DOORWAY_BLEED_PATHS → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname; // app/(shell)/for-suppliers
const APP = join(HERE, '..', '..');
const SECTIONS = join(APP, 'for-suppliers'); // the page's sections stay here
const read = (p: string) => readFileSync(p, 'utf8');

test('the page lives in app/(shell)/ and nothing serves /for-suppliers from outside it', () => {
  assert.ok(existsSync(join(HERE, 'page.tsx')), 'app/(shell)/for-suppliers/page.tsx is missing');
  assert.ok(
    !existsSync(join(SECTIONS, 'page.tsx')),
    'app/for-suppliers/page.tsx exists again — two pages for one URL, and the one outside the ' +
      'group wears no shell (Next refuses the build, or the wrong one wins).',
  );
  // No loading.tsx / layout.tsx / template.tsx left behind outside the group to wrap it.
  for (const f of ['loading.tsx', 'layout.tsx', 'template.tsx']) {
    assert.ok(!existsSync(join(SECTIONS, f)), `app/for-suppliers/${f} would wrap the route outside the shell`);
  }
});

test('/for-suppliers is not a NAV_ROUTE, so the glass nav never stacks on the shell', () => {
  const src = stripComments(read(join(APP, '_components', 'marketing', 'site-chrome.tsx')));
  const block = /const NAV_ROUTES = new Set<string>\(\[([\s\S]*?)\]\)/.exec(src);
  assert.ok(block, 'NAV_ROUTES not found in site-chrome.tsx — this check would pass vacuously.');
  const routes = [...(block[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
  assert.ok(
    routes.includes('/download'),
    `NAV_ROUTES parsed without /download (a stable member) — the parser is wrong. Got: ${routes.join(', ')}`,
  );
  assert.ok(
    !routes.includes('/for-suppliers'),
    '/for-suppliers is a NAV_ROUTE again. It is also under the shared shell, so SiteChrome would draw ' +
      'its fixed glass nav ON TOP of the front-door bar — two headers, two Sign-ins — and the reskin ' +
      'footer under the page.',
  );
});

test('nothing on the page mounts a chrome of its own', () => {
  const files: string[] = [join(HERE, 'page.tsx')];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.tsx')) files.push(full);
    }
  };
  walk(join(SECTIONS, '_components'));
  assert.ok(
    files.some((f) => f.endsWith('vendor-grow-sections.tsx')),
    'anti-vacuity: the sections were not walked',
  );

  const SECOND_CHROME =
    /from '@\/app\/_components\/(?:marketing\/(?:site-nav|site-chrome|site-footer-chrome|reskin-footer)|frontdoor\/app-rail-shell)'|<(?:AppRailShell|SiteChrome|SiteFooterChrome|ReskinFooter)\b/;
  const offenders = files.filter((f) => SECOND_CHROME.test(stripComments(read(f))));
  assert.deepEqual(
    offenders.map((f) => relative(APP, f)),
    [],
    'A /for-suppliers file imports or mounts a chrome (the glass nav, a footer, or the shell itself). ' +
      'The (shell) layout already mounts the one bar and rail; a second is a second header.',
  );

  // The group layout owns `force-dynamic`; a page copy is a second place for the rule to disagree.
  assert.doesNotMatch(
    stripComments(read(join(HERE, 'page.tsx'))),
    /^export const (dynamic|revalidate)\b/m,
    'the page re-declares a route directive — app/(shell)/layout.tsx owns it',
  );
});

test('it runs full-bleed, so the photo hero and dark bands still reach the edges', () => {
  const src = read(join(APP, '_components', 'frontdoor', 'shell-bleed.ts'));
  const m = /DOORWAY_BLEED_PATHS = \[([^\]]*)\]/.exec(src);
  assert.ok(m, 'DOORWAY_BLEED_PATHS not found — this check would pass vacuously.');
  assert.ok(
    (m[1] ?? '').includes("'/for-suppliers'"),
    "/for-suppliers is not in DOORWAY_BLEED_PATHS: the shell's 16–24 px gutters would inset the " +
      'full-bleed photo hero and every dark band on the page.',
  );
});
