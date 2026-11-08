## 2026-11-07 · feat(ugat): the 3 unmapped supplier pages get Root map nodes — Help, Notifications, the old one-day calendar

Supplier go-live plan E1. Three supplier screens sat "unmapped" (no Ugat node) on the Root map: `/vendor-dashboard/help`, `/vendor-dashboard/notifications` and `/vendor-dashboard/calendar/[date]`.

- **Notifications — a real joint.** `notifications` was on no node, so both bells' screens were unmapped. New joint **J65 · User ↔ Event** (`joint: notifications`) with schema claims checked against the migration replay: the table, `user_id → users`, `event_id → events`, `type`, `related_url`, `read_at`, and two absences (`vendor_id`, `thread_id` — a supplier's notices are the person's, never the shop's). The table → node binding now places `/vendor-dashboard/notifications` and `/dashboard/notifications` on Users + Events (and `/dev/notifications-lab`, plus three screens that gained one node through their imports: `/vendor-dashboard/subscription`, `/dev/maker-lab`, `/dev/supplier-plan-lab`).
- **Help and the old one-day calendar — declared, and fenced.** Neither page reads a table (Help draws `SUPPLIER_HELP_ROWS`; `calendar/[date]` forwards to `daySheetHref(date)`), so no table scan can place them. New `DECLARED_SCREEN_NODES` in `lib/ugat/screens.ts`: Help → Vendors, `calendar/[date]` → Availability, each with its reason and an `anchor` string from the page's own code. The scanner applies a declaration ONLY when it mapped nothing itself and records it as `declared` on the screen. `lib/ugat/declared-screen-nodes.test.ts` holds each one: the screen exists, the scan still finds no table (else delete the declaration), the nodes are real, and the anchor is still in the page (comments stripped). Sabotage-checked: a missing anchor fails it; a fixture proves a table read beats a declaration.

Root map: 52 → 47 unmapped screens on the release branch. `screens.generated.json` regenerated.

SPEC IMPACT: None. Flagged for the controller: `DECLARED_SCREEN_NODES` is the first exception to the scanner's "no table, no node" rule — fenced by a test, but it is a new kind of evidence on the map.

**Carried onto `claude/supplier-1build` (lane R1, 8 Nov), PR #7370.** The joint is **J65**, not J62: the B2 lanes took
J62–J64 on the release branch. No migration. ⚠ Found while renumbering, not touched: the base already carries **two
joints with id `J61`** (guest reviews, and the supplier scan claim) — flagged to the controller.
