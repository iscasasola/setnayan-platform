## 2026-11-10 · feat(marks): Build 6 Lane L — the supplier seal on every server path, the re-mark job, and the Setnayan mark by event plan

Owner, 10 Nov: *"yes build 6"*. Plan: Setnayan-specs `plans/supplier_build_6_2026-11-10/00-BUILD-6-PLAN.md` § Lane L ·
DECISION_LOG 2026-11-04 "SETNAYAN MARKINGS BY PLAN" and "SUPPLIER PHOTO MARK = SEAL AND PLATE".

**Rule 0, measured first.** The seal was already on every *browser* supplier upload (the six `<FileUpload mark="supplier">`
sites — Portfolio, service cards, showcase — carried onto the release as R2 of #7246/#7247; covers are a pick from the
Portfolio). The plan's "only Inspiration has it" was stale. What was unmarked was the paths with **no browser**:

- **One server door — `lib/supplier-photo-publish.server.ts` `publishMarkedSupplierPhoto`.** Clean copy (private
  `vendor-originals/<shop>/server/…`) → the shop's mark from its own row (`shopMarkFacts`) → ONLY the marked bytes go
  public → paired in `supplier_photo_originals`. Fails closed (never catches); a stored clean copy wins, so a re-run never
  double-marks.
- **Album → page** (`publishDueSupplierPagePhotos`) was a raw `r2Copy`; it now goes through the door, and a failed mark
  keeps the notice waiting. A guest's Remove now also deletes the clean copy and the pairing (scope widened in
  `supplierPageAlbumCopyScope`).
- **Instagram re-host** was a raw `r2Upload`; it now goes through the door, and a post that cannot be marked drops out.
- **The backfill** — `scripts/remark-supplier-photos.ts` now plans the photos published before the mark existed
  (`lib/supplier-photo-backfill.ts`: unpaired refs under the shop's own folder, each once; clips and foreign refs only
  reported) as well as the Verified re-marks. `--dry-run` counts and writes nothing; `--apply` is refused unless
  `--confirm=` names the project the URL points at. **Not run against production by this session.** Prod, SELECT
  2026-11-10: 4 shops · 3 services · 0 portfolio / service / Instagram photos stored → the dry run would report 0 today.

**The Setnayan mark by plan** — `lib/setnayan-mark-by-plan.ts` (`setnayanMarkFor`: Free → watermark · Event Plus →
one quiet "Made with Setnayan" · Event Pro → none) read by `eventSetnayanMark` from the SHIPPED readers only
(`eventCoupleWebsiteProActive` + `eventSkuActive(EVENT_PLUS)`, `asViewed`; a failed read = the watermark). Drawn by one
component, `SetnayanMarkLine`:
- Event Hub footer + the kit's closing band + the private landing (`setnayanMark` beside the old `hideWatermark`).
- Seat pass and find-my-table: printed "Powered by Setnayan" on EVERY event, Pro included — now by plan; their header
  logo shows on Free only (Plus/Pro read "← Event Hub").
- Recap: the published recap's footer was called with no props and printed the watermark on Pro — fixed.
- Prints and passes: `PrintBrand` gains `none`; `loadPrintSet` sets the brand from the plan (`printBrandForMark` — never
  louder than the look's own); the preview cache key includes the mark; an Event Pro pass carries no foot mark.

**Guards:** `lib/every-supplier-photo-is-marked.test.ts` (the door fails closed; every server R2 writer is the door,
uses it, or is named with why it is not a supplier photo; album + Instagram paths; the backfill plan) ·
`lib/setnayan-mark-by-plan.test.ts` (a guard per plan; Pro renders nothing; paper; no guest page spells the watermark).
Sabotage-proven 2026-11-10: Pro→quiet, the recap footer stripped, both `none` exits removed from `brandPiece`, the door
publishing the clean bytes, Instagram back on `r2Upload` — each goes red.

**Not done here (flagged):** the guest DOORS under `app/[slug]/` (invite · welcome · request · reply · enter) still draw
their "Made with Setnayan" foot line on Event Pro — it needs the mark threaded into each door's skin; the editorial and
keepsake colophons still show "Powered by Setnayan" on Plus (hidden on Pro as before); a Pro event's QR centre falls
back to the Setnayan mark when the couple's logo cannot be drawn.

Shots: `build-notes/shots/b6-lane-l/` (375, light + dark). ⚠ The Plus placement is a proposal for the owner's OK.

SPEC IMPACT: None to the corpus wording — this builds the 2026-11-04 rulings as logged. The plan tables (Lane J) may now
say Plus "Only a small Setnayan mark" / Pro "No Setnayan marks — fully yours" only once the doors above are done.
