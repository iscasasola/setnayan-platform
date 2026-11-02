## 2026-06-28 · feat(vendor): required Business Profile (8 fields) + publish gate

Vendor onboarding · owner spec — a vendor "must have their Business Profile"
(Business Name · Business Owner · Contact Number · Business Email · Maps Pin ·
Services Covered · Year Started · Updated Business Documents) before they can be
published / listed / take inquiries.

State going in: 6 of 8 fields already existed; **Business Owner** had no column and
**Year Started** (`in_business_since_year`) was hidden behind the experience flag.
A vendor could also save a blank profile and there was no requirement.

- **Schema:** `business_owner_name text` added to `vendor_profiles`
  (migration `20270313000000`, idempotent · applied to prod).
- **`lib/vendor-profile.ts`:** `business_owner_name` + `in_business_since_year` added
  to the row type + FULL select; new `businessProfileChecklist(profile, {hasDocuments})`
  (the canonical 8-item required gate with `complete`) + `fetchHasBusinessDocuments`
  (reads `vendor_verification_applications.docs_complete` for the documents item).
  `profileCompletion` kept as a thin profile-fields-only gauge for the activity score.
- **Profile form (`vendor-dashboard/profile`):** new Business Owner field; **Year Started**
  surfaced as an always-on core field (moved out of the experience-flag block, which keeps
  "approx. weddings done" + the DTI-verified badge); the completion card is now the 8-item
  **Business Profile** checklist (✓/○ per item, documents links to `/verify`).
- **Save action (`saveVendorProfile`):** parses the two fields; **publish gate** — ticking
  "publish" while the Business Profile is incomplete saves the edits but keeps the vendor
  unpublished and reports exactly what's still missing (never silently lists a half-built
  profile).
- **Dashboard home:** the completion surface aligned to the same 8-field checklist.

Soft-gate by design (vendors can still save drafts; completeness is required to publish,
matching the existing `is_published` / verification model). Business Owner kept private
(not shown publicly). Documents reuse the existing verification flow, not a parallel uploader.
`tsc` + lint green. Ships to www.setnayan.com via main auto-deploy.

SPEC IMPACT: Vendor Business Profile is now a required 8-field gate (iteration 0022 /
0006). Corpus note added to DECISION_LOG.md.
