## 2026-11-13 · feat(suppliers): a Find card opens the shipped Service card grown; the ideas board rises full-screen

- **A Find card with a service opens THE grown card** — owner, rejecting a Find-only full-screen supplier sheet: *"We have a full screen of a supplier card that expands all the information of that card. That is not the one."* The card now follows the shop page's own `?service=` address (`serviceCardAddress`), which raises `ServiceDetailsSheet` (`app/v/[slug]/_components/service-details-sheet.tsx`) with the shop page's own `toServiceCard` props — the same door the marketplace card already uses. Nothing is redrawn and the sheet's internals are untouched (#7554 is extending them).
  - The address rides on the bench card (`BenchServiceCard.detailsHref`), built server-side only while the grown card is on (`serviceDetailsEnabled()`); OFF costs no extra query.
  - A withheld supplier loses the address with its name — on both withholding paths (`withholdCardNames` and the action's every-card path). An address names a shop.
  - No address (switched off, no slug, no public id, withheld, self-added) → Find's supplier sheet, unchanged from `main`.
- **The Find-only card view is deleted**: the full-screen supplier sheet, its sideways ‹ › / swipe walk and its peek row. The walk cannot wrap the grown card without redrawing it (the grown card opens on the shop page), so it is dropped, not rebuilt.
- **The ideas board ("More ideas")** rises full-screen (shared `Sheet` `rise` + `full`). The scoped search was already the full-screen `CategorySearchOverlay`.

SPEC IMPACT: None beyond DECISION_LOG row 2026-11-12 "Find is organized by the plan" (Setnayan-specs 98e10d4d). The rejection of the Find-only card view is the controller's relay of the owner's ruling (2026-11-13); the grown card it points to is already DECISION_LOG 2026-11-09/10 ("THE SERVICE CARD OPENS INTO THE FULL CARD", "'SERVICE CARD GROWN' IS THE NAME").
