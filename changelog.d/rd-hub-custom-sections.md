## 2026-09-24 · feat(event-hub): a section of your own is Pro, laid out four ways, and removable

Event Hub Build 4. The couple's own sections (`custom_1`–`custom_6`, shipped 2026-09-23 in
`35e8c4c9c`) already existed; this adds the four deltas the controller named — no new storage, no
migration, and ZERO new `"use server"` exports (`saveCustomSection` gained an `intent` field:
save · arrange · delete; absent = save, so every older form still works).

- **Pro gate.** `addCustomSection` refuses a couple without Event Hub PRO server-side (admin-client
  SKU read, as `website/colors/actions.ts` does); `saveCustomSection` refuses save/arrange on an
  EMPTY section without Pro but keeps the grandfather rule — a section that already has words stays
  editable. Removing is never locked. The editor shows the feature named and locked via the page's
  own `lockPanel(...)` (ProLockPanel passed as an element; ProLockPanel/EditorShell untouched).
  Decision: `customSectionWriteAllowed` in `lib/custom-sections.ts`.
- **Layouts.** The four chapter arrangements (photo behind · photo left · photo right · words only)
  as a closed set (`hubArrangement`; malformed → no write). The photo is the SAME `canvas.media` +
  3x3 focal + zoom the background already stores (public-bucket allow-list + own-photo check in
  `setWidgetBackground`) — one photo, one home. `hubPhotoPlacement` decides behind / beside / none;
  the frame draws the matching layer; `.hub-photo-beside` is one column at 375px and two only from
  768px. "Words only" now draws no picture even if one is chosen.
- **Delete.** A real row delete, counted (`.select()` — a refused delete is zero rows, not an error),
  so the slot is free for Add again. Confirmed with a no-JavaScript `<details>` disclosure.
- **Limits.** `CUSTOM_COLUMN_TITLE_MAX` / `CUSTOM_COLUMN_BODY_MAX` imported from the recap's
  custom-columns module (local 80/4000 copies removed). Over the limit is REFUSED at the write door
  (`readCustomSectionInput`, `?error=too_long`) and DROPPED on read (was: silently truncated),
  matching `readCustomColumns`. CRLF from a textarea is normalised before measuring, so a body the
  input's `maxLength` allowed is never refused for its line breaks.

Tests: `lib/a-section-of-your-own-is-pro-and-laid-out.test.ts` (new); `a-section-of-your-own.test.ts`
updated for drop-not-truncate; `the-canvas-fails-visible.test.ts` learns the two photo-beside layers.

SPEC IMPACT: None to the corpus rulings — implements DECISION_LOG 2026-09-24 "EVENT HUB CUSTOM
SECTIONS: SIX PER PHASE" (six slots in every phase satisfies it; controller ruled no per-phase
slots). Note for that row: the feature pre-dated the ruling (shipped 2026-09-23, `35e8c4c9c`).
