## 2026-06-20 · feat(vendor): declared + DTI-verified experience — credible service-card trust signal at launch

At launch the Setnayan-native experience signals are ~0 (finalized booking count, "eyeing this date"), so a real, established vendor looks brand new. Owner ruling: let vendors DECLARE their experience and VERIFY the years against the DTI registration date already collected in verification, so the card is credible on day one. The architect pattern across three surfaces:

- **Migration `20270209420471`** (NOT applied) — additive nullable columns on `vendor_profiles`: `in_business_since_year`, `weddings_done_approx`, `experience_verified_at`, `experience_verified_by`.
- **Vendor (declare)** — `vendor-dashboard/profile`: an "Your experience" section (in business since / approx weddings done) + a verified/self-reported indicator; `saveVendorProfile` persists them and **auto-resets verification when the declared year changes** (stale DTI match).
- **Admin (verify)** — `admin/verify` queue: each application shows the declared "in business since YYYY" + a ConfirmForm **"Confirm — matches DTI"** → `verifyVendorExperience` stamps `experience_verified_at` + the confirming admin. The admin is already reviewing the DTI doc in the same checklist.
- **Couple (see)** — `v/[slug]`: a chip *"N yrs in business · M+ weddings"* with a verified check when confirmed, else a subtle "self-reported" — sitting alongside the Setnayan-native experience tier (which fills in as real bookings accrue).
- New `lib/vendor-experience.ts` helpers: `vendorExperienceEnabled()` (the flag) + `yearsInBusiness(sinceYear, nowYear)`.

Flag-gated (`NEXT_PUBLIC_VENDOR_EXPERIENCE_ENABLED`, default OFF) AND schema-dependent — every read/write of the new columns is behind the flag + a soft-probe (degrades on 42703), so merging is fully inert and the vendor/admin/couple pages never break pre-migration. Go-live: apply the migration, then flip the flag.

Deferred: surfacing the chip on the compact explore grid card (its data comes via the `vendor_market_stats` pipeline, not a direct `vendor_profiles` read — a follow-up); auto-OCR of the DTI date (V1 is the admin eyeballing the doc they already have open).

No couple-facing change with the flag off. tsc clean.

SPEC IMPACT: 0022 vendor profile + 0023 verification + service-card. Logged in `DECISION_LOG.md`; `Services_Builder_Create_Flow_Design_2026-06-20.md` card anatomy.
