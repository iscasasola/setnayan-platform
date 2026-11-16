/**
 * 🔗 NO PAGE LINKS A RETIRED ADDRESS (full-page audit, 2026-11-16, fix 1).
 *
 * When a page moves, its old address keeps working: a small redirect stub (or
 * the middleware's legacy map) forwards it. That is right for a bookmark and
 * wrong for our OWN links — every tap on a link we wrote pays an extra hop, and
 * a stub that forgets one query parameter silently drops a banner the action
 * meant to show. So our own code points straight at the new address.
 *
 * "Retired" is read from the SAME lists the forwarding uses — nothing here is
 * hand-typed:
 *   · `legacyRedirectTarget` (the middleware's map),
 *   · the redirect stubs in the screen map (`lib/ugat/screens.generated.json`,
 *     every screen whose `redirectsTo` is set),
 *   · the admin map's redirect stubs (`ADMIN_ROUTES`, `kind: 'redirect'`).
 *
 * The baseline lists the links not moved yet (each sits in a file another open
 * PR is editing). It ONLY SHRINKS: a new old link fails, and a baseline line
 * whose link is gone fails too, so the line gets deleted with the fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { legacyRedirectTarget } from './legacy-redirects';
import { ADMIN_ROUTES } from './admin-map/admin-routes.generated';

const ROOT = join(__dirname, '..');
const BASELINE = join(__dirname, 'old-links-point-home.baseline.txt');

type Screen = { route: string; redirectsTo: string | null };
const screens: Screen[] = JSON.parse(
  readFileSync(join(ROOT, 'lib/ugat/screens.generated.json'), 'utf8'),
).screens;

function routeRe(route: string): RegExp {
  let rx = '^';
  for (const s of route.split('/').filter(Boolean)) {
    if (/^\[\[\.\.\..+\]\]$/.test(s)) rx += '(?:/.*)?';
    else if (/^\[\.\.\..+\]$/.test(s)) rx += '/.+';
    else if (/^\[.+\]$/.test(s)) rx += '/[^/]+';
    else rx += '/' + s.replace(/[.*+?^${}()|\\]/g, '\\$&');
  }
  return new RegExp(rx + '/?$');
}

// Real pages first (most specific wins): a concrete page under a stub's prefix is not the stub.
const dyn = (r: string) => (r.match(/\[/g) ?? []).length;
const screenMatchers = screens
  .map((s) => ({ s, re: routeRe(s.route) }))
  .sort((a, b) => dyn(a.s.route) - dyn(b.s.route));
const adminStubs = new Set(ADMIN_ROUTES.filter((r) => r.kind === 'redirect').map((r) => r.path));
const adminPages = new Set(ADMIN_ROUTES.filter((r) => r.kind === 'page').map((r) => r.path));

/** The retired address a path names, or null. `x1` stands in for any dynamic segment. */
export function retiredTarget(path: string): string | null {
  const concrete = path.replace(/x1/g, 'abc123');
  const lg = legacyRedirectTarget(concrete, '');
  if (lg) return lg;
  if (adminStubs.has(path)) return ADMIN_ROUTES.find((r) => r.path === path)!.redirectsTo ?? '(stub)';
  if (adminPages.has(path)) return null;
  const hit = screenMatchers.find(({ re }) => re.test(concrete));
  return hit?.s.redirectsTo ?? null;
}

/**
 * The path part of a hand-written link. A `${…}` that is a whole segment becomes
 * `x1`; one glued onto a segment (`/x${qs ? …}`) is a query suffix and is dropped.
 */
export function linkPath(raw: string): string | null {
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  let out = '';
  for (let i = 0; i < raw.length; ) {
    if (raw[i] === '$' && raw[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      for (; j < raw.length && depth > 0; j++) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') depth--;
      }
      if (out.endsWith('/')) out += 'x1';
      else break; // glued suffix — everything after is query/hash
      i = j;
      continue;
    }
    out += raw[i++];
  }
  let p = out.split(/[?#]/)[0]!;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

/**
 * Not links — read here only because they share the `href:` spelling. Each says why.
 * `rail-active.ts` is the sidebar's "which row is lit" table: its `href` is a URL
 * PREFIX matched against the page you are on (`/dashboard/samahan/<group>` lights
 * Home), not a place anybody is sent. Pointing it at the stub's target would stop
 * a group's room lighting its row.
 */
const NOT_A_LINK = new Set(['app/_components/frontdoor/rail-active.ts  /dashboard/samahan']);

const LINK_RES: RegExp[] = [
  /\bhref=\{?\s*["'`]([^"'`]+)["'`]/g,
  /\bhref:\s*["'`](\/[^"'`]*)["'`]/g,
  /router\.(?:push|replace|prefetch)\(\s*["'`]([^"'`]+)["'`]/g,
  /\b(?:redirect|permanentRedirect)\(\s*["'`]([^"'`]+)["'`]/g,
  /\baction=["'](\/[^"']+)["']/g,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dev') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|lab)\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Every `file  raw-link  → new address` that names a retired address. */
export function findOldLinks(): string[] {
  const hits: string[] = [];
  for (const abs of [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))]) {
    const rel = relative(ROOT, abs);
    let src = readFileSync(abs, 'utf8');
    try {
      src = stripComments(src);
    } catch {
      /* unparsable — scan raw */
    }
    for (const re of LINK_RES) {
      for (const m of src.matchAll(re)) {
        const p = linkPath(m[1]!);
        if (!p) continue;
        const to = retiredTarget(p);
        if (to && !NOT_A_LINK.has(`${rel}  ${p}`)) hits.push(`${rel}  ${p}`);
      }
    }
  }
  return [...new Set(hits)].sort();
}

function readBaseline(): string[] {
  return readFileSync(BASELINE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

test('the retired-address list is not empty (the guard is reading real redirects)', () => {
  assert.ok(retiredTarget('/explore'), '/explore must read as retired');
  assert.ok(retiredTarget('/admin/discount-codes'), 'an admin stub must read as retired');
  assert.ok(retiredTarget('/vendor-dashboard/clients'), 'a screen-map stub must read as retired');
  assert.equal(retiredTarget('/vendor-dashboard/clients/x1'), null, 'a real page under a stub is not retired');
  assert.equal(retiredTarget('/admin/events/x1'), null, 'a real admin detail page is not retired');
  assert.equal(linkPath('/dashboard/${id}/studio/patiktok${q ? `?${q}` : ""}'), '/dashboard/x1/studio/patiktok');
});

test('no page links a retired address beyond the baseline (the baseline only shrinks)', () => {
  const found = findOldLinks();
  const base = readBaseline();
  const baseSet = new Set(base);
  const fresh = found.filter((h) => !baseSet.has(h));
  assert.deepEqual(
    fresh,
    [],
    `These links name a retired address. Point them at where it forwards to:\n  ${fresh.join('\n  ')}`,
  );
  const foundSet = new Set(found);
  const stale = base.filter((b) => !foundSet.has(b));
  assert.deepEqual(stale, [], `Fixed — delete these lines from the baseline:\n  ${stale.join('\n  ')}`);
});
