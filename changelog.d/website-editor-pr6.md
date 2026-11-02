# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · feat(website): hero photo, gallery, music & visibility edit inline (PR-6)

Owner 2026-07-25: *"they should not need to jump to multiple pages to edit a single website … like any WYSIWYG website editor but focused on their event."* This absorbs the picture-and-sound settings — the ones a couple touches most — into the editor rail, beside the live preview.

- **`_components/media-panels.tsx` (new):** `HeroPhotoPanel` · `GalleryPanel` · `SiteChromePanel` (background music **and** the free hero video — they share one action) · `VisibilityPanel` (Who-can-view as inline radios). Each is a plain `<form action={serverAction}>` posting to the **same** action its old sub-page used, embedding the **same shared `<FileUpload>`** with identical bucket / prefix / MIME / size settings — so the R2 path, validation and write layer are all unchanged.
- **Existing media shows up in the panels** — refs are resolved to presigned display URLs with the same `displayUrlForStoredAsset` helper the sub-pages use, so the uploaders mount with the current hero, gallery and track already visible.
- **`return_to` adopted** in `hero-photo` · `our-photos` · `site-chrome` · `privacy` actions (success redirects only), so saving returns to the editor with the row still open instead of bouncing to a sub-page. Opt-in and default-identical — the sub-page flows are unchanged.
- **Pro rows behave exactly as before**: gallery and music show the umbrella lock panel when genuinely locked, the real editor when owned or grandfathered — `lockedIf` (PR #3664) still decides, server-side.

**Now editing inline (7):** hero photo · photo gallery · background music + hero video · who-can-view · colors · special message · what to bring.
**Still their own focused editor (5):** sections/reorder, dress code, photo moments, our story, editorial — genuine multi-field or long-form authoring surfaces; they stay reachable from the rail and are the next candidates. No migration.

SPEC IMPACT: None — new panels over the existing write layer; entitlement and validation logic untouched.
