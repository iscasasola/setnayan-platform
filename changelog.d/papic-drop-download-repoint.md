# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · fix(papic): download paths fall back to the web copy for dropped-original photos

Makes the 3-month full-res drop safe for every photo-serving path (owner "repoint. please do not lose the tags and metadata"). Before this, three paths served the full-res original (`r2_object_key`) with no fallback, so a dropped photo would 404 / break after the retention window:

- **"Download all" ZIP** (`gallery-zip`) + **per-photo token download** (`papic/me/[token]/download`) — now select `display_r2_key, full_res_dropped_at` and serve the AVIF web copy for a PHOTO once its original is dropped (`full_res_dropped_at` set); the couple still gets every photo, just compressed. Clips keep `r2_object_key` (their video is never dropped).
- **Guest "photos of you" gallery** (`guest-live-gallery`) — now prefers the cheap web copy (thumb → display → original), which is both drop-safe AND lighter (it was serving full-res as thumbnails).

**Tags + metadata are never at risk:** the drop sweep only `r2Delete`s the pixel object and stamps `full_res_dropped_at` — it never deletes the `papic_photos` row, its `photo_tags` (face/QR tags), or the metadata columns. Verified.

SPEC IMPACT: None (implements the retention model already in Pricing.md § 2.1).
