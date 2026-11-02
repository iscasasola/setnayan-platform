## 2026-06-20 · fix(verify): vendor verification reads "your 8 items", not a stuck "8 of 12"

2-step-down program (Wave 4) — the vendor verification surface scored diff-5, partly inflated by a real denominator bug. The checklist is 12 items but only **8 are the vendor's**; the other 4 (ID liveness, a video call, phone/email confirmation, AMLC screening) are admin-run. The progress meter + submit button counted against 12, so a vendor who'd finished everything they could do still read "8 of 12 · 67%" and felt stuck.

- **`lib/vendor-verification.ts`** — added `VENDOR_DOC_SLOTS` / `ADMIN_DOC_SLOTS` (split by `kind === 'upload'`) + `countCompleteVendorSlots()`. The lib already documented the intent ("the vendor's completeness is everything-except-those-four"); this makes it computable.
- **`verify/page.tsx`** — vendor-facing progress now counts the 8 (shows `8 of 8 · 100%` when done, not `8 of 12`); the checklist splits into **"Your items to upload (8)"** and **"We handle this (4)"** so it's obvious which are the vendor's; header + submit copy realigned.
- **`verify/actions.ts`** — the submit gate now counts the 8 vendor uploads (`countCompleteVendorSlots`) instead of "8 of any 12", matching the display; clearer error copy. The admin-side `docs_complete` all-12 flag is unchanged.

Banks the surface from a 5 toward a 3 (the "5" was inflated by the denominator bug). No schema change.

SPEC IMPACT: iteration 0006 vendor verification UX. Logged in `DECISION_LOG.md`.
