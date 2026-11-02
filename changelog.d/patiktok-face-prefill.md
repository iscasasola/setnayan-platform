## 2026-06-26 · feat(patiktok): face pre-fill for the booth tag (Phase B)

Builds on the Phase A booth tagging: when the event has consented face
enrollments (Papic on), the "Recording for:" tag now pre-fills automatically.

- When the booth camera is ready and nothing's tagged, the live frame is
  embedded **on-device** (`lib/face-embed` `embedFaces` — dlib/face-api.js, 128-d,
  no imagery leaves the phone) and matched against this event's enrollments.
- New server action `matchPatiktokFace({ eventId, faceVectors })` reuses the
  Papic matcher `planAutoTags` (dlib **Euclidean** thresholds — auto ≤0.50 /
  suggest 0.50–0.60, NOT the old cosine ≥0.85 which the 2026-06-17 real-faces
  validation showed was wrong for dlib). It writes nothing — returns the single
  best candidate (guest + name + kind). Event-membership gated; per-event scoped
  (vector store never crosses weddings); consented + non-revoked only.
- A strong match (`auto`) silently fills the chip with a ✨ marker (still
  clearable/changeable); a medium match (`suggest`) surfaces a
  "Looks like {name}? · Tag / Not them" confirm row. One attempt per guest.
- `booth/page.tsx` gates the whole thing on a `faceEnabled` count query so the
  face model is never loaded for an event with no enrollments. The matcher is
  also dormant unless `NEXT_PUBLIC_FACE_MODEL_URL` is configured (`embedFaces`
  returns `[]`), so this degrades to Phase A manual/QR tagging by default.

No schema change — the `auto_face` `tag_source` value shipped in Phase A's
migration. Manual tag always wins (face never overrides an operator's choice).

SPEC IMPACT: None — completes the deferred 0017 face-tag enrichment against the
shipped Papic face pipeline; no SKU, pricing, or scope change. (Doc note: the
0012/0017 specs cite a cosine ≥0.85 auto-tag threshold; the live engine uses
dlib Euclidean ≤0.50 — the specs are stale, code is canonical.)
