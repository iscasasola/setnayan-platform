## 2026-07-24 · feat(booth): Booth Studio — structured, palette-harmonized poster on the 3D booth (dark)

Adds **Booth Studio**, a ₱1,500/28-day vendor SKU that puts a custom poster/banner
on the vendor's 3D booth *on top of* the existing logo branding. Ships **DARK**
behind `NEXT_PUBLIC_BOOTH_STUDIO_ENABLED` (default OFF) — with the flag off the 3D
booth is byte-identical to today and the pre-existing raw-image poster path is
untouched.

- **Aesthetic guard in code:** unlike the raw-upload poster (`lib/booth-poster.ts`),
  Booth Studio composes the poster from a fixed template (headline / offer / price /
  logo / accent) rendered **at runtime in the couple's Mood Board palette**
  (`Lab3DPalette`). A garish vendor accent is clamped/rejected toward the couple's
  palette (`harmonizeAccent`); ink stays legible over any board (`pickReadableInk`).
- **Texture serving:** the poster text is a **CanvasTexture** — no fetched raster,
  so no URL can expire inside a cached scene payload. The optional logo lockup is
  served from the **PUBLIC R2 host, never presigned** (`publicPosterAssetUrl` — only
  the public `media` bucket resolves; private buckets and already-presigned URLs
  return null), with a typographic-monogram fallback if the logo is absent/blocked.
- **Per-(event, vendor) scoping = the isolation guard:** structured content is a new
  optional `poster_content JSONB` on `event_vendor_booth_posters`
  (UNIQUE(event_id, vendor_profile_id)); the v11 `public_venue_scene` RPC emits it on
  the same `(event_id, vendor_profile_id)` join as the logo/poster, so a vendor's
  content can only reach their own booth at that event.
- New: `lib/booth-studio.ts` (+ tests), `lib/booth-studio-flag.ts`, `BoothStudioPoster`
  renderer. Migration `20270928100000_booth_studio.sql`: `poster_content` column
  (poster_ref made nullable + non-empty CHECK), `vendor_set_booth_studio_content`
  setter RPC (booked-vendor gate), v11 scene RPC, and the `booth_studio` catalog SKU.
- Cached-payload safety: all new scene fields are OPTIONAL, so old cached payloads
  still parse.

SPEC IMPACT: Corpus notes (`0012_*` / `event_vendor_booth_posters` migration comment)
previously asserted "no structured template system is needed" for booth posters — that
is now superseded by the owner directive to add the structured Booth Studio composition.
Two owner sign-offs surfaced (not silently decided): (1) the new `booth_studio` SKU
overlaps the existing `vendor_3d_booth` (logo-branding) add-on — confirm separate vs.
folded; (2) Booth Studio bundles the favoritable listing
(`VENDOR_FAVORITES_SUBSCRIPTION_GATE`), which must stay OFF during launch — bundle NOT
wired here.
