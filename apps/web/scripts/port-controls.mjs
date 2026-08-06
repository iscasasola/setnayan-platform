#!/usr/bin/env node
/**
 * port-controls.mjs — extract every WAY OUT of a route, so a redesign cannot
 * quietly remove one.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The ~40-unit design port rewrites real screens to match an approved archetype.
 * An audit on 2026-08-06 found 76 confirmed capabilities the archetypes do not
 * account for, and then PROVED that nothing would catch their loss: two real
 * controls were deleted from the couple's guest page ("Invite guests" and
 * "Arrange the room") on a clean origin/main, and all twelve lint scripts,
 * typecheck and Lighthouse passed BYTE-IDENTICALLY.
 *
 * That is structural, not an oversight:
 *   · there is no render harness in this repo at all — `tsx --test` over ~620
 *     files, no testing-library, no jsdom. No test can observe what a page DRAWS.
 *   · ~14% of pages (57 of 404) are named in any test, mostly for one flag or
 *     one copy string, never for an inventory of their controls.
 *   · every existing guard is ADDITION-shaped — masthead, radius, legibility,
 *     nested-form, nav-icon all fire on a wrong thing ADDED, and the exposure
 *     freeze passes narrowings on purpose. **A port removes.**
 *
 * And it has already happened once: the /panood port dropped the YouTube API
 * Services disclosure — the compliance paragraph Live Studio's Google review
 * depends on — and a MANUAL DIFF caught it, not CI.
 *
 * ── WHAT IS EXTRACTED, AND WHAT IS DELIBERATELY NOT ─────────────────────────
 * Extracted: where a person can GO (hrefs), what they can DO (server actions
 * bound to a form), and route-builder references. Nothing about layout, spacing,
 * type, colour or copy — those are the archetype's job and MUST be free to
 * change, or the guard would block the very work it is protecting.
 *
 * 🔑 THE QUERY STRING IS PART OF THE KEY. The repo's other href normaliser
 * (scripts/lint-email-links.mjs) strips `?query` on purpose — it asks "does a
 * page exist at this path", and Next.js does not dispatch on the query. This
 * guard asks a different question, so it keeps the query: the filter pills on
 * the Guests and Explore pages are <Link>s rewriting the SAME path with
 * different params. Normalising the query away would let an entire filter row
 * disappear without a single key changing.
 *
 * 🔑 READ THE FOLDER, NOT THE FILE. Heroes, toolbars and row-action menus live
 * in sibling `_components/`. A guard that read only page.tsx would miss most of
 * what a page offers. Nested routes are excluded — a child route owns its own
 * controls and gets its own baseline entry.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Dynamic segments collapse so `/x/${id}` and `/x/${eventId}` are one key. */
export function normalizeHref(raw) {
  return (
    raw
      .replace(/\$\{[^}]*\}/g, '[seg]')
      // Drop the hash: an in-page anchor is a scroll position, not a destination,
      // and anchor sets legitimately change when a page is re-sectioned.
      .split('#')[0]
      .trim()
  );
}

/**
 * Every non-test source file belonging to THIS route.
 *
 * ⚠ THIS IS NOT AN ARBITRARY WALK, AND THE FIRST VERSION WAS. Walking every
 * non-route subdirectory made the ROOT route `/` claim the whole of
 * `app/_components/**` — hundreds of files shared by every screen in the
 * product. Its entry ballooned, and worse, it swallowed other routes' controls,
 * so deleting a real control elsewhere still "passed" because some shared
 * component elsewhere mentioned the same destination. A guard that absorbs
 * everything asserts nothing.
 *
 * The rule is the convention this codebase actually uses: a route owns its own
 * directory, plus `_components/` and `_lib/` DIRECTLY beneath it (that is where
 * heroes, toolbars and row-action menus live — reading only page.tsx would miss
 * most of what a page offers). Those private folders are walked in full, since
 * they nest freely. Nothing else is claimed.
 *
 * At the app root those same folder names are app-wide and belong to no single
 * route, so `/` gets only its own files.
 */
const PRIVATE_SUBDIRS = new Set(['_components', '_lib']);

export function routeSourceFiles(routeDir, { isAppRoot = false } = {}) {
  const out = [];
  const isSource = (name) =>
    /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts');

  const filesIn = (dir) => {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  };
  const isDir = (p) => {
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  };

  // Own files.
  for (const name of filesIn(routeDir)) {
    const full = join(routeDir, name);
    if (!isDir(full) && isSource(name)) out.push(full);
  }

  // Private folders, walked in full — but never at the app root, where the same
  // names mean "shared by the whole product".
  if (!isAppRoot) {
    const walkAll = (dir) => {
      for (const name of filesIn(dir)) {
        const full = join(dir, name);
        if (isDir(full)) walkAll(full);
        else if (isSource(name)) out.push(full);
      }
    };
    for (const name of filesIn(routeDir)) {
      const full = join(routeDir, name);
      if (isDir(full) && PRIVATE_SUBDIRS.has(name)) walkAll(full);
    }
  }

  return out.sort();
}

const HREF_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\}|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;
const ACTION_RE = /\b(?:form)?[aA]ction\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/g;
/**
 * The `routes` builder from lib/routes.ts — the repo's own "no hand-typed
 * paths" guardrail. Two things this pattern had to learn the hard way:
 *
 *  1. It must be a CALL. Without the trailing `(`, the string `routes.ts` — a
 *     FILENAME in a comment or an import path — was recorded as a control.
 *  2. THE BUILDER IS NESTED: `routes.dashboard.guests.index(id)`, not
 *     `routes.guests(id)`. A one-level pattern matched NOTHING, and because
 *     these appear as `href={routes.dashboard.budget(id)}` — an expression, not
 *     a string literal — the href extractor cannot see them either. The result
 *     was that the Suite hub, roughly twenty tiles, recorded ZERO controls and
 *     the guard protected nothing on it.
 *
 * So the whole dotted chain is captured, and it is the identity of the control.
 */
const ROUTES_RE = /\broutes((?:\.[A-Za-z_$][\w$]*)+)\s*\(/g;

/**
 * Pull the control set out of one file's source.
 *
 * Only ABSOLUTE in-app destinations are kept. An external `https://` link is a
 * marketing decision, not a way out of the app, and would make the baseline
 * churn on every copy edit. A bare `#` is not a destination either.
 */
export function extractControls(source) {
  const destinations = new Set();
  const actions = new Set();

  for (const m of source.matchAll(HREF_RE)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '';
    const href = normalizeHref(raw);
    if (!href.startsWith('/')) continue;
    destinations.add(href);
  }
  for (const m of source.matchAll(ACTION_RE)) actions.add(m[1]);
  for (const m of source.matchAll(ROUTES_RE)) actions.add(`routes${m[1]}`);

  return { destinations, actions };
}

/** The control set for a whole route folder, merged across its files. */
export function controlsForRoute(routeDir, appRoot) {
  const destinations = new Set();
  const actions = new Set();
  const files = routeSourceFiles(routeDir, { isAppRoot: routeDir === appRoot });
  for (const f of files) {
    const { destinations: d, actions: a } = extractControls(readFileSync(f, 'utf8'));
    d.forEach((x) => destinations.add(x));
    a.forEach((x) => actions.add(x));
  }
  return {
    files: files.map((f) => relative(appRoot, f).split(sep).join('/')).sort(),
    destinations: [...destinations].sort(),
    actions: [...actions].sort(),
  };
}

/** Every route folder under `appRoot` (one entry per page.tsx). */
export function allRouteDirs(appRoot) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    if (entries.includes('page.tsx')) out.push(dir);
    for (const name of entries) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch {
        /* unreadable — nothing to walk */
      }
    }
  };
  walk(appRoot);
  return out.sort();
}

/** routeKey — the URL-ish path a human recognises, e.g. `/dashboard/[eventId]/guests`. */
export function routeKey(routeDir, appRoot) {
  const rel = relative(appRoot, routeDir).split(sep).join('/');
  return '/' + rel;
}

export function buildBaseline(appRoot) {
  const routes = {};
  for (const dir of allRouteDirs(appRoot)) {
    const key = routeKey(dir, appRoot);
    routes[key] = controlsForRoute(dir, appRoot);
  }
  return routes;
}
