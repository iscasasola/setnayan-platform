/**
 * admin-destinations.ts — everywhere ⌘K can send you, menu and map together.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The palette's own docblock says it "indexes all 108 admin surfaces". It
 * indexed the MENU — 78 curated items — and the menu is smaller than the tree.
 * The owner asked for a map the assistant can hold (2026-08-26); this is its
 * first half, and it makes the palette's existing claim true instead of hopeful.
 *
 * Two sources, deliberately different in kind:
 *   · **the menu** — a product decision about what deserves a name and a drawer.
 *     Hand-written, and it stays hand-written.
 *   · **the map** — scanned from the route tree, so it cannot go stale by hand.
 *     A page's EXISTENCE is a fact, not a decision.
 *
 * ── WHAT THE MAP ADDS ───────────────────────────────────────────────────────
 * 1. **Pages nobody put in a menu.** Reachable today only by knowing the URL,
 *    which is the same as unreachable.
 * 2. **Words for pages that moved.** ~40 admin routes are stubs forwarding to a
 *    tab: /admin/songs now lives at /admin/studio?tab=songs. The old address is
 *    still what a person types, so it becomes a SEARCH WORD on the destination
 *    it forwards to — never a destination itself, because sending somebody to
 *    the stub would work while telling them the wrong address for where they
 *    landed.
 *
 * ── WHAT THE JOBS ADD ───────────────────────────────────────────────────────
 * A page is also findable by the WORK done on it. Every admin job names itself
 * and the fields it asks for — `createCanonicalLeaf` reads tile_id, faith,
 * refinement_label — so those words join the haystack of the page that owns the
 * job. Typing "refinement" or "faith" now finds Taxonomy; before, only the
 * page's own name and its one-line description could match.
 *
 * ⚠ THIS DOES NOT MAKE "add a new category" WORK, and it is not meant to. The
 * code's words are the code's ("create canonical leaf"), and a person's words
 * are their own. Closing that gap is the assistant's job, not a synonym list —
 * this palette's own notes already warn that a synonym list trying to be
 * complete becomes a second vocabulary to maintain, and this project has paid
 * for two vocabularies drifting apart.
 *
 * 🔑 THE MENU ALWAYS WINS. Map-only destinations score in a lower band, so
 * typing "pay" still lands on Payments and never on some page whose folder
 * happens to start with the same letters. A map that reorders a curated menu
 * would be a regression wearing a feature's clothes.
 */

import { ADMIN_JOBS } from '@/lib/admin-map/admin-jobs.generated';
import { ADMIN_ROUTES } from '@/lib/admin-map/admin-routes.generated';

import { ADMIN_NAV_GROUPS } from './admin-nav-groups';
import { ADMIN_NAV_DESCRIPTIONS, ADMIN_NAV_ALIASES } from './admin-nav-descriptions';

export type Dest = {
  label: string;
  href: string;
  group: string;
  /** Everything this destination can be matched on, lowercased. */
  hay: string;
  /** `menu` keeps full ranking; `map` and `row` are banded below it. */
  source: 'menu' | 'map' | 'row';
};

/**
 * A thing INSIDE a page — a price row today. Passed in from the server, because
 * rows come from the database and a client component cannot read it.
 */
export type RowDest = { label: string; href: string; hay: string; hint: string };

/**
 * `/admin/booking-fees` → `Booking fees`; `/admin/venues/new` → `Venues · New`.
 * The folder is the only name an unlisted page has, and the last segment alone
 * is not enough — two different pages both end in `new`, and a palette offering
 * "New" twice tells you nothing about which is which.
 */
export function labelFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean).slice(1); // drop 'admin'
  if (!segments.length) return 'Admin';
  return segments
    .map((s) => {
      const words = s.replace(/-/g, ' ');
      return words.charAt(0).toUpperCase() + words.slice(1);
    })
    .join(' · ');
}

/** The path half of an href, so `/admin/pricing?tab=x` matches a scanned route. */
function pathOf(href: string): string {
  return href.split('?')[0] ?? href;
}

export function buildDestinations(rows: readonly RowDest[] = []): Dest[] {
  const out: Dest[] = [];
  const byHref = new Map<string, Dest>();
  const coveredPaths = new Set<string>();

  for (const g of ADMIN_NAV_GROUPS) {
    for (const item of g.items) {
      if (!item.href) continue;
      const dest: Dest = {
        label: item.label,
        href: item.href,
        group: g.label,
        hay: [
          item.label,
          g.label,
          ADMIN_NAV_DESCRIPTIONS[item.key] ?? '',
          ADMIN_NAV_ALIASES[item.key] ?? '',
        ]
          .join(' ')
          .toLowerCase(),
        source: 'menu',
      };
      out.push(dest);
      byHref.set(item.href, dest);
      coveredPaths.add(pathOf(item.href));
    }
  }

  for (const route of ADMIN_ROUTES) {
    if (route.kind === 'redirect') {
      // The old address becomes a word on whatever it forwards to. Attach by the
      // exact href first (that is the tab the stub actually opens), then fall
      // back to any menu item on the same page.
      const target = route.redirectsTo ?? '';
      const host =
        byHref.get(target) ??
        out.find((d) => d.source === 'menu' && pathOf(d.href) === pathOf(target));
      if (host) {
        const word = ` ${route.path.toLowerCase()} ${labelFromPath(route.path).toLowerCase()}`;
        if (!host.hay.includes(word.trim())) host.hay += word;
      }
      continue;
    }

    // Mentioned by the menu file but absent at run time = a flag is holding it
    // back on purpose. Not ours to reopen.
    if (route.inMenuSource) continue;
    if (coveredPaths.has(route.path)) continue;

    const label = labelFromPath(route.path);
    out.push({
      label,
      href: route.path,
      group: 'Everything else',
      hay: `${label} ${route.path}`.toLowerCase(),
      source: 'map',
    });
    coveredPaths.add(route.path);
  }

    // 🪤 THIS RUNS LAST, AND THE ORDER IS THE POINT. It was written above the
  // route loop first, so any job living on a page the MAP had added — and not
  // the menu — found no destination yet and its words were dropped on the floor:
  // three jobs on the demo-vendor inquiries screen, silently unsearchable.
  //
  // A job's words belong to the page you would OPEN to do it — the scan's
  // resolvedPath, then through redirects. Both hops are needed and for different
  // reasons: ~40 owner folders are stubs now (/admin/users/actions.ts drives a
  // page that lives at /admin/accounts?tab=users), and five jobs sit in a folder
  // with no page at all (their screen moved into a Studio tab). Attaching to
  // either would put the words on somewhere nobody is ever sent.
  const redirectByPath = new Map(
    ADMIN_ROUTES.filter((r) => r.kind === 'redirect').map((r) => [r.path, r.redirectsTo ?? '']),
  );
  for (const job of ADMIN_JOBS) {
    const target = redirectByPath.get(job.resolvedPath) ?? job.resolvedPath;
    const host =
      byHref.get(target) ?? out.find((d) => pathOf(d.href) === pathOf(target));
    if (!host) continue;
    const words = [job.phrase, ...job.fields.map((f) => f.replace(/_/g, ' '))].join(' ');
    host.hay += ` ${words.toLowerCase()}`;
  }

  // Rows last, and banded lowest. A page is almost always the better answer to a
  // vague query; a row wins only when its own words are what you typed.
  for (const r of rows) {
    out.push({
      label: r.label,
      href: r.href,
      group: r.hint === 'price' ? 'Prices' : 'Prices · off sale',
      hay: r.hay.toLowerCase(),
      source: 'row',
    });
  }

  return out;
}
