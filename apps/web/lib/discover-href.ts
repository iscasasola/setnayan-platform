/**
 * discover-href.ts — Discover's own address, for a press that MEANS Discover.
 *
 * 🧭 `/?discover=1` (owner 23 Nov 2026, *"Yes, go to Home"*; DECISION_LOG 2026-11-23 "A signed-in visit to
 * setnayan.com opens Home"). A signed-in visit to the BARE `/` now opens Home (`signedInRootLanding`,
 * lib/sign-in-landing.ts), so every press that MEANS Discover — the bar's Discover tab, the ☰ row, "Back to Discover",
 * "View on Discover" — carries this marker and still opens Discover. Signed out it is the same page as `/`, and the
 * page's canonical stays the bare `/`, so no second address reaches a search card.
 *
 * Pure and dependency-free, and on its own so a door to Discover never has to import the `?via=` arrival marker
 * (lib/discover-way-back.ts, held by its leak test).
 * 🔒 lib/a-signed-in-visit-to-the-root-opens-home.test.ts
 */
export const DISCOVER_PARAM = 'discover';
export const DISCOVER_HREF = `/?${DISCOVER_PARAM}=1`;
