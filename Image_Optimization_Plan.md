# Image Optimization Plan — Cloudflare Images Cutover

> Companion to CLAUDE.md 2026-05-22 engineering posture: "every photo gallery
> surface (Papic, Mood Board, Photo Delivery, /v/[slug] portfolios,
> /weddings editorials) routes through Cloudflare Images with on-demand
> variants." This doc captures the current state, the target architecture,
> the cutover plan, and the cost model so a future PR can flip the switch
> against a single source of truth.
>
> Drafted 2026-05-22 as part of Task #34 audit. Status: planning — no
> infrastructure changes yet.

## 1. Current state (as of 2026-05-22)

### Image sources

- **Cloudflare R2** (primary) — vendor logos, moodboard library assets,
  Papic uploads, photo-delivery archives, contracts, message attachments.
  Public URLs resolved by `lib/r2.ts → publicUrlForKey()` and exposed via
  `R2_PUBLIC_URL` env var.
- **Supabase Storage** — legacy upload bucket; declining surface area.
- **Wikimedia Commons** — hotlinked CC-BY-SA venue heroes (V1; retires
  when V1.2 venue iteration copies them into Supabase).
- **picsum.photos** — placeholder moodboard seeds until admin uploads
  via `/admin/moodboard-library`.

### Rendering pipeline (today)

- **`next/image`** with `remotePatterns` in `next.config.ts` allowlisting
  the four sources above. `next/image` does its own optimization through
  Next.js's built-in loader at request time, served from the Vercel edge.
- After Task #34 (this PR): **zero raw `<img>` tags** in `apps/web/app/`
  outside of Canvas-bound `new Image()` (color-range-manipulator) which
  is intentional and stays.

### Gaps

1. **No on-demand variants.** Every image renders at its uploaded size
   (or whatever `next/image` width/height the call site specifies).
   Hero photo and 48px sidebar thumbnail both fetch the same R2 blob.
2. **No format negotiation.** `next/image` does serve AVIF/WebP when the
   browser supports it, but transformations re-run per Vercel edge cache
   miss instead of being cached centrally at the CDN.
3. **R2 egress is free** (Cloudflare-to-anywhere), but bandwidth to the
   user device still scales with original-size delivery. A 6000px portrait
   served to a 48px sidebar thumb is ~1MB delivered for ~3KB rendered.

## 2. Target architecture — Cloudflare Images

### Pipeline

1. Photos upload to **R2** as today (no upload-path change).
2. A worker (or trigger on R2 `PutObject` event) **mirrors / registers**
   the image with **Cloudflare Images**, returning a `image_id` we
   persist on the source row (`moodboard_library_assets.cf_image_id`,
   `vendors.logo_cf_image_id`, `papic_photos.cf_image_id`, etc.).
3. Read-side URL construction switches to the **Cloudflare Images
   delivery URL** with a **variant** name:
   `https://imagedelivery.net/<account_hash>/<image_id>/<variant>`.
4. `next.config.ts` adds `imagedelivery.net` to `remotePatterns`. The
   `next/image` `<Image>` component continues to work, but the loader is
   our own thin wrapper that maps `width` prop → variant name.

### Variants

| Variant     | Dimensions  | Use cases                              |
|-------------|-------------|----------------------------------------|
| `thumbnail` | 150 × 150   | Sidebar lists, message avatars, admin grids |
| `avatar`    | 96 × 96     | Vendor logo on `/v/[slug]`              |
| `preview`   | 800 × 600   | Moodboard gallery cards, /weddings index covers |
| `hero`      | 1920 × 1080 | Cover photos, editorial heroes          |
| `full`      | original    | Photo-delivery downloads, Papic exports |

Cloudflare Images **auto-encodes AVIF/WebP/JPEG** per `Accept` header
and stores a single source, generating variants on demand and caching
at the CDN edge globally.

### Custom Next.js loader

```ts
// apps/web/lib/cloudflare-images-loader.ts
export default function cfImagesLoader({ src, width }: {
  src: string;
  width: number;
}) {
  // src is either an imagedelivery.net URL with placeholder variant
  // OR a legacy R2/Supabase URL (fall through, no transform).
  if (!src.includes('imagedelivery.net')) return src;
  const variant =
    width <= 150 ? 'thumbnail' :
    width <= 200 ? 'avatar' :
    width <= 1000 ? 'preview' :
    width <= 2000 ? 'hero' : 'full';
  return src.replace(/\/[^/]+$/, `/${variant}`);
}
```

Set in `next.config.ts`:

```ts
images: {
  loader: 'custom',
  loaderFile: './lib/cloudflare-images-loader.ts',
  remotePatterns: [{ hostname: 'imagedelivery.net' }, ...existing],
}
```

### Migration path

- **Phase 0 (this PR — Task #34):** Migrate all raw `<img>` → `next/image`
  with explicit width/height + lazy-load + alt. **Done.**
- **Phase 1:** Add `cf_image_id` columns + R2 → Cloudflare Images mirror
  worker. Backfill existing R2 assets (one-time script).
- **Phase 2:** Switch read sites to use Cloudflare Images delivery URLs +
  custom loader. Keep R2 fallback for not-yet-mirrored assets.
- **Phase 3:** Once mirror coverage >99%, drop the R2 fallback and remove
  the R2 hostname from `remotePatterns` (R2 stays as the source-of-truth
  store; only delivery flips).

## 3. Cost model (PHP, monthly, projected)

Cloudflare Images pricing (2025): **$5/100k images stored + $1/100k
delivered**. At V1 launch projections (~1k events × ~30 gallery photos
per event = 30k stored; ~10k MAU × ~50 image views per session × ~10
sessions/month = 5M delivered):

| Line item        | Volume   | USD     | PHP (₱)  |
|------------------|----------|---------|----------|
| Storage          | 30k      | $1.50   | ~₱85     |
| Delivery (5M)    | 5M       | $50     | ~₱2,800  |
| **Total**        |          | **$51.50** | **~₱2,900** |

At V1.5+ scale (10k events × 100 photos = 1M stored, 50M views/month):
~₱32,000/month. Still <0.1% of platform revenue and removes a load of
bandwidth from the Next.js Vercel cache budget.

## 4. Open questions for owner

1. **Self-host vs Cloudflare Images?** A libvips Worker hitting R2 with
   variant query params could be ~50% cheaper at >50M views/month but
   adds operational surface. Cloudflare Images is the recommended V1
   choice; revisit at V2.
2. **Watermarking strategy.** Cloudflare Images supports overlays as a
   variant flag — could replace the current client-side `lib/watermark.ts`
   pipeline for moodboard library uploads. Out of scope for cutover.
3. **Format hints.** `Accept` header negotiation is automatic; we don't
   need to pass format hints from the client.

## 5. References

- CLAUDE.md 2026-05-22 — image optimization KPIs
- `apps/web/next.config.ts` — current `remotePatterns` allowlist
- `apps/web/lib/r2.ts` — R2 client + `publicUrlForKey()`
- `apps/web/lib/storage.ts` — multi-bucket URL resolution
- Cloudflare Images docs: https://developers.cloudflare.com/images/
