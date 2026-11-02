## 2026-06-26 · feat(papic): "Unlock all of Papic" umbrella bundle + Papic-page presentation (PR9)

Owner 2026-06-26 — everything is "umbrella-ed to Papic": one bundle unlocks all
of Papic, presented on the Papic page.

- New **`PAPIC_UNLOCK`** package (₱15,000) in `platform_package_catalog` —
  "Unlock all of Papic".
- **Add-on grant**: `PAPIC_UNLOCK` added as a 3rd key to `BUNDLE_CHILD_SKUS`
  (`lib/entitlements.ts`) granting the 6 Papic add-ons (KWENTO, LIVE_WALL,
  PAPIC_ADDON_THANK_YOU, PAPIC_ADDON_STORIES, PABATI, CAMERA_BRIDGE). So
  `eventSkuActive('KWENTO')` etc. resolve via the umbrella. `lint:entitlement-gates`
  Guard 2 validates only GUIDED_PACK/MEDIA_PACK by name, so the 3rd key is clean.
- **Papic-page presentation**: a prominent "Unlock all of Papic · Everything
  Papic, one price" section atop the Papic studio page — lists what's included +
  an apply-then-pay buy (`InlineCheckoutDrawer`) when unowned, "Unlocked ✓" when
  owned. Price read live from the catalog (admin-managed). Page marked
  `force-dynamic` (the bundle fetch uses an admin client).

DEFERRED (flagged · DECISION_LOG · separate careful builds — they touch live
payment logic):
- The **unlimited-Unli camera allowance** — owning PAPIC_UNLOCK should make Unli
  cameras free/uncapped (a capture-gate bypass in `app/papic/actions.ts` +
  `/api/upload` + the provisioning flow). NOT done — the bundle grants the add-ons
  today, not the cameras.
- The DB-side `bundles_granting_sku()` mirror for PAPIC_UNLOCK (app-side gates
  work now; the DB gate matters for the deferred camera path).
- The **"add-ons require Papic active" prerequisite** (the other half of the
  owner's "Papic-gated" choice) — must count MEDIA_PACK/PAPIC_UNLOCK owners as
  "Papic active" so Complete buyers aren't blocked.

Verified: typecheck + next lint + entitlement-gates + papic-keep + retired clean;
`PAPIC_UNLOCK` package live in prod (₱15,000).

SPEC IMPACT: DECISION_LOG 2026-06-26 (Papic umbrella) + `0012_papic.md` header.
