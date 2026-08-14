/**
 * command-escape.ts — the row that hands what you typed to the marketplace.
 *
 * ⚠ ITS OWN FILE BECAUSE `command-data.ts` IS `server-only`. This function is
 * called by the palette on the CLIENT, from the live query, so it cannot sit
 * beside the index that builds the rest of the list. Importing a `server-only`
 * module from a client component is a build error, not a runtime surprise —
 * but the reason it is split is worth stating, because the obvious tidy-up
 * (fold it back in) breaks the build for a reason the diff will not show.
 *
 * ─── WHY THERE IS AN ESCAPE ROW AT ALL ───────────────────────────────────
 * One shell means one top bar, and one top bar means ONE search. The two that
 * existed answered different questions — the front door's box searched the
 * SUPPLIER MARKETPLACE, the launcher's palette searched YOUR OWN THINGS — and
 * the palette won, because every surface the shared bar mounts on is inside
 * the person's own app.
 *
 * 🔑 THE PALETTE CAN CARRY THE MARKETPLACE; THE MARKETPLACE COULD NEVER HAVE
 * CARRIED THE PALETTE. A GET form to /explore has no way to reach your own
 * wedding, so picking it would have deleted an existing door to make the bar
 * consistent. This row is what makes the choice lossless.
 */
import type { HomeCommandItem } from '@/app/dashboard/(launcher)/_components/home-command-bar';

/**
 * ⚠ NOT A FILTERED ROW — the caller appends it AFTER filtering, deliberately.
 * A row offering to search the marketplace for "xyzzy" that vanishes because
 * nothing local matches "xyzzy" would disappear at exactly the moment it
 * exists for: when the palette has nothing of yours to show.
 *
 * Returns null on an empty query, so a palette nobody has typed into is a list
 * of your own things rather than an advert.
 */
export function marketplaceEscapeItem(query: string): HomeCommandItem | null {
  const q = query.trim();
  if (!q) return null;
  return {
    id: 'action-explore-query',
    label: `Find suppliers for “${q}”`,
    sublabel: 'Search the marketplace',
    href: `/explore?q=${encodeURIComponent(q)}`,
    kind: 'action',
    icon: 'store',
  };
}
