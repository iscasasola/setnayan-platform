/**
 * shell-page-search.ts — the doorway pages whose search is THEIR OWN bottom row, so the shell's top-bar box is not
 * drawn on them (owner 2026-10-25, on the signed-out /help, pointing at the page's own box: *"Should the search be
 * consistent with the search bar we have?"* → yes; one search on the page).
 *
 * /help and /features mount the one help · features · guides search (`app/_components/how-search/`) as the same
 * bottom row Guests, Suppliers and Discover use — signed in AND signed out. Signed out, the shell would otherwise also
 * draw its marketplace box ("Suppliers, stories, guides") at the top: two searches on one page.
 *
 * WHOLE PATHS, read by the shell during render (`usePathname()`, exactly like `DOORWAY_BLEED_PATHS` in
 * `shell-bleed.ts`, for the same reason: the shell persists across navigation, so a page-authored marker would flash
 * and a layout cannot see the path). `/features/<slug>` keeps the shell's box — only the hub has the page's own row.
 */
export const DOORWAY_PAGE_SEARCH_PATHS = ['/help', '/features'] as const;

/**
 * 🔍 WHICH SEARCH THE TOP BAR DRAWS — one rule, decided here, for every mount of the shell (walk 2026-11-01).
 *
 *   a host handed one in      → that one (the console's `AdminSearchBox`; an explicit `false`)
 *   a page with its own row   → none (`DOORWAY_PAGE_SEARCH_PATHS`)
 *   SIGNED IN, nothing handed → none (owner 2026-10-22, "One thumb row": the search lives in the thumb row of the
 *                                place you stand in, never in a signed-in top bar)
 *   signed out, nothing       → `undefined`, which the shell draws as the marketplace box — the same one `/` shows
 *
 * 🔑 THE SIGNED-IN ARM USED TO LIVE IN THE HOSTS, NOT IN THE SHELL. `AppRailShell` and `FrontDoor` each passed
 * `account.signedIn ? false : undefined`, so the shell's own default was the SIGNED-OUT box. Every other mount — the
 * `/dev` labs' shells (`LabShell`, the supplier shell, bar-lab, you-lab) — drew a signed-in bar with the stranger's
 * marketplace field squeezed to ~74 px between the wordmark and the cluster ("Sup"), and the walk reported it on four
 * labs and in iPhone Safari as a product defect. The product never showed it; a bar that only looks right when every
 * host remembers the same line is one forgotten line from showing it. Pinned by `the-signed-in-bar-has-no-search.test.ts`.
 */
export function topBarSearch<T>({
  handed,
  signedIn,
  pageHasOwnSearch,
}: {
  handed: T | false | undefined;
  signedIn: boolean;
  pageHasOwnSearch: boolean;
}): T | false | undefined {
  if (pageHasOwnSearch) return false;
  if (handed !== undefined) return handed;
  return signedIn ? false : undefined;
}
