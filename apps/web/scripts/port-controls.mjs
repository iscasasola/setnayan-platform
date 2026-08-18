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

/**
 * Blank out comments so PROSE ABOUT a control can never be mistaken for the
 * control itself.
 *
 * 🪤 THIS WAS A LIVE HOLE, FOUND BY SABOTAGE. Deleting `<EventDashboard …>` from
 * the couple's dashboard — the entire body of the page — PASSED. The name still
 * appeared in four docblocks across the route folder (`loading.tsx` says its
 * shape "mirrors the <EventDashboard> render order", the page explains what
 * <EventDashboard> owns, and the component's own header names itself), so the
 * set never changed. **The richer a file's comments, the less its widgets were
 * protected** — precisely backwards, and it would have been worst on exactly the
 * heavily-documented surfaces this repo cares most about.
 *
 * This file already knew the disease in a milder form: the `routes` pattern
 * carries a note that the string `routes.ts` in a comment was once recorded as a
 * control, fixed by demanding a trailing `(`. That fix was per-pattern; this one
 * is at the source, so every extractor gets it.
 *
 * Characters are replaced with spaces rather than deleted so byte offsets — and
 * therefore any future line reporting — stay true.
 *
 * ⚠ IT MUST BE STRING-AWARE. A naive `//` strip eats the rest of the line from
 * inside `href="https://…"`, silently truncating real source. So this walks the
 * text tracking quotes, template literals and escapes, which is why it is a
 * small lexer and not a regex.
 */
export function stripComments(source) {
  const out = source.split('');
  let i = 0;
  const n = source.length;
  let quote = null; // "'" | '"' | '`'
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (quote) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      i += 1;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') out[i++] = ' ';
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      while (i < stop) {
        if (source[i] !== '\n') out[i] = ' ';
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return out.join('');
}

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
/**
 * ⚠ WIDENED 2026-08-17 — `_surfaces` WAS MISSING, AND IT COST 41 FILES.
 *
 * The docblock above is right about why an arbitrary walk was wrong (the root
 * route swallowed `app/_components/**` and absorbed other routes' controls), and
 * then it named TWO private-folder conventions where this codebase uses THREE.
 * Measured before the fix: 41 `_surfaces/*.tsx` files under `app/admin`, and ALL
 * 41 absent from the baseline. `/admin/studio` recorded `destinations: []` and
 * `actions: []` while its thirteen surfaces carried six real destinations and
 * five server actions; `/admin/accounts` the same.
 *
 * So for every tab-hub route the guard has never protected anything — and it did
 * not cry wolf about it, it said nothing, which is indistinguishable from a clean
 * pass. Found while four sessions were porting exactly those files.
 *
 * 🔑 A GUARD'S REACH IS SET BY ITS LIST, NOT BY ITS RULES. This is the same shape
 * as the hand-enumerated door list that missed three doors, and the `CONVERTED`
 * list that could be silently shortened: a list deciding WHAT gets checked has to
 * be pinned to something measured, or it narrows without a word. Any future
 * private-folder convention must be added here in the same commit that
 * introduces it.
 */
const PRIVATE_SUBDIRS = new Set([
  '_components',
  '_lib',
  // Added 2026-08-17. MEASURED, not guessed — and fixing only `_surfaces` would
  // have been a correction at one site, which is not a correction:
  '_surfaces', // 41 files under app/admin alone, ALL absent — this was the costly one
  '_sections', // 10 files, 4 carrying a literal destination (+3 after the fix)
  '_actions', //  15 files · see the correction below — contributes ZERO
  '_shared', //   2 files · same, contributes zero
  //
  // 🛑 A CORRECTION TO MY OWN REASONING, LEFT HERE BECAUSE THE MISTAKE IS THE
  // USEFUL PART. I added `_actions` believing 15 files of `'use server'` were
  // "invisible actions". MEASURED BEFORE AND AFTER: adding it changed the action
  // count by ZERO (579 → 579). Actions are counted where a form USES them —
  // `action={doThing}` in the route's own tree — not where they are DEFINED, so an
  // unwalked definition file hides nothing. Correct fact, invented consequence.
  // `_actions` and `_shared` stay in the set because they are harmless and a
  // future destination in them WOULD count, but they are not load-bearing and
  // nobody should cite them as a fix for anything.
  // The real numbers: destinations 796 → 849, actions 526 → 579, nothing lost.
  // DELIBERATELY NOT INCLUDED, each measured to carry no control at all:
  //   _data    — 9 files, 0 destinations, 0 'use server'
  //   _styles  — 0 files ·  _fonts — 0 files
  // If any of those ever gains a link or an action, it belongs above and
  // `port-guard-reach.test.ts` is what will tell you.
]);

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

/**
 * ── BLOCKS: the widget inventory (added 2026-08-08) ─────────────────────────
 *
 * The owner's question, verbatim: *"should we have a prototype first? make sure
 * all widgets are there?"*
 *
 * Controls answered half of it. A destination and a bound action are what a
 * person can DO — and a missing one is LOUD, because somebody cannot get
 * somewhere. What nothing watched was whether a redesigned page still SHOWS the
 * same things. That failure is silent: the page looks finished and simply tells
 * you less. It has already happened here once — the /panood port dropped the
 * YouTube API Services disclosure, a compliance paragraph with no link and no
 * action in it, so a controls-only guard could never have seen it.
 *
 * 🔑 A BLOCK IS THE UNIT THE OWNER MEANS BY "WIDGET". Not a sentence, not a
 * number — a rendered component. If the vendor Overview stops rendering its
 * upcoming-schedules panel, that panel is gone whatever the copy says.
 * Components are also the one identity a restyle does NOT disturb: the whole
 * point of the port is that `VendorEnergyStats` keeps its name while every
 * pixel inside it changes.
 *
 * ⚠ ICONS ARE EXCLUDED, AND THIS IS THE DIFFERENCE BETWEEN A GUARD AND NOISE.
 * Icons are capitalised JSX elements too, and swapping one is exactly the kind
 * of thing a restyle is SUPPOSED to do. Left in, the guard would fire on nearly
 * every port unit, and a guard that cries wolf teaches you to skim past the one
 * time it is right. They are identified by their IMPORT SOURCE rather than by a
 * name list, so a new icon package is covered without anyone remembering to add
 * its names.
 *
 * Deliberately NOT extracted: prose, numbers, and data property paths. A port
 * rewrites copy by design, and the specs retire real numbers on purpose (the
 * vendor bento's 90-day countdown ratio "dies with the ring"). Locking those
 * would block the very work this protects. The block is the largest unit that
 * is still honest.
 */
const ICON_SOURCES = /^(lucide-react|react-icons|@heroicons|@radix-ui\/react-icons)/;
const IMPORT_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
const JSX_EL_RE = /<([A-Z][\w$]*(?:\.[A-Z][\w$]*)?)[\s/>]/g;

/**
 * ⚠ WIDENED 2026-08-13 (second time, same disease as ACTION_EXPR_RE below).
 * This used to require the JSX ATTRIBUTE form, `href="/pricing"`. The doorway
 * port moved every public product page onto a shared kit that takes its links
 * as DATA — `primary={{ href: '/pricing', label: 'See pricing' }}` — and an
 * object property is `href:` not `href=`, so the extractor saw nothing.
 *
 * The consequence is the one this file already warns about for actions, and it
 * had already happened: five ported doorways were baselined with
 * `"destinations": []`. Their real links were not lost — they render fine — but
 * the guard's memory of them was, so deleting "See pricing" from any of those
 * pages would have passed CI in silence. The sanctioned fix for a reported loss
 * is to regenerate the baseline, which is precisely how a blind spot becomes a
 * recorded lie the guard then defends.
 *
 * `[:=]` covers both. A TYPE declaration (`href: string`) cannot match — the
 * value has to be a quoted literal.
 */
/**
 * ⚠ WIDENED 2026-08-17 — A DESTINATION HANDED TO A SHARED COMPONENT IS STILL A
 * DESTINATION. `PageMasthead` takes `back="/admin/demo-vendors"` and renders the
 * `<Link href={back}>` itself, so requiring the literal token `href` made every
 * back link invisible the moment a page adopted the shared masthead — and the
 * sanctioned response to a reported "loss" is to regenerate, which would have
 * written a route down as having ZERO destinations and then defended that lie.
 * Exactly the failure the ACTION_EXPR_RE docblock below already warns about, one
 * prop later.
 *
 * The prop list is measured, not guessed: `back` · `backHref` · `returnTo` ·
 * `cancelHref` are the props carrying a literal route in this codebase today. A
 * TYPE declaration still cannot match — the value has to be a quoted literal.
 */
const HREF_RE = /\b(?:href|back|backHref|returnTo|cancelHref)\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\}|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;
/**
 * A bound server action.
 *
 * ⚠ WIDENED 2026-08-13. It used to require a BARE identifier —
 * `action={signInWithPassword}` — so the moment a form chose its action
 * conditionally, `action={inPlace ? submitInPlace : signInWithPassword}`, the
 * extractor saw NOTHING and reported the route as having lost the action it
 * still runs. That is worse than a miss: the sanctioned fix for a "loss" is to
 * regenerate the baseline, so a blind spot here gets written down as a
 * DELIBERATE REMOVAL THAT NEVER HAPPENED, and the guard then defends the lie.
 *
 * Now it also reads the two BRANCHES of a ternary.
 *
 * ⚠ AND ONLY THOSE. The first cut of this widening recorded EVERY identifier
 * inside the braces, which is over-capture — safe in the missing→fail /
 * added→pass sense, but it wrote `null`, `p`, `id` and `bind` into the
 * baseline as if they were controls. A guard whose baseline is full of noise
 * is one people learn to skim, and this repo has already paid for a guard that
 * cried wolf. Two shapes, both real, nothing else:
 *     action={doThing}
 *     action={cond ? doThisThing : doThatThing}
 */
const ACTION_EXPR_RE = /\b(?:form)?[aA]ction\s*=\s*\{([^{}]*)\}/g;
const BARE_IDENT_RE = /^\s*([A-Za-z_$][\w$]*)\s*$/;
const TERNARY_RE = /^\s*[^?]+\?\s*([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\s*$/;
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
export function extractControls(rawSource) {
  // Every pattern below runs against comment-free text — see stripComments.
  const source = stripComments(rawSource);
  const destinations = new Set();
  const actions = new Set();

  for (const m of source.matchAll(HREF_RE)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '';
    const href = normalizeHref(raw);
    if (!href.startsWith('/')) continue;
    destinations.add(href);
  }
  for (const m of source.matchAll(ACTION_EXPR_RE)) {
    const expr = m[1];
    const bare = BARE_IDENT_RE.exec(expr);
    if (bare?.[1]) {
      actions.add(bare[1]);
      continue;
    }
    const ternary = TERNARY_RE.exec(expr);
    if (ternary?.[1] && ternary[2]) {
      actions.add(ternary[1]);
      actions.add(ternary[2]);
    }
  }
  for (const m of source.matchAll(ROUTES_RE)) actions.add(`routes${m[1]}`);

  return { destinations, actions, blocks: extractBlocks(source) };
}

/**
 * The blocks one file renders — capitalised JSX elements, minus anything the
 * same file imported from an icon package.
 *
 * The icon filter is per-file on purpose: `Calendar` is a lucide icon in one
 * component and could be a real panel in another, so a global name list would
 * be wrong in both directions. Import source is the only honest discriminator.
 */
export function extractBlocks(maybeRaw) {
  // Safe when called directly: stripping twice is a no-op, since the first pass
  // leaves only spaces where comments were.
  const source = stripComments(maybeRaw);
  const icons = new Set();
  for (const m of source.matchAll(IMPORT_RE)) {
    if (!ICON_SOURCES.test(m[2])) continue;
    for (const spec of m[1].split(',')) {
      // `Store`, `Store as ShopIcon`, `type Foo` — the LOCAL name is what JSX uses.
      const local = spec.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim();
      if (local) icons.add(local);
    }
  }

  const blocks = new Set();
  for (const m of source.matchAll(JSX_EL_RE)) {
    const name = m[1];
    // `Foo.Bar` — judge it by its root, which is what the import named.
    if (icons.has(name.split('.')[0])) continue;
    blocks.add(name);
  }
  return blocks;
}

/** The control set for a whole route folder, merged across its files. */
export function controlsForRoute(routeDir, appRoot) {
  const destinations = new Set();
  const actions = new Set();
  const blocks = new Set();
  const files = routeSourceFiles(routeDir, { isAppRoot: routeDir === appRoot });
  for (const f of files) {
    const { destinations: d, actions: a, blocks: b } = extractControls(readFileSync(f, 'utf8'));
    d.forEach((x) => destinations.add(x));
    a.forEach((x) => actions.add(x));
    b.forEach((x) => blocks.add(x));
  }
  return {
    files: files.map((f) => relative(appRoot, f).split(sep).join('/')).sort(),
    destinations: [...destinations].sort(),
    actions: [...actions].sort(),
    blocks: [...blocks].sort(),
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
