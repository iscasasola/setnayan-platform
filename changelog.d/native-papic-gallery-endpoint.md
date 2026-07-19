## 2026-06-26 · feat(api): native-facing Papic gallery endpoint (reuses fetchPapicGallery)

New `GET /api/events/[eventId]/papic-gallery` for the Expo native app. The device
can't presign R2, so it calls this with its Supabase SESSION token; the route
scopes a client to that token and calls the existing `fetchPapicGallery` — so the
native app gets the EXACT same gated, presigned couple feed the web
`/studio/papic` page renders (moderation/hidden/expiry/consent gating, clips →
poster frame, seat + guest captures, untagged-still-delivered). Reads run under
the couple's RLS, so a foreign `eventId` returns nothing. No new gallery logic —
this is a thin reuse wrapper (avoids the inferior bespoke presign endpoint).

SPEC IMPACT: None — additive read-only endpoint backing the native gallery; no
schema/SKU/flow change.
