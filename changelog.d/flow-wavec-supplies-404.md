## 2026-06-20 · fix(studio): supplies-marketplace card no longer links to a 404 (flow wave C)

The Studio hub renders an App Store card for every couple-side add-on; tapping a card calls `appStoreDetailHref(key)` which, by default, points at `/studio/<key>/about` (content from `add-ons-detail.ts`). **`supplies-marketplace` has no `add-ons-detail.ts` entry**, so its card linked to `/studio/supplies-marketplace/about` — a 404 dead-end (a flow defect surfaced by the product-wide user-flow audit, studio surface, HIGH).

- **`apps/web/lib/add-ons-catalog.ts`** — `appStoreDetailHref` now links `supplies-marketplace` straight to its real surface `/studio/supplies-marketplace` (which exists), mirroring the existing `panood` exception. One-line, deterministic; the card now lands on a real page instead of a 404.

Verified: destination `app/dashboard/[eventId]/studio/supplies-marketplace/page.tsx` exists; the card is in the catalog (`ADD_ONS` key `supplies-marketplace`); no behavior change to any other add-on (only the supplies key is special-cased). tsc/lint/build via CI.

SPEC IMPACT: none — bug fix only (no schema, pricing, or product-surface change). First fix of flow wave C (uncontended surfaces). Audit + backlog: `02_Specifications/UI_UX_Polish_Remediation_2026-06-20.md` (flow program).
