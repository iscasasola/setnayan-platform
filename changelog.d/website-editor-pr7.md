# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · feat(website): show / hide / reorder sections inline (PR-7)

The most WYSIWYG-natural control in the editor: the couple rearranges their website while watching it rearrange in the preview beside them.

- **`_components/sections-panel.tsx` (new)** — every hideable section in display order with, per row: a **Visible / Hidden** toggle, **↑ / ↓** reorder, and the three-state **Auto · Shown · Hidden** open-browse mode. Always-on sections are deliberately not listed — they can't be hidden or moved, so offering the controls would be a lie.
- **Server component, no JavaScript** — each control is its own small form posting to the SAME widgets actions the sub-page uses (`toggleWidgetVisibility` · `moveWidgetUp` · `moveWidgetDown` · `setSectionMode`). The write layer is untouched and the panel keeps the slow-4G posture the widgets editor already held.
- **`Shown` is disabled while a section has no content**, matching the rule `setSectionMode` enforces server-side — forcing on an empty section would publish a blank block to guests. Content presence comes from the same `computeSectionContentMap` the sub-editor uses, so the editor and the guest site can never disagree about what "has content" means.
- **`return_to` adopted across the widgets actions** — success, silent-no-op (order boundaries, always-on) and error redirects all return to the editor with the row open. Opt-in and default-identical, so the sub-page flow is unchanged.

**Editing inline (8):** sections show/hide/reorder · hero photo · photo gallery · background music + hero video · who can view · colors · special message · what to bring.
**Still their own focused editor (4):** dress code · photo moments · our story · editorial — multi-field and long-form authoring surfaces, next and last. No migration.

SPEC IMPACT: None — a new panel over the existing widgets write layer.
