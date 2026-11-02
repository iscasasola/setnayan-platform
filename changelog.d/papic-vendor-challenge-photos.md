## 2026-07-22 · feat(papic-games): Phase 5 — vendor collects consented challenge photos

Owner 2026-07-22 ("both"): a booked vendor who PAID the ₱400 Photo Challenge
sponsorship receives the guest photos/videos taken at THEIR challenges — only the
ones a guest explicitly consented to share (§4), through the same strict outbound
gates the guest-facing surfaces use. Flag-gated (`NEXT_PUBLIC_PAPIC_GAMES_V1`).

- **Migration** `20270911359108_papic_vendor_challenge_photos_rpc.sql` —
  `papic_vendor_challenge_photos(event_id)` (`SECURITY DEFINER`, authenticated-only).
  Gates, all required: caller **sponsored** for the event
  (`papic_photo_challenge_sponsorships`, the ₱400 handshake) → the completion is on
  the caller's own vendor challenge → **`consent_to_share = true`** (guest §4
  per-vendor tap) → **`moderation_state = 'clean'`** (strict outbound allowlist,
  not the couple denylist) → **`hidden_at IS NULL`**. Returns **web-copy derivative
  refs only** (`display`/`thumb`/`poster`/`clip_web`) — never `r2_object_key` (the
  geo-bearing original).
- **`challenge-photos/page.tsx`** (vendor subpage) — booked-gate via
  `get_vendor_event_brief`, then presigns each ref short-TTL via
  `displayUrlForStoredAsset` into a grid grouped by challenge. Empty state until a
  guest shares.
- **`lib/papic-games.ts`** `fetchVendorChallengePhotos` + **`lib/papic-missions.ts`**
  `VendorChallengePhotoRow`. **`vendor-challenge-section.tsx`** — a "View shared
  photos" link for sponsored vendors.

SPEC IMPACT: None — delivers the §4.2 "the photos are what justifies ₱400" leg,
now unblocked by the owner's consent approval. `tsc --noEmit` clean.
