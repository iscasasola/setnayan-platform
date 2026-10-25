/**
 * The words of the /help · /features search field — the same on both pages,
 * because it is the same search. Its own tiny module so the client row can
 * import it without pulling the help corpus and the feature registry
 * (`lib/how-search-core.ts`) into the browser.
 */
export const HOW_SEARCH_PLACEHOLDER = 'Search help, features, guides';
