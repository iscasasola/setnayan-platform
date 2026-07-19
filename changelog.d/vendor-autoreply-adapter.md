## 2026-07-18 · feat(vendor-autoreply): Phase 3a — DB→snapshot adapter

Pure adapter (`apps/web/lib/vendor-autoreply/adapter.ts`) mapping the vendor's own
loaded rows (`VendorServiceRow` / packages / coverages / reviews) + the couple's
Event Brief into the Phase-2 engine contract: active-only filtering, expired-
discount pruning, centavos→PHP for packages, per-head budget derivation. 6
`node:test` cases. Not wired yet (Phase 3b hooks it to the inbox); flag-gated by
`NEXT_PUBLIC_VENDOR_AUTOREPLY_V1`.

SPEC IMPACT: None.
