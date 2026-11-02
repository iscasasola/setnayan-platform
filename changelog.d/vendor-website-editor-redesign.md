## 2026-07-02 · refactor(vendor-shop): direct on-surface Website editor + de-headline "Live" tile

Owner feedback on the first build ("actual place for the photo, tap to replace ·
actual editable text box · too boxy · the tile still says Live"). Reworks the My
Shop → Website editor from summary-rows-behind-an-Edit-collapse into a **direct,
on-surface editor**, flattened to the approved minimalist look.

- Every control IS the surface now — no "Edit → expand → form → save":
  - **About** — an always-visible text box + an inline Save (enabled when dirty).
  - **Featured services** — tappable chips (instant save, capped at 3).
  - **Sections** — real toggle switches (instant save).
  - **Hero photo** — a live photo grid; tap a thumbnail (or "Automatic") to set
    it, selected one ringed + checked (instant save).
  - **Accent** — swatches, tap to apply (instant save).
  - **Custom address** — inline input + Save.
  - **Pinned review** — radio list, tap to pin (instant save).
- Instant controls save **optimistically** (revert + toast on error); the two
  text fields save on an inline button. All wired through the existing
  `updateVendorWebsiteField` server action (called directly from the client).
- **Flat + hairline-divided** — dropped the boxed cards + heavy tinted blocks for
  the clean minimalist look that was approved.
- **Tile** — the Website manage-tile no longer headlines "Live"; it reads
  "Website / Your page / Customize here" with a small de-emphasized Live/Draft
  status pill in the corner (new optional `statusPill` on the shared `ToolTile`).

No schema/action/API change — pure UI/interaction rework. tsc + lint green.

SPEC IMPACT: None (interaction + styling only; same fields, same gating).
Supersedes the boxed collapse-to-edit layout from the initial editor PRs.
