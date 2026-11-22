## 2026-11-22 · feat(suppliers): "Copy to Google Drive", one event at a time, into the supplier's own Drive

Owner, 22 Nov 2026 (DECISION_LOG "COPY THIS EVENT TO GOOGLE DRIVE"; SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC § H+): *"they can also sync their events to Google Drive accounts per event."* Reuse of the shipped Drive copy layer, not a second one.

- **Where:** a "Copy to Google Drive" button on the supplier's Files page for each client event (under the files board) and on each event's private album (Papic page). One reusable piece, `app/vendor-dashboard/_components/copy-event-to-drive.tsx`, for the later storage page, "Make room" and grace-notice builds.
- **What it copies:** what the shop stores for that one event: its filed files (into "Files") and its private event album (into "Album"), into one folder per event in the shop's own Drive. Links are not copied; album photos still being screened or taken down are not copied.
- **Not connected:** the press opens the shipped `DriveConnectCard` (or `DriveReconnectBanner` when Google paused access). After Google's consent the supplier lands back on the same row and the copy starts by itself. A ⚙ sheet shows the account, "Use another account" and "Disconnect".
- **Honest states:** "Copying… 12 of 40 files" while it runs; "40 files in your Google Drive" (plus a small toast) only when every file is there; "3 of 4 files copied · 1 file couldn't be copied. Try again" otherwise; "couldn't read this event's files" is never shown as "nothing to copy".
- **No duplicates:** the shipped ledger (`drive_copy_artifacts`, one row per event and stored object) is reused; pressing Copy again only copies what is not in the Drive yet. Each file is tried at most once per copy.
- **Never counted, never a gate:** nothing reads or writes a storage allowance or a plan.

Schema (migration `20271359577754_supplier_drive_copy_per_event`, additive): `vendor_profile_id` on `oauth_grants`, `oauth_state`, `drive_copy_folders` and `drive_copy_artifacts`; grant provider `drive_supplier` (one per shop, no event; `oauth_grants.event_id` becomes nullable with an exactly-one-owner CHECK); artifact types `supplier_files` · `supplier_album`; the folder key widens to (event, kind, Drive, owner) `NULLS NOT DISTINCT`. The couple's rows keep their meaning, and every couple read in `lib/drive-copy.ts`, the retry sweep and the Papic stranded count now says `vendor_profile_id IS NULL`.

Routes: `/api/oauth/drive/{start,callback,disconnect}` gain a `for=shop` mode (the shop comes from the session, the way back stays inside the supplier console); new `POST /api/vendor/drive-copy` (one ~35 s press; no new server action). The OAuth refresh sweep refreshes `drive_supplier` grants like `drive`.

Guards: `lib/supplier-drive-copy.test.ts` (per-event scoping, no duplicates, honest words, the couple path never reads shop rows, the shop comes from the session; scoping and de-dup sabotage-checked red) and `tests/db/a-shop-copies-its-events-to-its-own-drive.db.test.ts`.

SPEC IMPACT: None. Builds the owner-locked H+ row as written.
