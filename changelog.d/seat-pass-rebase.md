## 2026-06-28 · feat(seating): personalized seat pass + public QR resolver + arrival bloom (seat-finding PR 4/6)

The last slice of the locked 6-PR seat-finding program. A Custom-QR-gated
personalized wayfinding layer — strictly additive; the free find-my-table
(INDOOR_BLUEPRINT) surface is untouched and no live SKU is retired.

- **`/[slug]/seat?t={token}` — dual-token resolver.** A scanned `event_tables`
  QR renders the public table view (label · occupants by first name + last
  initial · route), publication-gated so a DRAFT roster never leaks. A scanned
  personal `guests` QR redirects through `/[slug]/seat/claim`, which consumes the
  token, signs the guest-session cookie, records the scan, and bounces to the
  clean tokenless `/[slug]/seat` URL (the per-guest token never lingers in the
  address bar / history / Referer).
- **Personal seat pass** — name · table · seat marker · route (reuses the shared
  `WayfindingMap` geometry) + an arrival bloom that reads `guest_checkins.checked_in_at`
  and gets richer when the event owns ANIMATED_MONOGRAM (Pakanta is a wired-but-inert
  `not_built` stub).
- **Entry point** on the guest landing page — a "Your seat pass" link shown
  beside "Find my table" only when the event owns the SKU; both can show.
- **Gating** delegates to the bundle-aware, admin-approved `eventSkuActive()`
  reader (a couple who got Custom-QR via the Essentials/Complete bundle is
  correctly entitled; a payment still under review stays dark). A `CUSTOM_QR_GUEST`
  activation hook in the sku-activation dispatcher stamps `event_tables.qr_published_at`
  on approval so the printed sheet + table-QR resolver work immediately. No new
  migration — `event_tables.qr_token` / `qr_published_at` and `event_floor_plan.published_at`
  already exist (migration `20261101000000`).

Rebased onto current `origin/main` (the branch had fully diverged from its
ancient base). Conflict resolution kept main's shipped PAPIC_SEATS hook + the
evolved `[slug]/page.tsx`, and corrected the ownership gate from the bare
`checkOrderOwnership` (which would deny bundle buyers and fail the
entitlement-gate lint) to bundle-aware `eventSkuActive`.

SPEC IMPACT: None. Wayfinding stays FREE-to-display; the pass is gated only on
the already-priced CUSTOM_QR_GUEST SKU (admin-managed catalog price, not
hardcoded). Open Indoor-Blueprint vs Custom-QR pricing reconciliation flagged
for owner — not acted on here.
