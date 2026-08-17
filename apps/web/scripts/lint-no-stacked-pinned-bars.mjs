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

/**
 * Pull a `new Set<string>([...])` literal's members out of the source.
 *
 * 🪤 COMMENTS ARE STRIPPED FIRST, AND ONE APOSTROPHE IS WHY. `site-chrome.tsx`
 * carries the words "Google's OAuth reviewer" in a comment INSIDE the
 * NAV_ROUTES literal. Run over raw source, `/'([^']+)'/g` reads that apostrophe
 * as an opening quote and swallows everything to the next one — so this
 * returned a whole comment paragraph as a "route" and NEVER SAW
 * /privacy/google-access, /terms, /refunds, /cookies, /acceptable-use, /help,
 * /download or /waitlist. This lint has therefore never once checked the legal
 * family for a stacked pinned bar, silently, since it was written.
 *
 * Measured 2026-08-15: 26 members from raw source, 25 from stripped, differing
 * by eight in one direction and six in the other.
 */
function setMembers(src, name) {
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n');
  const m = clean.match(new RegExp(`const ${name}\\s*=\\s*new Set<string>\\(\\[([\\s\\S]*?)\\]\\)`));
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
/*
  🪤 THIS WAS `navRoutes.size < 10` AND IT WAS THE LAST COUNT FLOOR STANDING.
  Both test files that guard this same set already replaced their own count
  floors with positive controls, for a reason measured here: NAV_ROUTES drops
  from 16 to 13 in the /explore + /help + /alaala conversion, and /vendors,
  /creators, /blog and /features are all plausible next ones. A floor tuned to
  today's size cries wolf every time the set shrinks ON PURPOSE, and the honest
  response is always to lower the number — which ends at a floor of 0 guarding
  nothing. A positive control is strictly stronger: a broken parser cannot
  produce a route it never saw.
*/
for (const control of ['/download', '/waitlist']) {
  if (!navRoutes.has(control)) {
    console.error(
      `✗ NAV_ROUTES parsed without ${control}, a stable member with no product\n` +
        '  surface behind it — the parser is wrong and this guard would inspect\n' +
        `  nothing. Parsed ${navRoutes.size}: ${[...navRoutes].slice(0, 6).join(', ')}`,
    );
    process.exit(1);
  }
}

/**
 * Source with comments removed.
 *
 * 🪤 WITHOUT THIS THE GUARD CRIES WOLF ON ITS OWN SUBJECT MATTER. On the first
 * run of the shelled-route check it reported `app/(shell)/explore/page.tsx` as pinning
 * a bar — the match was a COMMENT describing the behaviour being removed. A
 * guard that fires on prose teaches you to skim past the one time it is right,
 * and the file it will fire on most is the file someone is documenting.
 * The same fix the NAV_ROUTES parser needed, for the same reason.
 */
function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Does anything under this directory pin itself to the viewport top?
 *
 * 🚨 THIS USED TO REQUIRE THE TWO TOKENS TO BE ADJACENT —
 *   /(?:sticky|fixed)\s+(?:inset-x-0\s+)?top-0|top-0[^"']*\b(?:sticky|fixed)\b/
 * — and Tailwind responsive prefixes broke it wide open. The supplier
 * marketplace's own header reads `sm:sticky sm:bottom-auto sm:top-0`: prefixed,
 * and with a class in between. It never matched, so THE BAR THIS GUARD MOST
 * EXISTS TO SEE WAS INVISIBLE TO IT — on /explore, the one route in the app
 * that genuinely stacks bars. Found by mutation: reverting that file to `top-0`
 * left the lint GREEN while two sibling mutations turned it red.
 *
 * 🔑 IT NOW ASKS THE QUESTION PER CLASS ATTRIBUTE, which is the unit the
 * question is actually about: does ONE element carry both a pinning position
 * and a zero top offset? Testing the two tokens across a whole FILE would
 * over-match (a `fixed` modal plus an unrelated `top-0`), and testing adjacency
 * under-matches exactly as it did. Prefixes are allowed on either token because
 * `sm:sticky sm:top-0` pins just as hard above 640px as `sticky top-0` does
 * everywhere.
 */
const POS = /(?:^|\s)(?:[a-z]+:)?(?:sticky|fixed)(?=\s|$)/;
const TOP0 = /(?:^|\s)(?:[a-z]+:)?top-0(?=\s|$)/;
/** Every class attribute value in the source, however it is written. */
const CLASS_ATTR = /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;

function PIN_test(src) {
  for (const m of src.matchAll(CLASS_ATTR)) {
    const v = m[1] ?? m[2] ?? m[3] ?? '';
    if (POS.test(v) && TOP0.test(v)) return true;
  }
  return false;
}
const PIN = { test: PIN_test };

function pinnedFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n === '.next') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.tsx') && PIN.test(stripComments(readFileSync(p, 'utf8'))))
        out.push(p);
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

/*
  ─── THE OPPOSITE CHECK: ROUTES THAT LEFT NAV_ROUTES FOR THE SHARED SHELL ────

  🚨 REMOVING A ROUTE FROM NAV_ROUTES TOOK IT OUT OF THE LOOP ABOVE AT THE EXACT
  MOMENT THE COLLISION BECAME POSSIBLE — silently, with no message. /explore is
  the one route in the app that genuinely pins two bars, and converting it to
  the shared shell dropped it from this guard's scope entirely. site-chrome.tsx
  already carries a comment recording this same trap from the seven doorways.

  The rule inverts for a shelled route. Under the glass nav the fix was to make
  the NAV non-fixed (UNFIXED_ROUTES). Under the shared shell the bar is the
  point and must stay pinned, so the PAGE's own strip parks beneath it — at the
  shell's own height token, never a hand-typed number and never bare `top-0`.
*/
const SHELL_ROUTES = ['/explore', '/help', '/alaala'];
/** Parked under the shared bar: reads the shell's token, directly or in calc(). */
const PARKED = /top-\[(?:calc\()?var\(--fd-bar/;

const shellViolations = [];
for (const route of SHELL_ROUTES) {
  const hits = renderDirs(route)
    .flatMap(pinnedFiles)
    .filter((f) => !PARKED.test(stripComments(readFileSync(f, 'utf8'))));
  if (hits.length > 0) {
    shellViolations.push({
      route,
      hits: [...new Set(hits.map((h) => h.replace(ROOT + '/', '')))],
    });
  }
}

if (shellViolations.length > 0) {
  console.error(
    '\n✗ A shelled route pins a bar to the viewport top. The shared top bar is\n' +
      '  already there, so this strip slides underneath it and its controls\n' +
      '  become unclickable.\n\n' +
      '  Fix: park it under the bar with the shell’s own token —\n' +
      '    top-[var(--fd-bar,0px)]   (or top-[calc(var(--fd-bar,0px)+1rem)])\n' +
      '  NOT a hand-typed pixel value: the bar is 56px on public pages and 61px\n' +
      '  in the app variant, and it has changed twice.\n',
  );
  for (const v of shellViolations) {
    console.error(`  ${v.route}`);
    for (const h of v.hits) console.error(`      pins to viewport top: ${h}`);
  }
  console.error(`\n  ${shellViolations.length} route(s).\n`);
  process.exit(1);
}

console.log(
  `✓ no stacked pinned bars (${navRoutes.size} nav routes + ` +
    `${SHELL_ROUTES.length} shelled routes checked)`,
);
