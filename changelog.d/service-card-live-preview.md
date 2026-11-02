## 2026-07-03 · feat(vendor): v20 gap — live card preview in the form + inline cover upload

Closes the biggest remaining v20-prototype gap (owner: *"when we create a
service card, we want to see the exact card"*).

**New `ServiceCardLivePreview`** (`_components/service-card-live-preview.tsx`)
— rendered at the top of BOTH the create and inline-edit service forms,
mirroring the form as the vendor types: name · "from ₱X" anchor per pricing
basis (fixed/brackets → lowest; per-pax → rate×min; per-hour → base + min-hr +
extra/hr) · best-discount badge (largest peso savings on the anchor, same
heuristic as the public card) · "Includes: … · ₱X free" value story ·
"Add-ons from +₱X" (server-known floor) · "Not included: crew meal ·
transport" amber pill · Setnayan Exclusive teaser · the Request-a-quote CTA.
Reads its enclosing form's FormData on input/change events plus a light poll
(the list editors write React-controlled hidden inputs that fire no DOM
events). Purely presentational — adds nothing to the submitted payload.

**Inline cover upload (real gap fixed):** only the guided wizard could set
`primary_photo_r2_key` — publish requires a cover, but the inline create/edit
forms had no way to set one. Both forms now carry a cover `FileUpload`
(edit prefilled via the presigned display-URL map);
`createVendorService`/`updateVendorService` persist it and schedule the same
post-response repost-watch/NSFW hash-scan the wizard path runs.
`VendorServiceRow`/`FULL_SELECT`/fallback now carry `primary_photo_r2_key`.

**⚠ Flagged for owner alignment (not changed here):** covers are
UNWATERMARKED today (wizard behavior, matched by the new inline uploads) while
showcase photos ARE watermarked — the 2026-05-21 "marketplace photos must be
watermarked" directive suggests covers should be too. One-line fix once
decided.

**Deferred with substrates already live:** refinement chips on the fast form
(the `vendor_service_attributes` + `canonical_service_schemas` system + the
Attributes tool exist; inline chips = own slice) · downpayment-to-reserve
(the `PaymentScheduleEditor` on the edit form IS the reserve substrate per the
Phase-1 reconciliation; a create-time shortcut would duplicate milestone #1).

Verified: tsc (0) · next lint (0) · lint-nested-forms · prod build.

SPEC IMPACT: None beyond the approved redesign (v20 parity slice).
