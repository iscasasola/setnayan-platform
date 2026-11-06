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

test('the matcher can actually see a gate — proven on a sample, not on a page', () => {
  // ⚠ RE-ANCHORED 2026-09-22. This used to prove the matcher works by running
  // it against the REAL `app/open-shop/page.tsx`, which then contained
  // `if (!user) redirect('/login…')`. Hours later the owner's ONE DOOR ruling
  // removed that redirect — the account is created inside step 3 now — and this
  // test went red on a correct tree.
  //
  // 🔑 A GUARD'S "CAN IT FAIL" PROOF MUST NOT DEPEND ON A PAGE SOMEBODY IS
  // ALLOWED TO CHANGE. The product moved and the guard's evidence moved with
  // it. Samples cannot be superseded by a ruling.
  const gated = [
    "if (!user) redirect('/login?next=/x')",
    'if (!user) { redirect("/login") }',
    'if (!session) redirect(`/login`)',
  ];
  for (const sample of gated) {
    assert.match(sample, ANON_REDIRECT, `should match: ${sample}`);
  }

  // And must NOT match things that are not an anonymous-visitor gate.
  const ungated = [
    "if (row?.business_name) redirect('/vendor-dashboard/shop')",
    "redirect('/login')",                      // unconditional, not a !user gate
    "if (!user) return null;",                  // a gate that renders, not redirects
  ];
  for (const sample of ungated) {
    assert.doesNotMatch(sample, ANON_REDIRECT, `should NOT match: ${sample}`);
  }
});

/*
 * ── A sitemap may not advertise a REDIRECT either (live walk 2026-11-01) ─────
 * `/explore/compare` sat in STATIC_ROUTES while the middleware answers a bare
 * `/explore/compare` (no `?ids=`) with 307 → /explore — and every sitemap URL is
 * bare. Google is handed a URL whose only content is "go somewhere else".
 *
 * Three places can redirect a path before its page renders, and each is read
 * here the way the request meets it:
 *   1. `legacyRedirectTarget` — the middleware's retired-page map, EXECUTED.
 *   2. `next.config.ts` → `redirects()` — every `source:` pattern, matched.
 *   3. `middleware.ts` — every `if (… pathname === '<x>' …)` whose first
 *      `return` is `NextResponse.redirect`. A sitemap URL carries no query, so a
 *      redirect conditioned on a MISSING param (`!…get('ids')`) is a redirect.
 * ⚠ Not covered: a `redirect()` inside a page.tsx, or a middleware redirect
 * keyed on a prefix/regex rather than an equality. Stated rather than implied.
 */

/** next.config `redirects()` sources, as regexes (`:param` = one segment, `:param*` = any rest). */
function nextConfigRedirectSources(): RegExp[] {
  const src = stripComments(readFileSync(join(WEB, 'next.config.ts'), 'utf8'));
  const start = src.indexOf('async redirects()');
  assert.ok(start >= 0, 'next.config.ts has no `async redirects()` — has its shape changed?');
  const block = src.slice(start, src.indexOf('async ', start + 10) > 0 ? src.indexOf('async ', start + 10) : undefined);
  return [...block.matchAll(/source:\s*'([^']+)'/g)].map((m) => {
    const pattern = m[1]!
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\/:\w+\*/g, '(?:/.*)?')
      .replace(/:\w+/g, '[^/]+');
    return new RegExp(`^${pattern}$`);
  });
}

/** Exact paths the middleware redirects: an `if` naming `pathname === '<x>'` whose first return redirects. */
function middlewareRedirectedPaths(): string[] {
  const src = stripComments(readFileSync(join(WEB, 'middleware.ts'), 'utf8'));
  const out: string[] = [];
  for (const m of src.matchAll(/if \(([^)]*?)pathname === '([^']+)'/g)) {
    const after = src.slice(m.index!);
    const ret = after.search(/\breturn\b/);
    if (ret >= 0 && /^return\s+NextResponse\.redirect\(/.test(after.slice(ret))) out.push(m[2]!);
  }
  return out;
}

test('every page the sitemap advertises is a page, not a redirect', async () => {
  const { legacyRedirectTarget } = await import('./legacy-redirects');
  const paths = sitemapPaths();
  const configSources = nextConfigRedirectSources();
  const mwPaths = middlewareRedirectedPaths();
  console.log(
    `[sitemap-redirects] ${paths.length} path(s) vs ${configSources.length} next.config redirect(s), ` +
      `${mwPaths.length} middleware equality redirect(s) [${mwPaths.join(', ')}], and the legacy map`,
  );
  // Prove each reader can see what it is reading — a blind reader passes silently.
  assert.ok(configSources.length >= 8, `only ${configSources.length} next.config redirect sources read`);
  assert.ok(mwPaths.includes('/explore/compare'), 'the middleware reader no longer sees the bare /explore/compare 307');
  assert.ok(configSources.some((r) => r.test('/how-it-works')), 'the next.config reader no longer matches /how-it-works');

  const bad: string[] = [];
  for (const p of paths) {
    const legacy = legacyRedirectTarget(p, '');
    if (legacy) bad.push(`${p} → ${legacy} (lib/legacy-redirects.ts)`);
    if (configSources.some((r) => r.test(p))) bad.push(`${p} (next.config.ts redirects())`);
    if (mwPaths.includes(p)) bad.push(`${p} (middleware.ts redirects it bare)`);
  }
  assert.deepEqual(
    bad,
    [],
    'The static sitemap advertises a URL that only redirects. List the destination instead, or ' +
      'nothing:\n  ' + bad.join('\n  '),
  );
});
