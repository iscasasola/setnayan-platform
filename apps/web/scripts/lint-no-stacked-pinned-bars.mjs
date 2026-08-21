#!/usr/bin/env node
/**
 * lint-no-stacked-pinned-bars.mjs
 *
 * TWO PINNED BARS MUST NEVER STACK.
 *
 * Marketing pages wear a FLOATING glass nav (Prices / Download / Vendors /
 * Sign in) pinned to the viewport top. A page that ALSO pins something to the
 * viewport top — a section tab strip, a search bar — puts two bars in the same
 * place, and they overlap.
 *
 * `site-chrome.tsx` already solves this: `UNFIXED_ROUTES` makes the glass nav
 * render in-flow (scrolling away with the page) on routes that own the top.
 * The set existed and was correct. It was just incomplete.
 *
 * 🔴 WHAT IT MISSED (2026-08-06): `/features` and `/tl/features`. Both render
 * <FeaturesPageBody>, whose <AnchorNav> is `sticky top-0 z-30`. The glass nav
 * sat directly on top of the section tabs — "Vendors & budget" and "Outsourcing
 * & pacing" unreadable behind the nav pills, the page's own headline sliced in
 * half. On the PUBLIC marketing page whose job is to make the product look
 * finished.
 *
 * 🔑 WHY NOTHING CAUGHT IT. Both components are individually correct.
 * AnchorNav's own comment even says "Top margin allows for the sticky header +
 * this anchor nav (~120px combined)" — the author knew a pinned header sat
 * above and still pinned to top-0. Typecheck passes, tests pass, every lint
 * passes, both files review cleanly in isolation. The defect exists only in the
 * relationship between them, and only at render. **The owner found it by
 * looking at a phone.** This guard is the cheapest way to not need that again.
 *
 * WHAT IT CHECKS: for every route in NAV_ROUTES, if that route's page tree
 * contains a viewport-top pin (`sticky top-0` / `fixed top-0` / `fixed inset-x-0
 * top-0`), the route must appear in UNFIXED_ROUTES.
 *
 * ⚠ SCOPED TO NAV_ROUTES ONLY. Dashboard, admin and vendor surfaces have their
 * own shells and no glass nav — pinning there is correct and is not this
 * guard's business. Both sets are parsed from site-chrome.tsx itself, so the
 * guard cannot drift from the thing it guards (a guard comparing two hand-typed
 * lists is not a guard).
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CHROME = join(ROOT, 'app/_components/marketing/site-chrome.tsx');

/** Pull a `new Set<string>([...])` literal's members out of the source. */
function setMembers(src, name) {
  const m = src.match(new RegExp(`const ${name}\\s*=\\s*new Set<string>\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) return null;
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

const chrome = readFileSync(CHROME, 'utf8');
const navRoutes = setMembers(chrome, 'NAV_ROUTES');
const unfixed = setMembers(chrome, 'UNFIXED_ROUTES');

if (!navRoutes || !unfixed) {
  console.error(
    '✗ Could not parse NAV_ROUTES / UNFIXED_ROUTES from site-chrome.tsx.\n' +
      '  The declaration shape changed. Fix this parser rather than deleting the\n' +
      '  guard — a guard that silently inspects nothing passes for the wrong reason.',
  );
  process.exit(1);
}
if (navRoutes.size < 10) {
  console.error(`✗ Only ${navRoutes.size} NAV_ROUTES parsed — the parser is wrong.`);
  process.exit(1);
}

/** Does anything under this directory pin itself to the viewport top? */
const PIN = /(?:sticky|fixed)\s+(?:inset-x-0\s+)?top-0|top-0[^"']*\b(?:sticky|fixed)\b/;

function pinnedFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n === '.next') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.tsx') && PIN.test(readFileSync(p, 'utf8'))) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/**
 * Directories a route actually renders from — its own, plus any sibling route
 * whose body it imports.
 *
 * ⚠ WITHOUT THIS THE GUARD MISSES THE TAGLISH TWINS. `/tl/features` holds only
 * a 40-line page.tsx that imports `<FeaturesPageBody>` from `@/app/features`;
 * the pinned <AnchorNav> lives in the ENGLISH directory. So a directory-only
 * scan clears `/tl/features` while it renders the exact same overlapping bar —
 * caught when the fix was sabotage-tested and only `/features` came back.
 */
function renderDirs(route) {
  const own = join(ROOT, 'app', route.replace(/^\//, ''));
  const dirs = new Set();
  if (existsSync(own)) dirs.add(own);
  for (const d of [...dirs]) {
    for (const n of readdirSync(d)) {
      if (!/^page\.tsx$/.test(n)) continue;
      const src = readFileSync(join(d, n), 'utf8');
      for (const m of src.matchAll(/from '@\/app\/([A-Za-z0-9_\-/[\]]+)'/g)) {
        // '@/app/features/_PageBody' → the 'features' route directory.
        //
        // ⚠ ROUTE SEGMENTS ONLY. A first cut followed every `@/app/...` import,
        // which resolves `@/app/_components/...` to the SHARED components folder
        // — where demo-mode-banner-client, sidebar-shell, relationship-tab-shell
        // and site-chrome itself all legitimately pin to the top. That reported
        // 13 routes, all false, and would have taught its reader to skim past
        // the one time it was right. Next.js treats an underscore-prefixed
        // folder as private (never a route), so skipping those is exactly the
        // right line.
        const seg = m[1].split('/')[0];
        if (!seg || seg.startsWith('_')) continue;
        const p = join(ROOT, 'app', seg);
        if (existsSync(p)) dirs.add(p);
      }
    }
  }
  return [...dirs];
}

const violations = [];
for (const route of navRoutes) {
  if (route === '/') continue; // homepage renders its own nav; not this chrome
  if (unfixed.has(route)) continue;
  const hits = renderDirs(route).flatMap(pinnedFiles);
  if (hits.length > 0) {
    violations.push({
      route,
      hits: [...new Set(hits.map((h) => h.replace(ROOT + '/', '')))],
    });
  }
}

if (violations.length > 0) {
  console.error(
    '\n✗ Two pinned bars would stack — the floating glass nav will overlap this\n' +
      '  page’s own pinned bar.\n\n' +
      '  Fix: add the route to UNFIXED_ROUTES in\n' +
      '  app/_components/marketing/site-chrome.tsx, so the glass nav renders\n' +
      '  in-flow and scrolls away instead of sitting on top.\n',
  );
  for (const v of violations) {
    console.error(`  ${v.route}`);
    for (const h of v.hits) console.error(`      pins to viewport top: ${h}`);
  }
  console.error(`\n  ${violations.length} route(s).\n`);
  process.exit(1);
}

console.log(`✓ no stacked pinned bars (${navRoutes.size} nav routes checked)`);
