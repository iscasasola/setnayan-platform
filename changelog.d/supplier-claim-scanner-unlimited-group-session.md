## 2026-11-04 · feat(supplier-scan): slice 3 — Unlimited, and Group session (one number per shot, prints adjustable)

Slice 3 of 5 of the supplier claim scanner (stacked on slice 2). Owner rulings: DECISION_LOG 2026-09-25 "…A THIRD MODE:
UNLIMITED" (*"if their service is unlimited, they can do multiple scans and it will count them again"*) and "GROUP
SESSIONS (photo booth group shots) — print count = guests scanned, adjustable"; prototype frames C · C′.

- **Migration `20271310233702`**: modes `unlimited` and `group_session`; `supplier_scan_sessions` (one shot = one
  number, its prints 1–99, open → done; one open shot per service per event; RLS at CREATE: couple/coordinator + admin
  read, no write policy); claims gain `session_id` (a guest is in a shot once; a guest may be in many shots).
  `supplier_scan_session_open` allocates the shot's number under the same counter lock (a second phone joins the open
  shot); `supplier_scan_session_done` closes it with prints = guests by default or the operator's number, and cancels
  an EMPTY shot, giving its number back when it is still the last one (a mis-tap leaves no gap).
  `supplier_scan_claim`: Unlimited → a new number per scan, "Served N · M guests"; Group → a shot open: the guest joins
  it ("#0107 · 3 guests"); none open: a pickup — a ready claim is received ("#0107 · 3 of 5 claimed"), an ordered one
  is "not ready", else "No shot open". `supplier_scan_ready` refuses a shot still open. Tally and "Your numbers" carry
  served · unique · sessions · the open shot · a shot's prints.
- **Scanner**: the shot panel — New shot · "#0107 · 3 guests in this shot" · Prints −/+ · Done (Cancel this shot when
  empty); "Your numbers" shows a shot's prints and offers Ready only once it is closed.
- Tests: `tests/db/a-supplier-scan-counts-unlimited-and-group-shots.db.test.ts` (6) · `lib/supplier-scan.test.ts` (+1).

SPEC IMPACT: DECISION_LOG row for slice 3 added. The group counter reads "Shots N · Ready N · Claimed N" — the
same word as the panel's "New shot" and Roaming's counter (owner 2026-11-05: *"your recommendation"*).
