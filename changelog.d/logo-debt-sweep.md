## 2026-08-08 · fix(images): the vendor-logo debt is ZERO — and the fix that shipped an hour earlier was still broken

Follow-on to #4238. The owner's public shop page was fixed to stop handing a raw
`r2://` reference to an `<img>`. It resolved correctly. **The picture was still
missing**, and 15 other surfaces still carried the same debt.

### 1 · Resolving a reference is not the picture arriving

Measured on the live site right after #4238 deployed:

```
the presigned URL itself      → 200  image/png  34478 bytes
/_next/image?url=<that URL>   → 400  INVALID_IMAGE_OPTIMIZE_REQUEST
```

`lib/r2.ts` points its S3Client at `https://<accountId>.r2.cloudflarestorage.com`
and leaves `forcePathStyle` false, so the SDK signs **virtual-host** URLs with
the bucket as a subdomain. `next.config.ts` allowed only
`<accountId>.r2.cloudflarestorage.com`, and `hostname` is an exact match without
a wildcard — **so the remotePattern that existed to allow R2 images had never
matched a real R2 URL.** Every presigned R2 image in the app 400'd at the
optimizer. Nobody had seen it because prod holds no vendor portfolios and no
Papic photos; the shop logo was the first R2 image the optimizer was ever asked
for.

🔑 **Third costume of one disease.** A raw `r2://` (the browser cannot parse it),
a CSP-blocked iframe (the browser refuses it), and now a host outside
`remotePatterns` (the optimizer refuses it). Three layers decline; all three
symptoms are an absence. **Fetch the final URL a browser would fetch.**

### 2 · The debt list is empty

All 15 remaining baselined surfaces now resolve: the public homepage spotlight
strip, the journal partner credit, Explore's vendor card + folder section +
compare page, proposals, the vendor lock and invite pages, the booth page, three
admin surfaces, and the add-a-contact modal. Swept by 7 agents, each checked by a
separate agent whose brief was to refute the fix.

**Both debt lists are now empty** — `BASELINE` in `lint-stored-asset-refs.mjs`
and `KNOWN_UNRESOLVED` in `stored-asset-render.test.ts`. The lint prints
`DEBT IS ZERO`.

### 3 · What the adversarial pass caught that the fixers did not

- **`/open-shop` could 500 outright.** Its pre-existing
  `await displayUrlForStoredAsset(...)` had no try/catch, and that path throws
  when R2 env is unset — at top level in the page body. A vendor who **already
  uploaded a logo** could not open their onboarding wizard; a brand-new one
  sailed through. Wrapped.
- **A presigned URL baked into a prerendered page expires.** `/blog/[slug]` is
  `dynamicParams=false` + `revalidate=3600`; the default presign TTL is 24h, so a
  long-tail article unvisited for a day would serve stale HTML with a dead
  signature — 403, broken glyph, no deploy and no code change to blame. Given an
  explicit 7-day TTL with the reasoning written down.
- **One "surface" was never broken.** `MarketplaceVendorSuggestion.logo_url`
  already held a URL presigned server-side. **Renamed `logo_display_url` at its
  source** — `stored-asset-render.test.ts` warns in its own docblock that "a
  field named logo_url may already hold a resolved URL, and this scan cannot
  tell", and it booked this file as debt twice. When a value's NAME is what
  misleads, rename the value (same ruling as `sponsored_included`).
- **`open-shop/page.tsx` is a verified FALSE POSITIVE**, not debt: the raw value
  there is the wizard's form default, and the display URL travels beside it.
  The lint now has a small `FALSE_POSITIVES` map, excluded from the debt count
  and **self-expiring** — an excuse whose match disappears fails the lint,
  because an exemption covering nothing today will quietly cover a real
  reference tomorrow.
- **A wrong comment kept a surface broken.** `HomeSpotlightStrip`'s debt line
  said it "reads the builder fixed here". False: `lib/spotlight-awards.ts` has
  two builders and only the RECOMPUTE path resolved; the homepage READ path
  handed `logo_url` over untouched.

### Guard

`lib/r2-images-reach-the-optimizer.test.ts` derives both sides from one fact —
the endpoint shape in `lib/r2.ts` decides which host form gets signed, and
`next.config.ts` must allow that form. Asserts behaviour (a bucket-subdomain URL
matches, another account's does not), not a string. Mutation-tested: removing the
wildcard fails 2 of 3; flipping to `forcePathStyle: true` fails the other.

### Correction to #4238

That PR reported "8 unit tests fail on a clean `origin/main`". **That was wrong.**
Those 8 failed because the worktree had no `node_modules` — the tests needed
dependencies that were never installed. With deps installed the suite is
**7074/7074 green**. There is no pre-existing failure on main.

### Verified

- `tsc --noEmit` clean · 7074/7074 unit tests · 19 lint scripts pass
- `lint-stored-asset-refs: DEBT IS ZERO — every surface resolves its logo`

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/CLAUDE.md` records the logo
debt as "16 surfaces baselined"; it is now zero, and the `next/image` host
finding was not recorded anywhere.
