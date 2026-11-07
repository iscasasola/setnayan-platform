## 2026-11-07 · feat(supplier-today): steps 5 and 6 of "Get your shop live" — one row per paper, the shop QR, and the first-visit tour

Plan: `build-sessions/PLAN-SUPPLIER-GO-LIVE-BUILD-2026-11-07.md` Track C1–C3. Contract: the Today screens of the v21 open-shop prototype.

- **Step 5 · Send your documents.** One row per `REQUIRED_DOC_SLOT_KEYS` paper (new pure model `lib/setup-papers.ts`, which draws from `DOC_SLOTS` with no hand-kept list).
  - A row with no file is one tap: an **Add** pill opens the picker of the shipped `FileUpload` (bucket `vendor-verification`). The upload itself is hidden; the pill drives it, the same way the Studio poster photo does.
  - A row with a file shows its thumbnail and "✓ Saved · <file name>". It opens to a preview with Replace and Remove under it.
  - Papers Setnayan holds say Under review / Approved / Needs a new copy as the row's line.
  - The file saves the moment it is in, through the shipped `updateDocUploadInline`. Saves are queued on the client, so two first files cannot race to make two drafts.
  - A wrong type, an oversized file and an upload that stopped are each said on the row. A refused read draws "Couldn’t load your papers", never four empty rows.
  - The shipped `VerifySection` (registration number, contacts, Submit) stays below, in a closed "Get verified" fold, so a supplier can still send for review from Today.
- **Fix · `filenameFromRef`** (`app/_components/file-upload.tsx`, now exported). It is meant to strip the `<uuid>-` that `/api/upload` puts before every stored file name. But it tested the first dash's index for 36, and a UUID's own first dash is at 8, so it never stripped. Every saved file was labelled "<uuid>-<name>".
- **Step 6 · Download your QR.** The shipped `QrCard` now draws the supplier's own page, `myPageUrl(siteOrigin(), slug)` → `/v/<slug>`. Before this, it drew the shop invite link. Copy says where the scan leads and "put it on your photos, posts and cards". Download is the filled button. The shipped file name is kept: `setnayan-shop-qr.svg`. `QrCard` gains `primary`, `note` and `onDownloaded`; its Share · Copy · Download order is unchanged. `SaveFileLink` gains `onSaved`.
- **Tour.** A saved download starts a house spotlight tour, `vendor_setup_tour_v1` in `lib/tours.ts` (shared `SpotlightMount`, no centred popup). It plays once, recorded by the shipped `completeTour` in `users.tour_seen_keys`. That record is step 6's ✓, so the tick is a saved fact, not a press. A refused read of it says "Couldn’t load" (`lib/tour-seen.server.ts`).

Guard: `app/vendor-dashboard/_components/the-papers-and-the-qr-hold.test.ts`. It checks three things: the QR leads to `/v/`, the rows come from `REQUIRED_DOC_SLOT_KEYS`, and the tour is the shared spotlight. Each was sabotage-checked. Ugat screens and the port baseline were regenerated.

SPEC IMPACT: None.
