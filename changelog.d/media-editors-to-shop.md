# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(vendors): move gallery/video/Instagram editors to My Shop Website Editor + unify video systems

The three vendor media editors that lived ONLY on the retired page
`/vendor-dashboard/profile` (which vendors no longer use) moved to the current
surface — **My Shop → Website Editor** — and the two parallel video systems were
unified into one all-tier gallery (owner decisions: home = the Website Editor;
ONE all-tier video system).

**Relocated editors (new "Gallery & media" section, all tiers · in order):**

- **`app/vendor-dashboard/shop/_components/website-editor.tsx`**: new `GalleryMedia`
  block containing (1) **Portfolio photos** — the exact `<FileUpload name="portfolio_r2_keys">`
  from the retired page (multiple · tier `maxFiles` · watermark · qrGuard),
  (2) **Featured videos** — the `<VideoLinksEditor>` for `gallery_video_links`
  (all tiers), (3) **Instagram** — `<InstagramConnectCard>` with the same props
  (connection / media / configured / flash) and UNCHANGED OAuth connect/callback/sync
  routes. Photos + videos persist via a new save form using the single-column
  `updateVendorProfileField` action (never nulls other fields).
- **`app/vendor-dashboard/shop/page.tsx`**: loader extended to fetch the data
  these need (`portfolio_r2_keys` + presigned display map + tier cap, `gallery_video_links`,
  IG connection/media + `isInstagramConnectConfigured`), and builds the IG flash
  from `ig_connected` / `ig_error` params.
- **`app/vendor-dashboard/actions.ts`** `updateVendorProfileField`: new `portfolio`
  + `gallery_videos` cases — the SAME parse / tier cap / QR-guard / repost-hash /
  cardinality-cap semantics as the retired full-form `saveVendorProfile`. These
  two stay editable post-verification (they are not locked-identity fields).

**Video-system unification (two → one, all tiers):**

- The Enterprise-only "Films" rack (`microsite_video_ids`) is folded into the
  all-tier "Featured videos" gallery (`gallery_video_links`). The Films editor
  section was removed from the Website Editor; the separate Films render on
  `/v/[slug]` (and `films-rack.tsx`) were removed — the public page renders ONE
  unified video set from `gallery_video_links`.
- **Data migration** `supabase/migrations/20270519700000_merge_microsite_videos_into_gallery.sql`
  (NOT applied here — human applies via MCP): per vendor, converts each
  `microsite_video_ids` provider-prefixed ref to a canonical full URL, merges
  into `gallery_video_links` (gallery first, then films, deduped, first-10 cap
  to satisfy the `cardinality <= 10` CHECK). Idempotent. `microsite_video_ids`
  is left in place (data kept · a future cleanup can drop the column).

**Retired page + repointed inbound links:**

- **`app/vendor-dashboard/profile/page.tsx`**: replaced with a permanent redirect
  to `/vendor-dashboard/shop` (preserving query params).
- **`app/api/vendor/instagram/callback/route.ts`**: repointed from
  `/vendor-dashboard/profile` to `/vendor-dashboard/shop#gallery-media` (same
  `ig_connected` / `ig_error` flags).
- **`app/vendor-dashboard/instagram-actions.ts`**: revalidates `/vendor-dashboard/shop`
  (was `/profile`).
- Inbound links repointed to `/vendor-dashboard/shop`: `vendor-sidebar` (Profile
  item), `qr-section`, `invite/page`, `track-record/page`, `website/page`
  (Edit page / Edit profile + copy), and the shop page's own fallbacks.
  `manage-tiles.tsx` gained `id="manage-shop"` for the Hero "Finish profile" anchor.

No vendor loses data — photos, videos (incl. migrated Films), and IG connections
are all preserved. Behavior of the moved editors (upload limits, tiers,
watermarking, qrGuard, save semantics) is identical.

SPEC IMPACT: The two vendor video systems are unified into ONE all-tier
"Featured videos" gallery (`gallery_video_links`); the Enterprise-only "Films"
(`microsite_video_ids`) is retired as a user-facing feature (column kept for now,
no longer read/written). Vendor media editing consolidates onto My Shop → Website
Editor; `/vendor-dashboard/profile` is retired to a redirect. Corpus note logged
in `DECISION_LOG.md`.
