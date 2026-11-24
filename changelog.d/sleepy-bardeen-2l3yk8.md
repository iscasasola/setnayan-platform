## 2026-11-23 · feat(plans): the supplier storage meter counts everything a shop owns — Photos & video · Files · Records

Owner, 23 Nov (DECISION_LOG "THE SUPPLIER STORAGE METER COUNTS EVERYTHING THE SHOP OWNS — FILES AND DATA" + "THE METER SHOWS REAL USAGE ONLY"): *"we want them to achieve limits asap"*, *"their calendars schedule, website and every data compiled to them is computed"*, *"No, real usage only"*. Stacked on the plans builder's final ladder (`claude/supplier-subs-1-ledger-2026-11-22`).

- **Every file counts, at its real size.** The meter used to count two things: event files and the Papic portfolio. It now also counts logos, covers, card photos and videos, payment QR, booth posters, verification papers, the clean and marked copies of a shop photo, Papic captures, chat files the shop sent, contracts, handover files and mood-board suggestions.
  - A new ledger, `supplier_stored_files`, holds the size of each upload no other table records. `/api/upload` writes it when it signs the upload (the signed length is the real size); a server action that stores a shop file writes it too; deleting the object (`r2Delete`) releases it.
  - Event files keep their own size on the stored copy and are never written to the ledger (no double count).
- **Every record counts, at its stored size.** `supplier_storage_records` holds what the shop's data weighs: `pg_column_size` of every row in every table that names the shop (227 tables today, 201 counted), plus a booking's own rows (line items, payments, tasks) through `event_vendors`. A new table that names a shop is counted by default. Only Setnayan's own books, its safety and admin records, sign-in secrets, device addresses and the meter's own rows are left out, each with its reason (`supplier_storage_record_sources`).
  - Measured once a Manila night from 03:00 by a claimed, cron-free job (`supplier-storage-records`, `lib/supplier-storage-measure.server.ts`, carried by the homepage and the admin console; no pg_cron, cron.job stays empty), and once on a shop's first look. The first request after 03:00 runs it, so a quiet night catches up, and the claim never runs it twice in one night. A page view never rescans (owner: "never a scan per page view").
  - The meter says how current Records are: "Records measured 5 hours ago", flagged "last measured 4 days ago" when a night was missed, and "Not measured yet" (never 0 KB) before the first measure.
- **ONE read:** `vendor_storage_breakdown` (service role only). It feeds the Plans page, the limits sheet and the upload gate. `vendor_storage_used_bytes` (the filing backstop) is now the same total.
- **The Plans page meter** replaces the old Storage row, as the approved drawing does (`prototypes/supplier_storage_page_2026-11-22/`, § 1). It shows:
  - plan · size and the percent used;
  - one bar split Photos & video · Files · Records, with "X of Y used · Z free";
  - a notice at 80% and 100%.
  - Real usage only: a new shop reads its true few KB, never a reserve.
- **One storage number per plan, no chat & documents room.** Owner 23 Nov: *"let us not set Room anymore?"* → *"Yes, drop it"*. When the plan is full, only new photos and videos wait:
  - photos and video must fit the whole plan (`/api/upload` before it signs, and the database backstop `enforce_supplier_storage_allowance` when a copy is filed on an event);
  - documents and chat files always go in, at both gates, and still count;
  - **evidence** (verification papers, contracts) is counted but never refused, even when the read fails;
  - words, quotes, receipts and payment proofs are never gated.
  - The storage sizes themselves change in the storage-ladder PR.
- **A full Free shop is offered Get verified** (DECISION_LOG "SUPPLIER SIZES FIXED (FINAL)": "Full Free → Get verified"). The refusal ends "… or get verified, free: <what Verified gives, with its size>", not a paid plan (`storageWayUp`). Verified and up still name the next paid size.
- Guards:
  - `tests/db/the-meter-counts-every-shop-table.db.test.ts`: every shop table counted or left out with a reason; a new table counted; booking rows; a new shop's few KB; a busy shop's kinds and no room column; the media twin; service role only.
  - `tests/db/supplier-storage-allowance.db.test.ts`: a document past a full plan still files and counts; the next photo is refused.
  - `lib/the-meter-counts-every-upload-root.test.ts`: every upload folder in the app is a counted shop root or a named non-shop root.
  - `lib/supplier-storage.test.ts`: photos fit the whole plan; documents and evidence always go in.
  - `lib/supplier-storage-records-are-honest.test.ts`: the meter has no room line, and a full plan's notice says documents still go through.

**Migration `20271360925434_supplier_storage_meter_counts_everything`** (do-not-auto-merge): two service-role tables (RLS on, no policy), six functions and the filing backstop re-made so a document always goes in. No scheduler, no price, no plan number, no write to any shop's data.

SPEC IMPACT: Spec § ★ H · K's chat & documents room is dropped by the owner (23 Nov, "Yes, drop it"): one storage number per plan, and only photos and videos wait when it is full. A DECISION_LOG row is needed (the storage-ladder session records it with the final sizes). Otherwise this builds the ruled spec § ★ A (sizes) · H (meter block) · K (evidence).
