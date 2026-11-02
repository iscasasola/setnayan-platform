# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-11 · feat(papic): "Unlock all (Ltd)" — the ₱9,000 Ltd-tier twin of PAPIC_UNLOCK

Owner-set 2026-07-11 (WS1b of the Papic pricing/storage/face build plan). "Unlock all of Papic" becomes two tiers: **PAPIC_UNLOCK ₱15,000** frees Unlimited capture + Photo Wall + Camera Bridge; the new **PAPIC_UNLOCK_LTD ₱9,000** does the same for the Limited (Ltd/Roll) tier. Both price at the à-la-carte sum of their parts (a convenience bundle + all-in daily ceiling, not a discount).

- **Migration `20270716685810`** — seeds the `PAPIC_UNLOCK_LTD` package (₱9,000) in `platform_package_catalog` and its `bundle_components` rows (→ LIVE_WALL, CAMERA_BRIDGE). `public.bundles_granting_sku()` reads that table dynamically, so no function re-declaration and no DB↔app sync burden.
- **Capture-free bypass** — new `eventLtdFreeViaUnlock()` + `PAPIC_UNLOCK_LTD_BUNDLE_KEY` in `lib/papic-cameras.ts`, exact fail-closed mirror of `eventUnliFreeViaUnlock` (TRUE only on an ACTIVE order). Wired into both per-camera capture gates (`app/papic/actions.ts` record layer + `app/api/upload/route.ts` presign) for `cameraTier === 'roll'`.
- **Quote engine** — `computeCameraQuote` gains a symmetric `ltdFree` opt: it collapses the Roll charge to ₱0 (Unli untouched) and never trips the Ltd cap flag when free. The purchase action (`studio/papic/actions.ts`) passes `ltdFree` from an active PAPIC_UNLOCK_LTD so an owner never re-pays for Ltd cameras. Each pass covers only its own tier.
- **Entitlements** — `BUNDLE_CHILD_SKUS.PAPIC_UNLOCK_LTD = [LIVE_WALL, CAMERA_BRIDGE]` (graceful-degrade fallback; the DB table stays authoritative). Outside the lint:entitlement-gates Guard 2 scope by design (that guard covers GUIDED_PACK/MEDIA_PACK).

The Unli-extras picker is untouched (Ltd cameras activate from the guest list, no manual count). 4 new `ltdFree` money-logic unit tests (Roll→₱0, Unli-still-caps, both-unlocks→₱0); full suite 1392/1392, typecheck + lint clean.

SPEC IMPACT: Applied in corpus — `Pricing.md § 2.1` (PAPIC_UNLOCK row = two-tier ₱15,000/₱9,000) + `DECISION_LOG.md` 2026-07-11.
