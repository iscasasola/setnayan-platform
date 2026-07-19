## 2026-07-04 · docs(vendor-tiers): Custom tier runs as Enterprise for all features, automatically (owner)

- `apps/web/VENDOR_TIERS_AND_BENEFITS.md` §11 Stage 2 — entitlement rule: `tier_state='custom'` resolves to Enterprise-level entitlement for every boolean/feature gate; only the numeric caps are overridden by the purchased composition (`tierCaps('custom')` = Enterprise clone + composition numbers, or `effectiveTier()` custom→enterprise for feature checks).
- Build-audit item: sweep hard `tier === 'enterprise'` equality checks (PAID_TIERS-style sets, buyExtraSeat, Flagship gate, films rack) → rank/caps-derived checks, so Custom inherits current and future Enterprise features with no per-surface patches.

SPEC IMPACT: corpus `DECISION_LOG.md` — row appended (2026-07-04, Custom runs as Enterprise).
