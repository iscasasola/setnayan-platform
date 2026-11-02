## 2026-07-08 · chore(pricing): remove retired Thank You row from the Papic prices popup

Owner retired Auto-Recap + Thank You (both server-render features). Thank You's real
concept was an Instagram-style photo sticker/effects layer, never the corpus's stale
"5-min video" — either way the paid Thank You SKU is gone. Removed the dead
"Thank You · add-on" row (+ the now-unused `PAPIC_ADDON_THANK_YOU` `priceOf`) from the
homepage prices popup. Auto-Recap was never surfaced in code (kept gate-pending), so
nothing to remove there.

Verify: `tsc --noEmit` → 0 new errors (6 pre-existing are unrelated vendor files).

SPEC IMPACT: Applied — Pricing.md §00.B/§0.A/§2.1 + retired list; DECISION_LOG 2026-07-08;
build plan Phase 7 retired.
