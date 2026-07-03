## 2026-07-03 · fix(vendor): service cover photos now watermarked (owner-locked)

Owner sign-off closing the cover/showcase inconsistency flagged in the
live-preview PR: service **cover** uploads (`primary_photo_r2_key`) now apply
the SETNAYAN watermark, same as showcase photos and every other marketplace
photo (per the 2026-05-21 "vendor marketplace photos MUST be watermarked"
directive). `watermark` prop added to all three cover `FileUpload`s — the
guided wizard + the inline create + inline edit forms.

Note: watermarking happens client-side at upload, so covers ALREADY stored
stay unwatermarked until the vendor re-uploads (no retroactive processing;
today that's founder-only inventory).

Verified: tsc (0) · next lint (0) · prod build.

SPEC IMPACT: None (applies an existing owner directive uniformly).
