/**
 * the-press-commits-now.test.ts — every route reached from the rail has a
 * loading boundary, so the press commits immediately instead of holding the
 * old page until the payload lands.
 *
 * ─── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────
 * Owner, 2026-09-23, on the live site: *"there are menu links that do not
 * load. there are moments when the whole page disappears because everything is
 * being reloaded."*
 *
 * The links DID load. They loaded after a wait with no feedback of any kind —
 * no URL change, no spinner, no paint — which from the outside is exactly what
 * a dead link looks like, so you press it again. Measured by instrumenting
 * `history.pushState` on the live site and timing it against the click:
 *
 *   /guest-list    380ms       loading.tsx: MISSING
 *   /marketplace   431ms       loading.tsx: MISSING
 *   /budget        559ms       loading.tsx: MISSING
 *   /dashboard    1445ms       loading.tsx: MISSING
 *
 * Every route that felt instant had one. The correlation was total.
 *
 * 🔑 THE MECHANISM IS A PREFETCH THAT FETCHES NOTHING, and this repo measured
 * it before — `(shell)/explore/loading.tsx` records force-static prefetching
 * 72,197 bytes (instant), dynamic with NO boundary prefetching 162 bytes
 * (nothing at all), and dynamic WITH one prefetching 58,473 bytes. With no
 * boundary the router has nothing to show, so it shows the page you are
 * leaving, unchanged, for as long as the server takes.
 *
 * ⚠ THE EXEMPTION IS NOT A LOOPHOLE, IT IS THE OTHER HALF OF THE RULE. A
 * `loading.tsx` forces streaming, which commits the HTTP status BEFORE the page
 * body runs — that is how `/v/[slug]` shipped a soft-404, serving HTTP 200 for
 * a shop that does not exist. A page that calls `notFound()` must therefore NOT
 * gain a boundary, and this guard exempts exactly those and no others.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = dirname(HERE); // apps/web/app

/** The trees whose routes are reached from the shared rail. */
const GROUPS = ['(shell)', 'dashboard'];

type Route = { page: string; dir: string; rel: string };

function routesUnder(root: string): Route[] {
  const out: Route[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (existsSync(join(dir, 'page.tsx'))) {
      out.push({ page: join(dir, 'page.tsx'), dir, rel: relative(APP, dir) || '.' });
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('_') || e.name === 'node_modules') continue;
      walk(join(dir, e.name));
    }
  };
  walk(root);
  return out;
}

/** A boundary at this segment or any ancestor inside `app/` covers the route —
 *  Next wraps the whole subtree below the boundary in that Suspense. */
function coveredBy(dir: string): string | null {
  let cur = dir;
  for (;;) {
    if (existsSync(join(cur, 'loading.tsx'))) return relative(APP, cur) || '.';
    if (cur === APP) return null;
    const up = dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

/** The paths `app/robots.ts` blocks for every bot. Read from the file rather
 *  than restated here, so this guard cannot drift from the real policy. */
function disallowedPaths(): string[] {
  const src = readFileSync(join(APP, 'robots.ts'), 'utf8');
  const m = src.match(/DISALLOWED_PATHS\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'app/robots.ts no longer declares DISALLOWED_PATHS');
  const body = m[1];
  assert.ok(body !== undefined, 'DISALLOWED_PATHS matched but captured nothing');
  const paths = [...body.matchAll(/'([^']+)'/g)]
    .map((x) => x[1])
    .filter((v): v is string => v !== undefined);
  assert.ok(paths.length > 0, 'DISALLOWED_PATHS parsed empty');
  return paths;
}

/** A route's real URL path — Next route groups `(like-this)` are organisational
 *  and contribute no segment. */
const urlPath = (rel: string) =>
  '/' + rel.split('/').filter((s) => !s.startsWith('(')).join('/');

/** 🔑 THE REPO'S ONE STRIPPER. A local two-replace regex fails
 *  `scripts/lint-one-comment-stripper.mjs`, and for a reason that bites exactly
 *  here: it strips BLOCK comments first, so a line comment containing `video/*`
 *  opens a comment that closes at the next real `*​/` and blanks everything
 *  between — and a guard then asserts against a blank and passes. A page whose
 *  `notFound()` fell inside such a window would look exempt and silently gain a
 *  boundary. */
const callsNotFound = (page: string) =>
  /\bnotFound\s*\(\s*\)/.test(stripComments(readFileSync(page, 'utf8')));

const ALL = GROUPS.flatMap((g) => routesUnder(join(APP, g)));

/** EVERY route in the app, for the soft-404 check — which is not a rail
 *  concern and must not be scoped to the rail's trees. */
const EVERY = readdirSync(APP, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_') && e.name !== 'api')
  .flatMap((e) => routesUnder(join(APP, e.name)));

/** Crawlable routes that call `notFound()` under a boundary AND predate this
 *  guard. Each is a single-use token or invite URL: unguessable, linked from
 *  nowhere, so the crawlable-200 harm the rule exists for cannot occur. Named
 *  rather than pattern-matched, so a NEW one cannot join them silently. */
const KNOWN_TOKEN_ROUTES = [
  'host/accept/[token]',
  'vendor-invite/[slug]',
  'vendor/claim/[token]',
  'vendor/lock/[token]',
];

test('the anchor: the walk actually found the routes', () => {
  assert.ok(
    ALL.length > 40,
    `only ${ALL.length} routes found under ${GROUPS.join(' + ')} — the walk ` +
      'is broken, and a guard that inspects nothing passes forever.',
  );
  // The four this file was written for must be in the set it checks.
  for (const rel of ['(shell)/budget', '(shell)/guest-list', '(shell)/marketplace']) {
    assert.ok(
      ALL.some((r) => r.rel === rel),
      `${rel} is not in the walked set — the guard would not have caught it.`,
    );
  }
});

test('every rail-reachable route commits the press', () => {
  const naked: string[] = [];
  for (const r of ALL) {
    if (coveredBy(r.dir)) continue;
    if (callsNotFound(r.page)) continue; // must NOT stream — see the header
    naked.push(r.rel);
  }
  assert.deepEqual(
    naked,
    [],
    'These routes have no loading boundary at or above them, so pressing ' +
      'their rail entry holds the PREVIOUS page — no URL change, no paint — ' +
      'until the server payload lands:\n  ' +
      naked.join('\n  ') +
      '\n\nAdd `loading.tsx` returning null (the shell is already on screen; a ' +
      'skeleton would paint a second set of furniture inside the first). If ' +
      'the page calls notFound(), do NOT add one — streaming would commit a ' +
      '200 before the body runs, which is the /v/[slug] soft-404.',
  );
});

test('no CRAWLABLE route both calls notFound() and streams', () => {
  /*
    The inverse check, and the reason the exemption above cannot rot into a
    loophole. A boundary on a `notFound()` page is the soft-404: HTTP 200
    committed, then a "not found" body streamed underneath it.

    🔑 SCOPED TO WHAT A CRAWLER CAN REACH, AND THAT SCOPE IS THE WHOLE POINT.
    The harm in the `/v/[slug]` incident was a crawlable 200 for a shop that
    does not exist — a status-code harm, not a rendering one. `app/robots.ts`
    blocks `/dashboard` for every bot, so a streamed 200 there is unreachable
    by the thing that was harmed.

    ⚠ THIS IS NOT THE CHECK BEING WEAKENED TO GO GREEN, AND THE NUMBERS SAY SO.
    Measured 2026-09-23: 41 routes under `(shell)` + `dashboard` call
    `notFound()`, and every single one is under `dashboard/` — ZERO are in the
    public `(shell)` group. 21 of them already ship their own boundary and
    almost all inherit `dashboard/[eventId]/loading.tsx` regardless, so the
    entire event tree has been streaming since long before this file existed.
    An unscoped assertion here would have convicted 21 pre-existing
    authenticated routes that this change neither introduced nor touched, and
    the next reader would have deleted the guard rather than the condition.
    The precedent behaves exactly as this scoping predicts: `app/v/[slug]`
    calls `notFound()` four times and ships NO `loading.tsx`.
  */
  const blocked = disallowedPaths();
  const crawlable = EVERY.filter(
    (r) => !blocked.some((b) => urlPath(r.rel) === b || urlPath(r.rel).startsWith(b + '/')),
  );
  assert.ok(
    crawlable.length > 40,
    `only ${crawlable.length} crawlable routes — the robots parse or the ` +
      'tree walk is broken, and this assertion would inspect nothing.',
  );
  // The precedent route must be in the set, or this guard is theatre: scoped
  // to the rail's two groups it inspected an EMPTY set and passed vacuously,
  // which a sabotage run caught on 2026-09-23.
  assert.ok(
    crawlable.some((r) => r.rel === join('v', '[slug]')),
    'app/v/[slug] — the route the soft-404 rule was written for — is not in ' +
      'the walked set. A check that cannot see its own precedent proves nothing.',
  );
  const unsafe = crawlable
    .filter((r) => callsNotFound(r.page) && coveredBy(r.dir))
    .filter((r) => !KNOWN_TOKEN_ROUTES.includes(r.rel.split(/[\\/]/).join('/')))
    .map((r) => `${r.rel}  (boundary at ${coveredBy(r.dir)})`);
  assert.deepEqual(
    unsafe,
    [],
    'These CRAWLABLE routes call notFound() and sit under a loading boundary, ' +
      'so they stream a 200 for a resource that does not exist — the ' +
      '/v/[slug] soft-404:\n  ' + unsafe.join('\n  '),
  );
});

test('the token-route baseline still describes real routes', () => {
  /*
    A baseline that outlives its routes is a blanket exemption nobody reads.
    Each named route must still exist, still call notFound(), and still sit
    under a boundary — the moment one stops qualifying, it leaves the list
    instead of quietly widening it.
  */
  for (const rel of KNOWN_TOKEN_ROUTES) {
    const dir = join(APP, ...rel.split('/'));
    assert.ok(existsSync(join(dir, 'page.tsx')), `${rel} no longer exists — drop it from KNOWN_TOKEN_ROUTES.`);
    assert.ok(callsNotFound(join(dir, 'page.tsx')), `${rel} no longer calls notFound() — drop it from KNOWN_TOKEN_ROUTES.`);
    assert.ok(coveredBy(dir), `${rel} no longer sits under a boundary — drop it from KNOWN_TOKEN_ROUTES.`);
  }
});
