## 2026-11-04 · feat(supplier-scan): slice 2 — Ordered → Received, and "#0042 is ready" to one guest

Slice 2 of 5 of the supplier claim scanner (stacked on slice 1). Owner rulings: DECISION_LOG 2026-09-25 "TWO SUPPLIER
SERVICE MODES: RECEIVED ONLY or ORDERED → RECEIVED" · "READY TO CLAIM + A GUEST ANNOUNCEMENT" · "ALL ANNOUNCEMENTS GO
THROUGH THE ONE COORDINATOR ANNOUNCEMENT CHANNEL" · "ANNOUNCEMENTS SHOW ONLY ON THE EVENT HUB"; prototype frame F.

- **Migration `20271320900784`**: the mode `ordered_received` (settings + claims CHECKs widen); claims gain `state`
  (ordered → ready → received), `ready_at`, `received_at`; one claim per guest per service per event in both modes.
  `supplier_scan_claim` now orders on the first scan (the number is allocated then and kept), answers "not ready" before
  Ready (nothing changes), receives after Ready, and "already" after that. `supplier_scan_ready(event, service, number)`
  moves a number's ordered claims to ready AND writes ONE line per guest into `coordinator_broadcasts` with the new
  `target_guest_id` and `sender_role = 'supplier'` (CHECK: a supplier's line is always for one guest, and only a
  supplier's is). The words are built in SQL from the service's and the shop's own names. The browser holds no write
  grant on `target_guest_id`. `supplier_scan_numbers` = "Your numbers", counts only.
- **One channel, one guest**: `fetchLatestBroadcasts` reads event-wide lines only (`target_guest_id IS NULL`), so
  "#0042 is ready" never reaches the room; `GET /[slug]/announcement` keeps its gate line as it was and adds the pass
  holder's own newer notice (`passHolderOf` · `latestNoticeForGuest` · `newerOf`) — the same `DayOfAnnouncement` card,
  Event Hub only, no email.
- **Scanner**: the count reads "Ordered 12 · Ready 3 · Received 20 of 118"; the result line "✓ Ordered · #0042" ·
  "Not ready yet · #0042" · "✓ Received · #0042" · "Already received · #0042". **Your numbers** (new, under the
  scanner): newest first, "#0042 · 1 guest · 7:41 PM · Ordered"; a tap opens the number in place, Ready inside it.
- **Guest**: the Your number card adds "Being prepared" / "Ready — claim it now". **Couple**: Suppliers' scans shows
  Ordered / Ready on numbers not yet collected. Ugat J61 gains the state and the targeted line.
- Tests: `tests/db/a-supplier-scan-orders-then-hands-over.db.test.ts` (5) · `lib/supplier-scan.test.ts` (+1).

SPEC IMPACT: DECISION_LOG row for slice 2 added to the corpus. A souvenir service in Ordered → Received keeps its orders
in `supplier_scan_claims` (made to order), not on the couple's souvenir desk — only an on-the-spot (Once) souvenir is
the desk's own row. Said in the PR for the owner.
