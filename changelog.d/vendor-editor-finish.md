## 2026-07-03 · feat(vendor-shop): accent → Solo tier + bare-root address in the Website editor

Two loose ends from the tier ladder:

- **Accent theme is now a Solo control** (was Pro). Moved the accent swatch picker
  from the Pro block into the Solo (`canPersonalize`) group in the editor, and
  moved `microsite_accent` from `PRO_WEBSITE_FIELDS` → `SOLO_WEBSITE_FIELDS` in
  `updateVendorWebsiteField`. Now Solo unlocks About · accent · featured services ·
  sections exactly as the ladder specifies; Pro keeps slug · hero · pinned ·
  editorials.
- **Bare-root address (shortlist A)** — the editor's custom-address field + the
  public URL now show `www.setnayan.com/{slug}` (no `/v/`), matching the shipped
  bare-root canonical (the `/v/{slug}` route still resolves). `publicPath` →
  `/{slug}`, slug prefix → `{host}/`.

SPEC IMPACT: accent re-tiered Pro→Solo (completes the Free/Solo/Pro/Enterprise
ladder alignment); editor surfaces the canonical bare-root vendor address. No
schema/pricing change. Logged in DECISION_LOG.md.
