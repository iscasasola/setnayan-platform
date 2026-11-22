## 2026-11-23 · feat(plans): the supplier storage meter counts everything a shop owns — Photos & video · Files · Records

Owner, 23 Nov (DECISION_LOG "THE SUPPLIER STORAGE METER COUNTS EVERYTHING THE SHOP OWNS — FILES AND DATA" + "THE METER SHOWS REAL USAGE ONLY"): *"we want them to achieve limits asap"*, *"their calendars schedule, website and every data compiled to them is computed"*, *"No, real usage only"*. Stacked on the plans builder's final ladder (`claude/supplier-subs-1-ledger-2026-11-22`).

- **Every file counts, at its real size.** The meter used to count two things: event files and the Papic portfolio. It now also counts logos, covers, card photos and videos, payment QR, booth posters, verification papers, the clean and marked copies of a shop photo, Papic captures, chat files the shop sent, contracts, handover files and mood-board suggestions.
  - A new ledger, `supplier_stored_files`, holds the size of each upload no other table records. `/api/upload` writes it when it signs the upload (the signed length is the real size); a server action that stores a shop file writes it too; deleting the object (`r2Delete`) releases it.
  - Event files keep their own size on the stored copy and are never written to the ledger (no double count).
- **Every record counts, at its stored size.** `supplier_storage_records` holds what the shop's data weighs: `pg_column_size` of every row in every table that names the shop (227 tables today, 201 counted), plus a booking's own rows (line items, payments, tasks) through `event_vendors`. A new table that names a shop is counted by default. Only Setnayan's own books, its safety and admin records, sign-in secrets, device addresses and the meter's own rows are left out, each with its reason (`supplier_storage_record_sources`).
  - Measured by a nightly job (`supplier_storage_records_nightly`, pg_cron), and once on a shop's first look. A page view never rescans (owner: "never a scan per page view").
- **ONE read:** `vendor_storage_breakdown` (service role only). It feeds the Plans page, the limits sheet and the upload gate. `vendor_storage_used_bytes` (the filing backstop) is now the same total.
- **The Plans page meter** replaces the old Storage row, as the approved drawing does (`prototypes/supplier_storage_page_2026-11-22/`, § 1). It shows:
  - plan · size and the percent used;
  - one bar split Photos & video · Files · Records, with "X of Y used · Z free";
  - the chat & documents room on its own line;
  - a notice at 80% and 100% that names the space filling up.
  - Real usage only: a new shop reads its true few KB, never a reserve.
- **The gate.** Every upload into a shop's own folders, and every file the shop sends in chat, is checked before it is signed:
  - photos and video fit the plan less the chat & documents room;
  - documents fit the room;
  - **evidence** (verification papers, contracts) is counted but never refused, even when the read fails;
  - words, quotes, receipts and payment proofs are never gated.
- **The room size.** Free 0.5 · Verified 1 · Plus 10 · Pro 50 · Ultra 100 GB, as ruled, in one constant map (`DOCUMENTS_ROOM_RULED_BYTES`). It is never more than half the plan (the Verified row's own rule), so Free's room reads 128 MB until a ruling says otherwise.
- Guards:
  - `tests/db/the-meter-counts-every-shop-table.db.test.ts`: every shop table counted or left out with a reason; a new table counted; booking rows; a new shop's few KB; a busy shop's kinds; the media twin; service role only.
  - `lib/the-meter-counts-every-upload-root.test.ts`: every upload folder in the app is a counted shop root or a named non-shop root.
  - `lib/supplier-storage.test.ts`: the room gate and evidence.

**Migration `20271360925434_supplier_storage_meter_counts_everything`** (do-not-auto-merge): two service-role tables (RLS on, no policy), six functions and one pg_cron job. No price, no plan number, no write to any shop's data.

SPEC IMPACT: Free's chat & documents room. The ruled 0.5 GB is larger than Free's 256 MB plan (cut on 23 Nov, after the room was sized for a 1 GB Free). This build caps every room at half its plan (the Verified row's "the room never equals the whole plan"), so Free reads 128 MB. A DECISION_LOG row is needed from the controller. Otherwise this builds the ruled spec § ★ A (sizes) · H (meter block) · K (room, evidence).
