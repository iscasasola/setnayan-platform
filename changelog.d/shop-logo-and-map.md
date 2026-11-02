## 2026-08-08 · fix(vendor): the shop logo and the location map were both invisible on the public page

The owner approved his own shop, opened `www.setnayan.com/setnaprod`, and sent a
screenshot. The page rendered — and the two pictures on it did not: a
broken-image glyph where his logo goes, and an empty grey panel where the map
goes. Two different causes, one shared shape: **the browser declined, and the
only symptom was an absence.**

### 1 · The logo — `logo_url` holds `r2://`, not a URL

`<Logo logoUrl={vendor.logo_url}>` handed the stored reference straight to
`next/image`, which emitted
`/_next/image?url=r2%3A%2F%2Fsetnayan-media%2Fvendors%2F…` — read off the live
page, not inferred. Nothing to fetch, so nothing appears.

`displayUrlForStoredAsset()` was **already imported in this file** and already
used for portfolio photos and showcase videos ~1200 lines above. The pattern was
applied to every asset on the page except the one in the header.

This was the last entry in the `lint-stored-asset-refs.mjs` baseline, and that
list literally labelled it *"the PUBLIC shop page itself — the highest-value one
still owed"*. It sat there until a real person opened the page. Now fixed and
removed from the list; debt drops **16 → 15**.

🔑 **A baseline is a bill, not a decision.** Every remaining line is a surface
showing no logo to somebody right now. Work publicly-reachable ones first.

Also resolved on the same page: the OpenGraph/Twitter card image and the
JSON-LD `image`, which passed the same raw reference — a broken picture nobody
sees until the link is already shared. Presign failures are swallowed on
purpose; `<Logo>` falls back to initials, and a missing signature must not take
a public page down.

### 2 · The map — our own CSP blocked our own iframe

`app/_components/vendor-location-map.tsx` embeds
`https://www.openstreetmap.org/export/embed.html`. The enforced `frame-src`
listed YouTube, Vimeo, Instagram and TikTok — **not OpenStreetMap**. OSM answers
200; Chrome refused the frame. The map has been dead on every shop page with
coordinates since it shipped.

`next.config.ts` already said *"New embed origins later extend this one list."*
True, correct, and it did not stop this. **A sentence is not a mechanism.**

### Guards (mutation-tested — each fails when broken on purpose)

New `apps/web/lib/csp-embeds-are-allowed.test.ts`:
- every iframe host resolvable from its own file must appear in the **enforced**
  `frame-src` (drop OSM → fails; point the map at an unlisted host → fails)
- a direct pin on the OSM host, so the rule survives the src becoming dynamic

**No silent cap:** 5 iframe `src`s are fed by props (`watchLive.embedUrl`,
`v.embedUrl`, …) and cannot be resolved statically. They are **counted and
printed by name**, so a clean report is never mistaken for full coverage.

The logo fix is enforced by the existing lint: reverting `<Logo>` to
`vendor.logo_url` now fails outright rather than being absorbed as debt
(verified).

🪤 **I broke a real guard and moved my comment, not the assertion.**
`csp-report.test.ts` matches `value:` *immediately* followed by the policy
string, proving the enforced header is still the frame-only one. A comment
inserted between them failed it. The guard is right — the note now sits above
the object, with an explanation so the next person does the same.

### Verified

- unit suite **7047 tests, 8 failures — the same 8 that fail on a clean
  `origin/main`** (papic-pool-metering · papic-two-type-model · 4 pHash · 2
  vendor-deep-search), baselined by stashing and re-running. My change adds two
  passing tests and no failures. Those 8 are pre-existing and untouched here.
- 19 `lint-*.mjs` scripts pass

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/CLAUDE.md` — the ACTIVE block
records the `r2://` logo debt as "16 surfaces baselined"; the public shop page
is now paid and the count is 15. The vendor location map's CSP breakage was not
recorded anywhere and now is.
