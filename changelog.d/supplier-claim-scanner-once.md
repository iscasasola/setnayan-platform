## 2026-11-04 · feat(supplier-scan): the supplier claim scanner, slice 1 — a scanner per service, Once (received only)

Owner-approved design `prototypes/supplier_scan_2026-10-03_fable.html` (DECISION_LOG 2026-10-03 "SUPPLIER SCAN … APPROVED"),
the 2026-09-25 rows (count only · shared #0001 · NFC = QR · souvenirs write the couple's own record · the scanner explains
QR vs NFC) and 2026-10-29 "A SUPPLIER'S TOOLS + SCANNER ARE SET ONCE PER SERVICE". Slice 1 of 5 (stacked draft PRs).

- **Migration `20271320327933`**: `supplier_scan_settings` (one row per service = `vendor_coverages` row; on/off + mode,
  `CHECK (mode IN ('once'))` — later slices widen it as each mode is built), `supplier_scan_counters` (the shared number
  per service per event, moved only under its row lock), `supplier_scan_claims`; `guest_souvenir_claims` EXTENDED with
  the supplier, the service, the number and the methods `supplier_qr` / `supplier_nfc` — a souvenir service's scan writes
  the couple's own desk row, so the two desks are one record. Functions `supplier_scan_claim` · `supplier_scan_tally` ·
  `supplier_scan_services` · `supplier_scan_shop_for` (SECURITY DEFINER): shop or its day-of grantee · booked · the
  booked service · scanner ON · a listed guest of THIS event; anything else writes nothing. RLS at CREATE; suppliers have
  no read of the claim rows.
- `supplier_scan_claims.state` exists from this slice (`'received'` only; slice 2 widens it). #7337's one guest-review
  writer reads `state = 'received'` as soon as the table exists, so without it, shipping this slice alone would make
  every review from a guest the door never checked in fail with "column c.state does not exist" — caught by #7337's
  own `host-and-guest-reviews.db.test.ts` in this PR's DB replay.
- **Shop › Services**: each service row gets ONE dropdown under it — Scanner: Off · Once (`ServiceScannerPick`); the save
  runs behind the choice and a refusal puts it back.
- **Event Hub › Scanner** (`EventHubScanner` → `SupplierClaimScanner`): the service, its mode, the last number and
  "Claimed N of T"; Start scanning opens the camera (`useLiveQrScan`, which now answers the same code again after it
  has been out of view for a moment); NFC where the phone reads it (`useNfcTagReader`); one result line — "✓ #0042 ·
  Claimed 142 of 176" · "Already claimed · #0017" · "Not a guest of this event". The NFC line says what works on THIS
  phone (iPhone browsers: use the QR or the app), the device table behind the ⓘ. No signal → "No signal · Nothing was
  recorded" (nothing queued — the number is the database's). A host-approved coordinator sees the full name because
  the action re-reads the guest row under their own RLS; every other booked supplier sees the guest's FIRST name
  (owner 2026-11-05 *"name is fine"*), from `supplier_scan_first_name` — only after its claim is recorded, never the
  last name.
- **Guest**: a quiet "Your number #0042 · Photo booth · <shop>" under Now on Live and on Me (`YourNumberCard`).
- **Couple**: Guests › Souvenir table gains "Suppliers' scans" — every claim with the guest's name, service, supplier,
  QR/tag and time (read-only: a supplier's claim is fixed by Setnayan, so the two sides can never be told different things).
- **Admin**: Admin › the event › "Suppliers' scans" — every claim with names; Remove takes one back (audited in
  `admin_audit_log`; its number is left unused).
- **One server action** `app/_actions/supplier-scan-actions.ts` (`supplierScan`, ops `set_scanner` · `claim` ·
  `admin_remove`; the later slices add ops, never exports) — `lint-server-action-budget` CEILING 1227 → 1228.
- **Ugat**: node `TYPE-SUPPLIER-SCANS` + joint J61 (claims checked against the replay). iOS `NFCReaderUsageDescription`
  now also names reading a guest's tag (DECISION_LOG 2026-09-25).
- Tests: `tests/db/a-supplier-scan-claims-once.db.test.ts` (8) · `lib/supplier-scan.test.ts` (4).

SPEC IMPACT: DECISION_LOG row "SUPPLIER CLAIM SCANNER — SLICE 1 BUILT" added to the corpus. Resolved by the owner 2026-11-05
(*"name is fine"*): the 2026-10-28 "ONE SCANNER FOR EVERY SERVICE" row's "number + first name" wins over the older
"count only". Still noted: the
2026-10-28 EV3 ruling queues day-of scans offline — a claim's number is allocated by the database, so this slice says
"No signal" and records nothing rather than queue a claim without a number.

- **Export (RA 10173), 2026-11-06:** the scans a crew member made are in their own "Download my data" file as
  `supplier_scans_made` (read by `scanned_by_user_id`; the guest and the event are not selected), so the table is
  exported rather than added to `KNOWN_GAPS` — main had lowered that ceiling to 68.
