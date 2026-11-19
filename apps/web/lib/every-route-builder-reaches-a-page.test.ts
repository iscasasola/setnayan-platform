/**
 * Every builder in `lib/routes.ts` reaches a real page or route handler.
 *
 * `routes.ts`'s docblock promised, for months, that "the route-integrity guard
 * (scripts/lint-routes.mjs) fails the build if a builder points at a folder that
 * does not exist". That script never existed in this repo's history —
 * `node scripts/lint-routes.mjs` is MODULE_NOT_FOUND — and two handoffs cite it
 * as "doing its job". The only sweep that did exist
 * (`live-studio-retirement-leftovers.test.ts`) walks `routes.dashboard.addOns`
 * and nothing else. When this guard was written it found SIX dead builders
 * outside that subtree, every one with zero callers: `/venue/:slug`, `/venues`,
 * `/venues/:city`, `/explore`, `/sitemap-venues.xml` and
 * `/dashboard/:e/studio/supplies-marketplace`.
 *
 * 🔑 DERIVED, NEVER HAND-LISTED. The builders are evaluated (so a builder that
 * calls a helper is as good as a literal) and resolved against the filesystem.
 * No second copy of the route list exists for this test to drift with.
 *
 * 🔑 A LITERAL SEGMENT MUST MATCH A LITERAL FOLDER. Only the builder's own
 * arguments may fill a `[dynamic]` folder. Without that rule `/venues` "exists"
 * because `app/[slug]` (the guest event page) accepts any one segment, and
 * `/studio/supplies-marketplace` "exists" because `studio/[addon]` accepts it
 * and redirects. Both are dead links that a loose matcher calls live.
 *
 * ⚠ WHAT THIS DOES NOT PROVE: that every page has a builder (most do not), that
 * hardcoded hrefs use this file, that a page renders rather than redirecting
 * when a REAL argument is passed, or that a query string the builder appends is
 * one the page reads. It evaluates code rather than scanning source, so it does
 * not use `strip-comments.ts`: a comment cannot be called.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { routes } from '@/lib/routes';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = join(WEB, 'app');

/** The placeholder every builder argument is filled with. */
const ARG = '__route_arg__';

const LEAF_FILES = ['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'route.ts', 'route.tsx', 'route.js'];

const isGroup = (name: string) => /^\(.*\)$/.test(name);
const isCatchAll = (name: string) => /^\[\.\.\..+\]$/.test(name);
const isOptionalCatchAll = (name: string) => /^\[\[\.\.\..+\]\]$/.test(name);
const isDynamic = (name: string) => /^\[[^.[\]][^\]]*\]$/.test(name);

/** Folders Next.js may route through: not `_private`, not `@parallel` slots. */
function routableChildren(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.filter(
    (e) =>
      !e.startsWith('_') &&
      !e.startsWith('@') &&
      e !== 'node_modules' &&
      statSync(join(dir, e)).isDirectory(),
  );
}

/**
 * Does `segments` resolve to a page/route file under `dir`? Literal segments must
 * match literal folders; only `ARG` may fill a `[dynamic]` / catch-all folder.
 * `(group)` folders consume nothing and are honoured at every depth, the leaf
 * included (`tl/features/(hub)/page.tsx` serves `/tl/features`).
 */
function resolves(dir: string, segments: readonly string[]): boolean {
  const children = routableChildren(dir);
  if (segments.length === 0) {
    if (LEAF_FILES.some((f) => existsSync(join(dir, f)))) return true;
    return children.some(
      (c) => (isGroup(c) || isOptionalCatchAll(c)) && resolves(join(dir, c), []),
    );
  }
  const [head, ...rest] = segments as [string, ...string[]];
  for (const child of children) {
    const full = join(dir, child);
    if (isGroup(child)) {
      if (resolves(full, segments)) return true;
    } else if (head === ARG && (isCatchAll(child) || isOptionalCatchAll(child))) {
      if (resolves(full, [])) return true;
    } else if (head === ARG && isDynamic(child)) {
      if (resolves(full, rest)) return true;
    } else if (child === head) {
      if (resolves(full, rest)) return true;
    }
  }
  return false;
}

/** Path part of a builder's output, split into segments (query + hash dropped). */
function segmentsOf(href: string): string[] {
  const path = href.split('#')[0]!.split('?')[0]!;
  return path.split('/').filter((s) => s.length > 0);
}

/** Every leaf builder of the routes tree, called with `ARG` for each parameter. */
function allBuilders(node: unknown, prefix: string, out: Array<[string, string]>): void {
  if (typeof node === 'function') {
    const fn = node as (...args: string[]) => unknown;
    out.push([prefix, String(fn(...Array.from({ length: Math.max(fn.length, 4) }, () => ARG)))]);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      allBuilders(value, `${prefix}.${key}`, out);
    }
  }
}

test('the resolver tells a real route from a dead one (so a green run means something)', () => {
  // Real, at each shape the resolver handles.
  assert.equal(resolves(APP, []), true, '`/` must resolve');
  assert.equal(resolves(APP, ['admin']), true, '`/admin` is a literal folder');
  assert.equal(resolves(APP, [ARG]), true, '`/:slug` fills app/[slug]');
  assert.equal(resolves(APP, ['dashboard', ARG, 'budget']), true, 'a dynamic middle segment');
  assert.equal(resolves(APP, ['tl', 'features']), true, 'a (group) folder at the leaf');
  // Dead — each of these is a way a looser resolver says "live".
  assert.equal(resolves(APP, ['no-such-route-anywhere', 'x']), false, 'a folder that does not exist');
  assert.equal(resolves(APP, ['venues']), false, 'a literal must not fall into app/[slug]');
  assert.equal(
    resolves(APP, ['dashboard', ARG, 'studio', 'supplies-marketplace']),
    false,
    'a literal must not fall into studio/[addon]',
  );
  assert.equal(resolves(APP, ['admin', 'no-such-admin-page']), false, 'a dead child of a real folder');
});

test('every routes.ts builder resolves to a page or route handler under app/', () => {
  const builders: Array<[string, string]> = [];
  allBuilders(routes, 'routes', builders);

  // NON-VACUITY without a magic floor: the walk must reach the whole tree's
  // top-level keys, and every builder must produce an absolute path.
  const topLevel = Object.keys(routes);
  for (const key of topLevel) {
    assert.ok(
      builders.some(([ref]) => ref === `routes.${key}` || ref.startsWith(`routes.${key}.`)),
      `the walk never reached routes.${key} — the guard is not seeing the whole file`,
    );
  }
  const notPaths = builders.filter(([, href]) => !href.startsWith('/'));
  assert.deepEqual(
    notPaths.map(([ref, href]) => `${ref} → ${href}`),
    [],
    'every builder must return an absolute app path',
  );

  const dead = builders
    .filter(([, href]) => !resolves(APP, segmentsOf(href)))
    .map(([ref, href]) => `${ref} → ${href.split(ARG).join(':arg')}`);

  assert.deepEqual(
    dead,
    [],
    'Route builder(s) whose path reaches no page.tsx / route.ts under app/ — delete the ' +
      'builder (and its callers) or restore the page. A literal segment must match a ' +
      `literal folder; only a builder argument may fill a [dynamic] folder:\n    ${dead.join('\n    ')}`,
  );
});
