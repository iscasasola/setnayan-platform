## 2026-11-25 · fix(front door): final check area 1, batch a1-live-perf

Lane A fixes for pages that did not open, or opened as the wrong thing.

- **A1-056 (blocker):** `/signup` sends away only a real account (`signupShouldBypass`); a host who started with no
  account now reaches the Create account card from "Secure my plan", and `signUp` turns that same anonymous account
  into a real one.
- **A1-125:** on the shop page, a refused reviews or services read settles to `null` and that section shows the shared
  `ErrorState` ("Couldn't load the reviews / services"); the rest of the page draws. Before, the page's `Promise.all`
  had no catch and a stranger got the root error screen.
- **A1-128:** a refused shop read (`fetchVendorRead`) says "Couldn't open this shop" and is never "Page not found"; the
  copy kept for strangers throws instead, so it keeps its last good version. The story page does the same.
- **A1-124:** on a shop's own domain, its own root-path links (`/{shop}?dates=1`, `/{shop}/story/…`) open their
  screens (`customDomainShopPath`); other paths route normally instead of becoming `/v/{shop}/…` 404s.
- **A1-166:** the service worker keeps a read-only copy of the help pages (network-first, `HELP_CACHE`); with no
  signal a person sees the last copy or Setnayan's offline page, never the browser's blank error.

SPEC IMPACT: None — no rule, price or plan changes; A1-154 (the copy's 500s) had no code cause and A1-146/147/169
(edge caching) are scoped separately.
