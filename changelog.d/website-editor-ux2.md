# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · feat(website): editor UX round 2 — QR, Experience, inline story/schedule/open-browse, real color pickers (owner batch)

Owner walkthrough feedback 2026-07-25, in one round:

- **Scan-to-view QR** beside "View live" — a zero-JS `<details>` popover serving the master event QR from the existing `/api/website/qr/[slug]` route; point a phone at the editor to open the live site.
- **Experience button** in the preview toolbar — opens the CURRENT phase full-screen in a new tab (`?phase=`), so the couple can pre-experience the Save-the-Date film, the invitation, the day-of page and the After exactly as guests will, uncramped by the pane.
- **Open browsing flips inline** — new `setOpenBrowse` server action (host-gated, `return_to`-aware) + an inline panel; no more hop to the sections page.
- **Our story is inline** (owner: "we want it to stay here") — the full 17-field form + milestones builder, via the same shared-fields extraction as dress code (`our-story/_components/story-fields.tsx`, rendered by BOTH the sub-page and the panel; `updateOurStory` reads every field per save, so sharing prevents silent blanking).
- **Details & schedule shows the source inline** — the panel mirrors the couple's PUBLIC schedule blocks (`event_schedule_blocks`, `is_public`) + date/venue, with "Adjust in Schedule →" to the source. (Vendor-given ceremony/reception exact times = a separate designed feature, Fable-first, queued.)
- **Colors are real pickers** — the swatch IS a native `<input type="color">` driving a hidden field, so blank ("use my Mood-Board palette") stays possible; Clear returns to the palette.
- **Dress code seeds from the Mood Board** — an empty palette pre-fills from `role_palette` via `paletteSwatches` (source shown, override allowed — owner's call A).
- **Save-the-Date row shows the film's personalization** — current opening, theme, invitation day, with "Design the film →" and the phase tab for the full experience.
- **After/editorial shows the honest free-vs-Pro split** in both states — Free: the After page, auto-gathered photos, thank-you note · Pro: writing/arranging chapters, curation, the magazine layout — with "Open the editor's desk →" when owned, the ₱3,500 unlock when not.

Honest gaps kept visible: gallery pre-fill from "prenup shots stored in the app" has NO canonical store today (nothing in the schema holds prenup shots) — upload stays until such a store exists; vendor-synced ceremony/reception times are design-first (owner-chosen), not built here. No migration.

SPEC IMPACT: None — editor UX over existing write paths; `setOpenBrowse` writes the existing `events.website_open_browse` column.
