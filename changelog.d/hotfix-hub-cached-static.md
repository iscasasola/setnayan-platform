## 2026-11-02 · fix(event-hub): a guest's cached Event Hub copy no longer dies reading a cookie

Production, 2026-10-28 → 2026-11-02: every GUEST's cached copy (`/{slug}/cached/v1.…g<guest>…`) failed with
"Page changed from static to dynamic at runtime …, reason: cookies" (Vercel runtime errors, 23 groups in 7 days, the
first on 2026-10-28 — older than batch 20; batch 20 did not cause it). Strangers' copies were fine.

- **Cause** (the production stack mapped onto a local build of the same tree): the `[slug]` LAYOUT renders first and
  asks the couple's look — `loadGuestLook` → `websiteProActiveFor` → `asViewed` → `viewingAsFreeCouple` →
  `readCookie` → `cookies()`. That reader asked `cachedHubViewer()` first, but the cached route holds its viewer only
  after it has read the guest's pass (two database reads). For a stranger the hold won the race; for a guest it lost,
  so the switch read a cookie mid-ISR, its try/catch swallowed the throw, and Next failed the whole page.
- **Fix**: `onTheCachedHub()` (lib/hub-request.ts) knows the cached route from the FIRST moment of its render — it
  reads the render's own work store, which `cookies()` itself reads first, so nothing is marked dynamic. The readers whose answer is the
  same for every guest ask it: "view as free" (`readCookie`), `getCurrentUser`, the cookie-scoped `createClient`,
  `signedInAccountId`, the three request-platform readers, and the page's nesting-cutover check. Only the guest pass
  (`readHeldPass`) still needs the held viewer. No behaviour changes on the live route; on the cached route each
  reader answers exactly what it already answered once the viewer was held.
- **Guard**: `lib/the-cached-hub-reads-no-cookie-before-its-viewer.test.ts` runs each reader inside a render of the
  cached route with no viewer held and fails if any touches the request (the probe is proved able to hit). §2 of
  `lib/the-guest-hub-stays-cacheable.test.ts` now requires the route-aware question for those readers.

SPEC IMPACT: None — restores the EV1 (2026-10-28) "No Event Hub may crash" behaviour the cached route was built for.
