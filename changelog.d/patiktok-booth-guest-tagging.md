## 2026-06-26 · feat(patiktok): guest tagging on the booth capture screen (Phase A)

Until now a Patiktok booth clip could only carry a free-text "Guest name"
field — no real link to who's in the clip. This adds a proper "Recording for:"
tag, set BEFORE the countdown (editable at review), with four ways to fill it,
reusing the existing guest-QR / table-QR primitives rather than new infra:

- **Pick from list** — typeahead over the event's guests (no camera).
- **Scan place-card QR** — reuses `lib/qr-scan.ts` `makeQrDetector` (native
  BarcodeDetector → jsQR fallback, iPad/Safari-safe) + `parsePapicTagScan` /
  `parseGuestQrPayload`, resolved against this event's guest list client-side.
- **Scan table QR** — group shot attributed to a table (`parseTableQrPayload`,
  matched by `event_tables.public_id` or `qr_token`).
- **Just a name** — free text, for non-guests / "Tita Baby's barkada".

Tagging stays optional — a clip is KEPT either way (untagged-still-delivered).
The new `_components/tag-sheet.tsx` uses the shared `useModalA11y` overlay
primitive; the scanner owns the camera only while active and hands it back to
the recording camera on close (one camera at a time on iOS Safari).

Data: migration `20270304574000_iteration_0017_patiktok_clip_tagging.sql` adds
`guest_id` / `table_id` / `tag_source` to `patiktok_source_clips` (all nullable,
ON DELETE SET NULL — removing a guest/table never drops footage; adding columns
leaves the table's existing RLS untouched). `recordPatiktokClip` validates the
guest_id / table_id belong to THIS event via the RLS-scoped client before
inserting, and only stamps `tag_source` when a tag actually resolved.

Phase B (deferred): live/review FACE pre-fill of the same tag slot when the
event has face enrollments (Papic on) — reuses `lib/face-match.ts`; the
`auto_face` tag_source value is reserved for it.

SPEC IMPACT: None — implements the deferred 0017 "guest tagging (phase 5.1)"
booth affordance against shipped primitives; no SKU, pricing, or scope change.
