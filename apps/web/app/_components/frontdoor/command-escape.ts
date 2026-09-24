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
import { SEARCH_SCOPES, type SearchScope } from '@/lib/search-scope';

/**
 * ⚠ NOT A FILTERED ROW — the caller appends it AFTER filtering, deliberately.
 * A row offering to search the marketplace for "xyzzy" that vanishes because
 * nothing local matches "xyzzy" would disappear at exactly the moment it
 * exists for: when the palette has nothing of yours to show.
 *
 * Returns null on an empty query, so a palette nobody has typed into is a list
 * of your own things rather than an advert.
 */
export function marketplaceEscapeItem(
  query: string,
  /**
   * WHERE THE SEARCHER IS STANDING (owner 2026-09-23 — "the search searches
   * the place you are standing in"). Defaults to the widest scope, so every
   * caller that has not been taught about scopes keeps its shipped behaviour
   * byte for byte.
   *
   * 🔑 THIS ROW IS WHAT MAKES NARROWING SAFE. A box that quietly searches less
   * than the whole product is only honest if the way OUT travels with what you
   * already typed — otherwise the first person whose thing is one level up has
   * to notice the scope, clear the box, navigate, and type again. Shopee's
   * shop search is bearable for exactly this reason.
   */
  scope: SearchScope = SEARCH_SCOPES.discover,
): HomeCommandItem | null {
  const q = query.trim();
  if (!q) return null;
  /*
    ⚠ NAME KEPT, DESTINATION LONG SINCE MOVED. This is no longer "the
    marketplace row" — it lands on `/`, which answers suppliers, stories and
    guides in its own body (see the note on `href` below). Renaming it is a
    real cleanup and deliberately NOT folded into the scope change, so the
    behaviour diff stays reviewable on its own.
  */
  const widest = scope.widerKey === null;
  return {
    id: 'action-explore-query',
    /*
      🔑 THE ROW UNDERSOLD THE PAGE IT OPENS, AND THAT WAS THE WHOLE DEFECT.
      This said "Find suppliers for X" / "Search the marketplace" — so a
      signed-in person looking for a GUIDE or a STORY had no reason to press
      it, and concluded the search box could not reach our writing at all. The
      owner concluded exactly that on 2026-08-20 and proposed deleting the
      Stories and Articles chips because *"the search bar on top will handle
      those"* — a sentence that was true of the DESTINATION and false of the
      only row offering it.

      `/explore?q=` has answered all three since 2026-08-15: the marketplace
      query resolves `suppliers`, and `searchReads` resolves `stories` and
      `guides` into a "Stories and guides" section on the same page. Verified
      live 2026-08-20 — `?q=doves` returns the doves guide, and `?q=mobile bar`
      the mobile-bar guide.

      ⚠ THAT WAS A LABEL FIX. THE DESTINATION MOVED LATER THE SAME DAY, and
      this is that change: the row now lands on the FRONT DOOR, which answers
      in its own body. The label above was true of /explore and is true of `/`
      — the front page resolves stories and guides in full, matches the shops
      it already publishes, and carries a permanent row handing the same words
      to the marketplace for the search only it can do.

      🔑 WHY THE DESTINATION HAD TO MOVE. /explore leads with its vendor
      verdict. Measured live 2026-08-20, `?q=doves` printed "No vendors match
      exactly. Try widening your search" ABOVE the doves guide it had found —
      so the one row offering our writing delivered a failure about suppliers
      first. Prod holds two shops; the marketplace could not lead well on
      anything.
      🔑 The nouns are the SIGNED-OUT box's own promise
      (`PUBLIC_SEARCH_NOUNS` → "suppliers, stories and guides"), so one search
      makes one promise whether or not you are logged in. If a noun is ever
      dropped there, drop it here in the same commit.
    */
    label: widest
      ? `Search Setnayan for “${q}”`
      : `Search all of Setnayan for “${q}”`,
    sublabel: widest
      ? 'Suppliers, stories and guides'
      : // Say what the box was narrowed TO, not only where this goes — the
        // person needs to know why their thing was missing, not just that
        // there is another door.
        `You’re searching ${scope.placeholder.replace(/^Search /, '')} · this looks everywhere`,
    /*
      ⚠ `/`, NOT `/explore`. The front door reads `?q=` and renders results in
      its own body. Sending this to the marketplace again re-creates the defect
      above; the marketplace is reached from a row ON the results page, which
      is where a supplier-shaped query still gets the stronger search.
    */
    href: `/?q=${encodeURIComponent(q)}`,
    kind: 'action',
    icon: 'store',
  };
}
