/**
 * blog-and-download-wear-the-shell.test.ts — /blog and /download wear the ONE
 * shared shell, and draw no second chrome on top of it.
 *
 * Owner, 2026-11-12, of www.setnayan.com/blog and /download: *"these are on old
 * shells"*. Both page files sat outside `app/(shell)/` and were listed in
 * SiteChrome's NAV_ROUTES, so they wore the older glass nav + reskin footer —
 * a press from /pricing to /download swapped the whole header.
 *
 * The property is where each page file lives (a route group is invisible in the
 * URL and present on disk), plus the ways a second chrome could come back: the
 * route re-entering NAV_ROUTES, a page importing a header, a second page file
 * outside the group, or a per-page ISR directive under the session-reading shell.
 *
 * /blog/[slug] is deliberately NOT moved: it keeps its own reading masthead and
 * matches FOOTER_ONLY_PREFIXES. Its folder stays at app/blog/[slug]/.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname; // app/(shell)
const APP = join(HERE, '..');
const read = (p: string) => readFileSync(p, 'utf8');
const ROUTES = ['blog', 'download'] as const;

test('both pages live in app/(shell)/ and nothing serves them from outside it', () => {
  for (const r of ROUTES) {
    assert.ok(existsSync(join(HERE, r, 'page.tsx')), `app/(shell)/${r}/page.tsx is missing`);
    assert.ok(existsSync(join(HERE, r, 'loading.tsx')), `app/(shell)/${r}/loading.tsx is missing`);
    for (const f of ['page.tsx', 'loading.tsx', 'layout.tsx', 'template.tsx']) {
      assert.ok(
        !existsSync(join(APP, r, f)),
        `app/${r}/${f} exists — it would serve or wrap /${r} outside the shell`,
      );
    }
  }
  assert.ok(
    existsSync(join(APP, 'blog', '[slug]', 'page.tsx')),
    'anti-vacuity: /blog/[slug] should still live at app/blog/[slug]/',
  );
});

test('neither is a NAV_ROUTE, so the glass nav never stacks on the shell', () => {
  const src = stripComments(read(join(APP, '_components', 'marketing', 'site-chrome.tsx')));
  const block = /const NAV_ROUTES = new Set<string>\(\[([\s\S]*?)\]\)/.exec(src);
  assert.ok(block, 'NAV_ROUTES not found in site-chrome.tsx — this check would pass vacuously.');
  const routes = [...(block[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
  assert.ok(routes.includes('/waitlist'), `NAV_ROUTES parse is broken. Got: ${routes.join(', ')}`);
  for (const r of ROUTES) {
    assert.ok(
      !routes.includes(`/${r}`),
      `/${r} is a NAV_ROUTE again — SiteChrome would draw its glass nav on top of the shell's bar.`,
    );
  }
});

test('no page mounts a chrome of its own or re-declares a route directive', () => {
  const SECOND_CHROME =
    /from '@\/app\/_components\/(?:marketing\/(?:site-nav|site-chrome|site-footer-chrome|reskin-footer)|frontdoor\/app-rail-shell)'|<(?:AppRailShell|SiteChrome|SiteFooterChrome|ReskinFooter)\b/;
  for (const r of ROUTES) {
    const src = stripComments(read(join(HERE, r, 'page.tsx')));
    assert.doesNotMatch(src, SECOND_CHROME, `app/(shell)/${r}/page.tsx mounts a second chrome`);
    assert.doesNotMatch(
      src,
      /^export const (dynamic|revalidate)\b/m,
      `app/(shell)/${r}/page.tsx re-declares a route directive — app/(shell)/layout.tsx owns it`,
    );
  }
});

test('both run full-bleed, since each caps its own sections', () => {
  const src = read(join(APP, '_components', 'frontdoor', 'shell-bleed.ts'));
  const m = /DOORWAY_BLEED_PATHS = \[([^\]]*)\]/.exec(src);
  assert.ok(m, 'DOORWAY_BLEED_PATHS not found — this check would pass vacuously.');
  for (const r of ROUTES) {
    assert.ok((m[1] ?? '').includes(`'/${r}'`), `/${r} is not in DOORWAY_BLEED_PATHS`);
  }
});
