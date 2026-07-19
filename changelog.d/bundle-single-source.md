## 2026-07-05 · fix(payments): bundle composition single source of truth

Bundle composition (which child SKUs a bundle grants) was a triple hardcode —
two app consts (`BUNDLE_CHILD_SKUS` in `lib/entitlements.ts`, `BUNDLE_MEMBERS`
in onboarding pricing) plus the hardcoded `VALUES` list inside the DB fn
`public.bundles_granting_sku()`. That triple already drifted once: the
`PAPIC_UNLOCK` umbrella's `PAPIC_GUEST` child was present on the app side but
missing from the DB fn mirror (flagged "still deferred"), so `PAPIC_UNLOCK`
buyers passed the app gate for the guest disposable-camera surface while the DB
gate (`papic_event_owns_service('PAPIC_GUEST')`) still answered "not owned" —
denying them their bundle entitlement (Entity Map & Hardcode Audit 2026-07-04 ·
Violation #2).

Fix: ONE source both layers read.

- New table `public.bundle_components` (bundle_sku_code → component_service_code,
  real FKs to both catalogs, RLS + public SELECT). Seeded from the CURRENT live
  composition. At the audited divergence (`PAPIC_UNLOCK`: app 7 incl.
  `PAPIC_GUEST` vs DB fn 6), seeded the **app shape (7, PAPIC_GUEST included)** —
  the layer the entitlement path the user experiences actually honors — closing
  the drift in the correct direction.
- `public.bundles_granting_sku()` rewritten to `SELECT` from the table (same
  signature/contract; `STABLE`); every existing DB caller converges with no
  change.
- App consts demoted to a **DB-first read** (`fetchBundleComponents`) with the
  const as graceful-degrade **fallback** — code gates correctly BOTH before and
  after the migration applies (deploy-order safe: 42P01 / empty / error →
  fallback).
- Pure composition resolvers (`buildBundlesGrantingIndex`, `bundlesGrantingSku`,
  `childrenOfBundle`) extracted and unit-tested (no I/O).
- Lint GUARD 2 (`lint-entitlement-gates.mjs`) re-pointed: the migration seed is
  now the authority the two fallback consts are asserted against.

Migration `20270511379088_bundle_components_single_source_table.sql` is **NOT
applied here** — the orchestrator applies it after merge via the Supabase MCP +
a drift-ledger row.

SPEC IMPACT: None. No pricing, SKU, or composition change — bundle membership is
byte-identical to the live app consts (GUIDED_PACK 7 · MEDIA_PACK 16 ·
PAPIC_UNLOCK 7); only the DB gate is brought into agreement with the app it was
already supposed to mirror, and the three hardcodes collapse to one table.
