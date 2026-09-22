/**
 * sitemap-lists-only-public-pages.test.ts — a sitemap may not advertise a page
 * that a stranger cannot read.
 *
 * ── The defect (register LAU-45) ────────────────────────────────────────────
 * `/open-shop` — the supplier onboarding funnel — sat in `sitemap-static.xml`
 * with the note *"was orphaned (indexable but in no sitemap); added
 * 2026-07-10."* It is not indexable. `app/open-shop/page.tsx` does
 *
 *     if (!user) redirect('/login?next=…&as=vendor')
 *
 * and **every crawler is signed out.** Measured on production:
 * `/open-shop` → 307 → `/login?next=%2Fopen-shop&as=vendor`. So the sitemap
 * pointed Google at a login page, and the supplier funnel was advertised to
 * nobody for two and a half months.
 *
 * 🔑 THE NOTE THAT ADDED IT WAS THE MISTAKE. "Indexable but in no sitemap" was
 * half-measured: whoever checked confirmed the route EXISTED and never fetched
 * it signed out. A page you can see while logged in tells you nothing about
 * what a crawler gets.
 *
 * ── What this holds ─────────────────────────────────────────────────────────
 * Every path in `STATIC_ROUTES` resolves to a page that does NOT bounce an
 * anonymous visitor to `/login`. Derived from the page sources, so a route that
 * GAINS an auth gate later fails here rather than silently rotting in the
 * sitemap — which is the direction this defect actually travels.
 *
 * ⚠ Scope: source, not network. It proves no listed page contains an
 * anonymous-visitor redirect to `/login`. It cannot see a gate applied by
 * middleware or by a layout, and it does not check that the page renders well.
 * Stated rather than implied.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const SITEMAP = join(WEB, 'app/sitemap-static.xml/route.ts');

/** The paths the static sitemap advertises. */
function sitemapPaths(): string[] {
  const src = stripComments(readFileSync(SITEMAP, 'utf8'));
  return [...src.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]!);
}

/**
 * Candidate page files for a URL path. App Router hides routes behind route
 * GROUPS — `(shell)`, `(marketing)` — which do not appear in the URL, so a
 * single path can live in several places. Missing is not a failure here: a
 * statically-generated or rewritten route legitimately has no `page.tsx`, and
 * this guard is about auth gates, not about route existence.
 */
function candidateFiles(urlPath: string): string[] {
  const rel = urlPath === '/' ? '' : urlPath.replace(/^\//, '');
  const groups = ['', '(shell)', '(marketing)', '(public)'];
  const out: string[] = [];
  for (const g of groups) {
    for (const ext of ['page.tsx', 'page.ts']) {
      out.push(join(WEB, 'app', g, rel, ext));
    }
  }
  return out;
}

/** An anonymous visitor being sent to /login. Both quote styles, both orders. */
const ANON_REDIRECT =
  /if\s*\(\s*!\s*(?:user|session|data\?\.user)\s*\)\s*(?:\{\s*)?redirect\(\s*['"`]\/login/;

test('every page the sitemap advertises is readable signed out', () => {
  const paths = sitemapPaths();
  const gated: string[] = [];
  let resolved = 0;

  for (const p of paths) {
    const file = candidateFiles(p).find(existsSync);
    if (!file) continue; // route group we do not model, or a non-page route
    resolved += 1;
    const code = stripComments(readFileSync(file, 'utf8'));
    if (ANON_REDIRECT.test(code)) {
      gated.push(`${p}  → ${file.slice(WEB.length + 1)}`);
    }
  }

  // Print what was searched. A zero that resolved nothing reads exactly like a
  // zero that resolved everything.
  console.log(
    `[sitemap-public] ${paths.length} advertised path(s), ${resolved} resolved to a page file, ` +
      `${gated.length} auth-gated`,
  );
  assert.ok(paths.length >= 25, `only ${paths.length} sitemap paths parsed — has the shape changed?`);
  assert.ok(
    resolved >= 15,
    `only ${resolved} of ${paths.length} paths resolved to a page file — the candidate resolver ` +
      'has stopped finding them, so this check is passing without looking',
  );
  assert.deepEqual(
    gated,
    [],
    'The sitemap advertises a page that redirects an anonymous visitor to /login. Every crawler ' +
      'is signed out, so Google indexes the login page instead.\nEither remove it from ' +
      'STATIC_ROUTES, or make the page readable signed out in the same commit.\n  ' +
      gated.join('\n  '),
  );
});

test('the guard can see a gate — it is matched against the real open-shop page', () => {
  // The page this defect was found on still has its gate; it is simply no
  // longer advertised. If this stops matching, the pattern above has drifted
  // and the sweep would pass by seeing nothing.
  const openShop = join(WEB, 'app/open-shop/page.tsx');
  assert.ok(existsSync(openShop), 'app/open-shop/page.tsx has moved — re-aim this guard');
  assert.match(
    stripComments(readFileSync(openShop, 'utf8')),
    ANON_REDIRECT,
    'the anonymous-redirect pattern no longer matches the page it was written from, so the ' +
      'sweep above proves nothing',
  );
  assert.ok(
    !sitemapPaths().includes('/open-shop'),
    '/open-shop is advertised again — it still bounces a crawler to /login',
  );
});
