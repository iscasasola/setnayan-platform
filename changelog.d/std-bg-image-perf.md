## 2026-06-22 · perf(std): serve a screen-sized Save-the-Date background, not the full-res upload

Owner-reported on `/cale-ice` (same session as the veil double-audio fix): the **background image loads slowly**. Root cause: the Step-1 "upload" background is the couple's ORIGINAL photo straight from R2 (cale-ice's is a **4.2 MB / 4460×2509** Nikon JPEG), drawn full-bleed behind the film via a low-priority CSS `background-image`. The browser streamed all ~4 MB to display it at ~400–1200 px wide on a phone.

`next/image` is not an option here: the app deliberately uses raw elements for presigned R2 URLs (the optimizer keys its cache on the URL, and our presigned URLs rotate every render — see `app/[slug]/page.tsx` "raw <img> because the URLs are presigned"). The SDK also serves virtual-hosted hosts (`<bucket>.<acct>.r2.cloudflarestorage.com`) that aren't in `next.config` `remotePatterns` (only the path-style `<acct>.r2.cloudflarestorage.com` host is). So we DERIVE + cache instead.

**What shipped:**

- **New server-only `apps/web/lib/std-bg-image.ts`** → `displayUrlForStdBackground(value)`.
  - Derives a screen-sized WebP **once** (1600 px wide, q72, EXIF-rotated via `sharp`) and caches it back in R2 next to the original (key + `__stdbg-w1600.webp`, `Cache-Control: public, max-age=31536000, immutable`), then presigns + serves it.
  - Lazy + idempotent: first view of an event without a variant pays a one-time `GET → resize → PUT`; later views (and every guest) just `HEAD` the cached variant and presign it. The derived object is immutable, so it's reused forever (the source never changes once uploaded).
  - **Fails open to the original** via `displayUrlForStoredAsset` on any error (R2 unset in dev/preview, un-decodable source) so the background never breaks.
  - Uses `transformToByteArray` (as in `lib/drive-upload.ts`) + `sharp` (already a `serverExternalPackages` dep).
- **`apps/web/app/[slug]/page.tsx`** — calls `displayUrlForStdBackground` for the `upload` background kind instead of `displayUrlForStoredAsset`.

~4 MB → a few hundred KB, identical full-bleed look. Cost-optimal vs. `next/image` (no per-render transform; one derived object per event; R2 egress is free). `realistic` (local pre-optimized webp) + `plain`/`paper` backgrounds are unaffected; the builder preview still uses the original (single-user editing surface).

No schema changes. No SKU changes.

SPEC IMPACT: `0024_save_the_date/` — Step-1 upload backgrounds are served as a cached, screen-sized WebP variant rather than the raw original. (Reference/history only — code is canonical per the 2026-06-07 ground-truth flip.)
