## 2026-07-21 · feat(vendor): "Your booth poster" upload on the event brief

Follow-up to the poster storage/gate PR. A booked vendor can now actually upload their per-event design.

**It lives on the EVENT BRIEF, not the cocktail editor — and that placement is load-bearing.** The cocktail page redirects on `category_not_cocktail` / `vendor_edit_off`, so a vendor whose booth sits in the reception could never reach it. `vendor_set_booth_poster`'s gate is deliberately wider (any BOOKED vendor, independent of the cocktail-room switches), so the UI has to sit on a surface with the same reach. `/vendor-dashboard/clients/[eventId]` is gated on booked-or-accepted-inquiry and every booked vendor reaches it; the card renders for `isBooked` only, **not** behind `canEditCocktail`.

**The card** explains what the poster is for in the couple's terms — *"design something for this wedding; it goes on your booth in their 3D plan, where their guests will walk past it"* — and states that the company logo shows alongside automatically, so the poster is free for artwork rather than re-stating the brand. Shows the current poster with a **Remove** action, states the format rules inline (portrait 1024×1536, 500 KB, JPG/PNG/WebP), and surfaces the RPC's mapped errors.

**Upload order is deliberate:** `FileUpload` writes to R2 first and emits an `r2://` ref, which is then persisted through the server action → `SECURITY DEFINER` RPC. A save that fails leaves an orphan object in R2 rather than a wrong row — the right way round, and consistent with how vendor logos already work.

Wired `validateFile={validatePosterFile}` (the 2:3 rule from the previous PR) plus `qrGuard` for fast client-side feedback; the server action's `vendorQrGuardRejects` remains the authoritative reject. The brief's existing parallel fetch block gains one admin read of `event_vendor_booth_posters` scoped by `marketplace_vendor_id`, and the raw `poster_ref` is resolved through `displayUrlForStoredAsset` for the preview — the same ref → URL step the 3D scenes do.

**Still open:** the downloadable 1024×1536 template with safe margins marked (cheap, and the difference between composed posters and uploaded screenshots), and the 3D render itself.

SPEC IMPACT: `Booth_and_Avatar_Build_Plan_2026-07-21.md` §A3 — upload UI shipped; render (§A4) still open.
