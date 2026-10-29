## 2026-10-30 · feat(shop-page): supplier website by plan, slice 2 — the "since" fact line, "N events ›" by kind, Check a date

Owner-approved 2026-10-30 ("Supplier website by plan approve", DECISION_LOG "APPROVED — THE SUPPLIER WEBSITE BY PLAN"; contract `prototypes/build-contracts-2026-10-30/supplier-website-by-plan/`, OWNER-NOTES items 104 and 114).

- **One "since" fact line** on `/v/[slug]`: `In business since 2019 ✓ · 87+ events › · On Setnayan since Oct 2026` (`_components/shop-since-line.tsx`). It replaces the "N yrs in business · N+ weddings" pill and the "On the marketplace since …" line. Kept: ✓ DTI-verified vs "self-reported", the declared wedding count (now inside the events sheet), the joined-here half ungated and never hidden. The words come from `lib/in-business-since.ts`, the phrasing Your details already uses ("Since is two lines", 2026-10-29).
- **"N events ›" + a sheet of the total by kind** (`lib/shop-events-by-kind.ts`, `_components/events-by-kind.tsx`, the shared `Sheet`): kinds from the Track record's own receipt-backed rows (`vendor_completed_events`, no new read), the shop's own `weddings_done_approx` in the Wedding row as an at-least (the larger of the two, never the sum). Nothing measured → nothing drawn, never "0 events".
- **Check a date** beside Inquire · Share (action row and the Pro desktop rail), same `bookable` gate, → `/v/[slug]/dates` (route built by PR #7007 — merge after it).
- Dev lab `/dev/shop-page-lab` (404 in production) mounts the real pieces for the side-by-side shots.

SPEC IMPACT: None — builds the approved 2026-10-30 contract. Two gaps are reported, not invented: a shop cannot declare non-wedding counts (only `weddings_done_approx` exists), so the by-kind rows for debuts/corporate/… are Setnayan-measured only; and the declared wedding count has no writer in the app today.
