## 2026-11-15 · feat(photo-mark): the new supplier photo mark — address + QR on every shop

Replaces the Seal-and-plate on every supplier photo surface (shop photos, service cards, cover, portfolio,
inspiration) with one row along the bottom of the centre square over a soft dark fade: LEFT the flat gold logo +
SETNAYAN with `setnayan.com/{slug}` under it (every shop, verified or not — owner-confirmed); RIGHT the shop's logo in a
plain circle (VERIFIED only) then a QR encoding `https://www.setnayan.com/{slug}` (all shops; level M, 4-module quiet
zone, ~22% of the short side, drawn only at ≥3 px/module; under 180 px the address only). The shop-name line and
"SETNAYAN VERIFIED" are dropped. Geometry, the browser canvas and the server painter change together; the QR matrix is
built server-side (no encoder in the browser bundle). `markVerifiedAddress` drops `/v/`. New `mark_kind` values
`row` / `row-verified` so the existing re-mark path picks up every old photo (the `--apply` run is an owner action).
Guard `lib/the-supplier-photo-mark-is-in-the-bytes.test.ts` decodes the QR from the burned pixels.

SPEC IMPACT: None — implements DECISION_LOG rows 6459/6460 and `prototypes/supplier_photo_mark_qr_2026-11-15/`.
