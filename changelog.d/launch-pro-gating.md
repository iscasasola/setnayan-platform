## 2026-07-24 · feat(website): Website Pro gating + free map/themes (PR-B)

PR-B of the Launch settings-first plan (Launch_Settings_Design_Spec_2026-07-24 §3-4).
Pro-gates the existing website editors behind `COUPLE_WEBSITE_PRO` with the
GRANDFATHER rule, frees the map-link + themes paths, and codifies the catalog split.

- Grandfather rule (load-bearing): each editor gate = `(NOT eventCoupleWebsiteProActive) AND (this feature has NO existing content)`. A couple that already set content, or owns Pro, always edits. The live guest site `/[slug]` is untouched — only the EDITORs gate going forward. Fail-open on a throwing entitlement read (treat as owned).
- Photo gallery (`website/our-photos`): gated on `events.our_photos` empty. Page shows a locked upsell; action mirrors the gate (defense-in-depth).
- Editorial (`website/editorial`): gated on `isEditorialProActive` (à-la-carte EDITORIAL_PRO OR Website Pro umbrella) + "has content" = non-empty `event_editorial.draft_json` OR published. Page + `saveEditorial` action both enforce.
- Background music (`website/site-chrome`): ONLY the music field is Pro-gated (hero VIDEO stays free) on `events.site_bg_music_r2_key` empty. Inline lock replaces the music fieldset; action skips music writes for a non-Pro no-music couple. Site-chrome is never whole-page gated.
- Save-the-Date video upload + Cinematic Reveal: LEFT AS-IS — already gated on `STD_PREMIUM_OPENINGS`, which `SKU_OWNERSHIP_ALIASES` maps under `COUPLE_WEBSITE_PRO`, so a Website Pro couple already unlocks them. No change needed.
- Map link + Themes → FREE: not code-gated at point of use (only surfaced in `home/pricing-data.ts`); rows now read Free via `freeOrPrice` (fallback 0). `WEBSITE_GALLERY_UPLOAD` standalone row removed (folds into the Website Pro umbrella).
- Catalog: `WEBSITE_MAP_LINKING` + `WEBSITE_THEMES` + `WEBSITE_GALLERY_UPLOAD` live in `platform_retail_catalog_v2` (NOT `service_catalog`) and are ALREADY `is_active=false` in prod. Guarded, idempotent migration `20270929911733` codifies this end-state (0 rows touched in prod). Ownership reads (`orders`) are untouched, so prior buyers keep their entitlement.
- New shared server component `website/_components/website-pro-lock.tsx` renders the locked state (page + inline variants) with ONE umbrella CTA into `/dashboard/[eventId]/studio/website-pro`.

SPEC IMPACT: None — implements owner-locked 2026-07-24 split already recorded in Launch_Settings_Design_Spec_2026-07-24.md §3-4; COUPLE_WEBSITE_PRO ₱3,500 verified active/purchasable in prod. No corpus decision changed.
