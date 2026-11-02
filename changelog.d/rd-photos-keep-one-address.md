## 2026-10-20 · perf(media): a photo keeps one address all day, the hero is screen-sized, theme loops leave r2.dev

Owner: *"we want all pages to load at its fastest."* Measured on the live guest invitation (read-only): ~20 MB of R2
files, all re-downloaded on every visit — every render signed a NEW URL for the same object (`X-Amz-Date` = now) and
R2 sent no `Cache-Control`; the Main background was the 4.4 MB camera original although its 25 KB screen-sized copy
already sat in the bucket; theme loops reached guests at the rate-limited `pub-….r2.dev` host.

- `lib/r2-stable-sign.ts` (new, pure): `stableSigningWindow` signs at the START of a window (12 h for the 24 h
  default, half the TTL for shorter links) with the expiry stretched by one window — the same key gives the same URL
  all window long, and every URL still lives ≥ the TTL asked for (≤ 1.5 × TTL worst case). `mediaCacheControl`:
  `<uuid>-…` keys (every upload path) → `public, max-age=31536000, immutable`; anything else → `public, max-age=3600`.
  `presignR2GetSync`: SigV4 GET presign, synchronous, byte-identical to the AWS SDK (guarded).
- `lib/r2.ts` `r2StableMediaGet` (media bucket only, hard-wired); `lib/uploads.ts` `presignDisplayUrl` uses it for the
  media bucket — private buckets keep the SDK signer, fresh signature and their own TTL, unchanged.
  `stableDisplayUrlForStoredAsset` = the sync twin of `displayUrlForStoredAsset` (same fence, same address).
- Theme ground (`app/[slug]/_lib/theme-ground.ts`) and the moving background (`main-ground-layer.tsx`) are signed on
  the bucket host instead of `pub-….r2.dev`.
- Main background still (page + Save-the-Date film): the couple's photo is drawn from the existing 1600 px WebP copy
  (`displayUrlForStdBackground`, the Save-the-Date pipeline) instead of the camera original; `lib/std-bg-image.ts`
  remembers copies it has found so a render does not HEAD R2 again.
- Guard: `lib/a-photo-keeps-one-address.test.ts`.

SPEC IMPACT: None (performance; no product rule changed). Open owner/infra call recorded in the PR: resizing at upload
or an image CDN for the rest of the photos (love story, gallery) — not built here.
