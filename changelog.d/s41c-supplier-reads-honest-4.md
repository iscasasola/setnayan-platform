## 2026-09-19 · fix(supplier): result-dropped-silently, SUPPLIER tier batch 4/4

S41c · SUPPLIER tier, batch 4 of 4 of the `result-dropped-silently` class from
S26's both-ends orphan baseline (PR #5625, not yet merged — its code pattern is
final and mirrors the already-merged MONEY/BOOKING batches, PRs #5650 / #5656).
17 `lib/` files, 19 discarded-error call sites. With this batch, all 68
SUPPLIER-tier `result-dropped-silently` sites are addressed across batches A–D.

Two shapes, per site:

- **Shape 1 (log-only)** — 17 of 19 sites already fail soft/closed correctly
  (an empty map, `null`, `false`, `0`); each now carries a
  `console.error('[supabase-error] <path> · <target>', error)` so a refusal
  leaves a trace instead of vanishing identically to a genuine empty/absent
  result:
  - `lib/vendor-pipeline-pressure.ts` — `rpc:vendor_whitelist_pressure`
  - `lib/vendor-profile.ts` — `from:vendor_profiles.select`
    (`fetchVendorBusinessStartDate`), `rpc:vendor_customer_source_counts`
    (`fetchVendorCustomerSourceCounts` — currently uncalled anywhere in the
    app; logged for when it is wired up)
  - `lib/vendor-qr-media-guard.ts` — `from:vendor_qr_media_flags.upsert`
  - `lib/vendor-recommendations.ts` — `from:vendor_recommendations.select` ×2
    (`countVendorRecommendingCouples`, `fetchEventRecommendations`). Kept
    `countVendorRecommendingCouples`'s existing "reports 0 on a refused read"
    contract as-is (an explicit regression test,
    `lib/recommendation-count-survives.test.ts`, already locks this in by
    name) — only the trace was missing.
  - `lib/vendor-service-addons.ts` — `from:vendor_service_addons.select`
  - `lib/vendor-service-public.ts` — `from:vendor_coverages.select`,
    `from:vendor_service_inclusions.select`
  - `lib/vendor-services.ts` — `from:vendor_service_inclusions.select`,
    `from:vendor_services.select` (the `fetchBoothCardItems` inner read)
  - `lib/vendor-signup-coverage-suggest-server.ts` —
    `from:vendor_web_dossiers.insert`
  - `lib/vendor-theft-watch.ts` — `from:vendor_image_flags.select`
  - `lib/vendor-verification.ts` — `from:vendor_profiles.select`
    (`isMarketplaceVendorBookable`, already fail-closed — a booking gate, not a
    render), `from:vendor_verification_applications.select`
    (`fetchContactConfirmations`, admin-only caller)
  - `lib/verification-checks-server.ts` — `from:vendor_profiles.select` ×2
    (`readPayoutNameFacts`, `otherShopsHoldingNumber` — both admin-review-only
    callers)
  - `lib/verified-badge-sweep.ts` — `from:vendor_verification_applications.select`
    (`settleLapsedVouches`'s `countErr`, a daily background sweep)

- **Shape 2 (honest render state)** — 1 of 19: `lib/vendor-trusted-by.ts`'s
  `vendor_profiles` half of `fetchTrustedByVendors` (the "Trusted by" endorsement
  badge, rendered on a shop's own PUBLIC profile at `/v/[slug]` AND read by the
  shop itself). A refused read used to fall through to the same `[]` as "no
  other vendor has endorsed this shop yet" — indistinguishable from a shop with
  five endorsements whose read got refused. Added `TRUSTED_BY_UNREADABLE =
  'unreadable' as const`, widened the return type, and gave
  `app/v/[slug]/page.tsx`'s `TrustedBySection` a distinct `unreadable` branch
  ("We couldn't load «shop»'s vendor endorsements right now") that renders
  BEFORE the `vendors.length === 0 ? null` empty-state check — mirroring PR
  #5656's `saved-vendors.ts` / `VendorsTab` shape exactly.

New test: `apps/web/lib/s41c-supplier-batch-d-reads-are-honest.test.ts` (12
tests) — executes 6 shape-1 readers against a stubbed refused client (asserts
the unchanged fallback value AND exactly one `[supabase-error]`-prefixed
record, and a missing-row/no-error case leaves zero records), executes the
shape-2 sentinel both ways (refused → `TRUSTED_BY_UNREADABLE`; genuinely empty
→ `[]` with no log), and source-asserts (via `stripComments`, on function-body
slices, never a bare grep) that `TrustedBySection`'s unreadable branch precedes
its empty-state return, that `verified-badge-sweep.ts`'s `countErr` guard now
logs before its `continue`, and that `verification-checks-server.ts` carries
BOTH of its two `vendor_profiles.select` log lines (count, not just presence).
Sabotage-proven locally: reverting any one of the 5 above independently turns
exactly one test red. Ran clean alongside the full set of pre-existing test
files that cover the 17 touched modules (`vendor-verification.test.ts`,
`recommendation-count-survives.test.ts`, `vendor-service-public.test.ts`,
`vendor-pipeline-pressure.test.ts`, `vendor-signup-coverage-suggest-server.test.ts`,
`vendor-services.test.ts`, `vendor-profile-completeness.test.ts`,
`service-card-cover-fallback.test.ts`, `vendor-partnership-kinds.test.ts`,
`verification-bypass.test.ts`, `lib/security/select-column-scan.test.ts`,
`lib/a-database-error-is-never-ignored.test.ts` — the LAU-31 ratchet, unaffected
since this batch's sites are read-error `.select`/`.upsert`/`.insert` sites, not
the write-error class that baseline tracks — and
`app/admin/verify/the-reviewer-can-open-the-paper.test.ts`).

SPEC IMPACT: None — observability + one honest-render fix on an existing
surface, no schema or product-decision change.
