/**
 * shell-search.ts — where a signed-in search answers: INSIDE the shell.
 *
 * Owner, 22 Oct 2026, iPhone, signed in: *"I tried to search for seda and
 * brought me here away from our shell"* — the palette's "Search Setnayan" row
 * opened the public front door (`/?q=`), whose results page handed the words
 * to the supplier marketplace (`/explore?q=`). Both are DOORWAY pages: the old
 * top bar ("+ Create event"), no account bar, and on the marketplace a second
 * search box and a filter bar of its own. A person who never left the app was
 * shown a page that looked like a different product.
 *
 * 🔑 THE ANSWER LIVES IN THE ACCOUNT SHELL NOW. `/dashboard/search` is a page
 * of the `(account)` layout — the same top bar (the Setnayan mark, the bell,
 * the account), the same account bar at the bottom — and it renders the SAME
 * results view the front door does (`FrontDoorResults`: your own things, the
 * shops we publish, our stories and guides), in its shell form: the suppliers
 * on your events are part of "your own things", and no row hands you out to
 * the marketplace.
 *
 * Signed out nothing changes: the public box still answers at `/?q=`.
 * Guarded by `lib/shell-search.test.ts` — every search hop from the shell must
 * resolve to a page under a layout that draws the account bar.
 */
export const SHELL_SEARCH_PATH = '/dashboard/search';

/** The shell's results page for these words. Empty words → the bare page. */
export function shellSearchHref(query: string): string {
  const q = query.trim();
  return q ? `${SHELL_SEARCH_PATH}?q=${encodeURIComponent(q)}` : SHELL_SEARCH_PATH;
}
