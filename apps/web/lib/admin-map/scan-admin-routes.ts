/**
 * scan-admin-routes.ts — read the admin's own route tree and report every place
 * a person can actually land.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The ⌘K palette searches `ADMIN_NAV_GROUPS` — a hand-curated menu. Its own
 * docblock says it "indexes all 108 admin surfaces"; it indexes the menu, and
 * the menu is smaller than the tree. A page that nobody added to a menu is
 * reachable only by knowing its URL, which is the same as unreachable.
 *
 * 🔑 THE MAP IS SCANNED, NEVER TYPED. The owner asked for a map the assistant
 * can hold (2026-08-26). A hand-written one is wrong the day somebody adds a
 * page, and this repo has already paid for exactly that twice — two vocabularies
 * that drifted apart until a whole surface became unreachable, and a
 * hand-enumerated guard list that was "a list of the doors somebody thought of".
 * So the inventory half of the map comes from the filesystem, and only the
 * WORDS people use for a page stay hand-written (a curated menu label is a
 * product decision; the existence of a page is a fact).
 *
 * ── WHAT A DESTINATION IS ───────────────────────────────────────────────────
 * A folder holding `page.tsx`, minus the two kinds you cannot type your way to:
 *   · **dynamic segments** (`/admin/users/[userId]`) — not a place, a template.
 *     You reach it by picking a row, never by naming it.
 *   · **route groups** (`(shell)`) — a folder that is not part of the URL.
 * Redirect stubs ARE kept, but as ALIASES rather than destinations: ~40 of the
 * admin's routes are stubs forwarding to a tab, and sending somebody to the stub
 * would work while telling them the wrong address for the place they landed.
 *
 * This module touches the filesystem, so it is for the generator and its guard
 * only. Application code imports the generated constant, never this.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

export type AdminRouteKind = 'page' | 'redirect';

export type AdminRoute = {
  /** The URL a person lands on, e.g. `/admin/pricing`. Never has a query. */
  path: string;
  kind: AdminRouteKind;
  /** For `redirect` stubs: where it forwards to, query included when knowable. */
  redirectsTo: string | null;
  /**
   * Does the menu file mention this address at all?
   *
   * 🔑 THE MAP MUST NOT RESURRECT WHAT A FLAG DELIBERATELY HIDES. Some menu
   * entries are wrapped in a feature flag — Live Studio channels is one — so at
   * run time they are absent from the menu while being a deliberate product
   * decision, not an oversight. Comparing the map against the RUNTIME menu reads
   * those as "nobody listed this page" and offers them anyway, quietly
   * overriding the flag. Comparing against the menu's SOURCE tells the two apart:
   * mentioned-but-flagged-off stays hidden, never-mentioned gets surfaced.
   */
  inMenuSource: boolean;
};

/** Folders that hold a `page.tsx`, deepest-last, deterministic order. */
function routeDirs(adminRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    if (entries.includes('page.tsx')) out.push(dir);
    for (const name of entries) {
      // `_components` / `_surfaces` are private folders, never routes; a
      // node_modules under app/ would be a packaging accident either way.
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch {
        /* unreadable — nothing to walk */
      }
    }
  };
  walk(adminRoot);
  return out.sort();
}

/**
 * Folder path → URL path. Route groups drop out; a private folder can never
 * appear here because it holds no `page.tsx`.
 */
export function urlPathFor(routeDir: string, adminRoot: string): string {
  const rel = relative(adminRoot, routeDir).split(sep).filter(Boolean);
  const segments = rel.filter((s) => !(s.startsWith('(') && s.endsWith(')')));
  return '/admin' + (segments.length ? '/' + segments.join('/') : '');
}

/**
 * Pull the forwarding target out of a redirect stub.
 *
 * Three shapes ship in this admin, and all three matter:
 *   redirect('/admin/pricing?tab=price-bands')           — the literal
 *   redirect(`/admin/pricing?tab=price-bands`)           — a literal template
 *   out.set('tab', 'funnels'); redirect(`/admin/app-performance?${out}`)
 *
 * The third is the common one — a stub forwards its own search params on — so
 * the path comes from the template and the tab from the `.set('tab', …)` that
 * precedes it. 🪤 The receiving variable is NOT always called `params`: it is
 * `out` on the pricing and app-performance stubs, and a first cut that matched
 * `params.set` alone silently dropped the tab from 14 of 44 stubs and sent
 * "price bands" to the top of the pricing page instead of to its own tab. Match
 * the CALL, never a remembered variable name.
 *
 * Anything else returns the bare path: a path we can prove beats a query we
 * invented.
 */
export function redirectTargetIn(source: string): string | null {
  const src = stripComments(source);

  // The literal forms first — if the author wrote the whole address, use it.
  const literal = src.match(/redirect\(\s*['`](\/[^'`${]*)['`]\s*\)/);
  if (literal?.[1]) return literal[1];

  const template = src.match(/redirect\(\s*`(\/[^`${]*)/);
  if (!template) return null;
  const raw = template[1] ?? '';
  // A template may already carry a literal query before its ${…} — but ONLY if
  // that query has a value in it. 🪤 Nearly every stub here ends `…?${out}`, so
  // testing for a bare '?' claimed a literal query that was really the seam
  // before the interpolation, returned early, and skipped the tab lookup below:
  // 24 of 41 stubs lost their tab and pointed at the top of the parent page.
  if (/\?[^=]*=/.test(raw)) return raw.replace(/[?&]$/, '');

  const path = raw.replace(/[?&]$/, '').replace(/\/+$/, '');
  const tab = src.match(/\.set\(\s*'tab'\s*,\s*'([^']+)'\s*\)/);
  return tab ? `${path}?tab=${tab[1]}` : path;
}

/**
 * Does this page RENDER anything?
 *
 * 🔑 A PAGE THAT CALLS `redirect()` IS NOT A REDIRECT STUB. Every admin page
 * that guards its own door calls `redirect('/login')` for a signed-out caller —
 * `subscriptions`, `integrations` and the compliance data-sheet all do — and a
 * first cut read all three as stubs, which would have deleted three real
 * destinations from the map and pointed anyone searching for them at the sign-in
 * screen. The honest difference is that a stub renders NOTHING: no JSX ever
 * leaves it. Same family as every other guard here — ask what the thing DOES,
 * never what word appears in it.
 */
function rendersJsx(source: string): boolean {
  return /<[A-Za-z][A-Za-z0-9.]*[\s/>]/.test(stripComments(source));
}

/**
 * Scan the admin tree. `adminRoot` is the `app/admin` directory.
 *
 * Sorted by path so the generated file has a stable diff — a generated artifact
 * whose order wobbles produces review noise and trains people to skim it.
 */
export function scanAdminRoutes(adminRoot: string, navGroupsFile?: string): AdminRoute[] {
  // Read the menu's source once. Absent file → every route reads as unmentioned,
  // which is the safe direction for a generator (it offers more, never less).
  let menuSource = '';
  try {
    menuSource = stripComments(
      readFileSync(navGroupsFile ?? join(adminRoot, '_components/admin-nav-groups.tsx'), 'utf8'),
    );
  } catch {
    /* no menu file — treat nothing as mentioned */
  }

  const routes: AdminRoute[] = [];
  for (const dir of routeDirs(adminRoot)) {
    const path = urlPathFor(dir, adminRoot);
    // A template, not a place. Recorded nowhere on purpose: a destination list
    // containing `/admin/users/[userId]` would offer a link that 404s.
    if (path.includes('[')) continue;

    const source = readFileSync(join(dir, 'page.tsx'), 'utf8');
    const target = redirectTargetIn(source);
    // A stub forwards and draws nothing. A real page may also redirect (its own
    // auth door) and still be a destination — see rendersJsx.
    const isStub = target !== null && !rendersJsx(source);
    routes.push({
      path,
      kind: isStub ? 'redirect' : 'page',
      redirectsTo: isStub ? target : null,
      // Quoted, so `/admin/venues` can never be matched by `/admin/venues/new`.
      inMenuSource: menuSource.includes(`'${path}'`) || menuSource.includes(`"${path}"`),
    });
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}
