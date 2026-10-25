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
