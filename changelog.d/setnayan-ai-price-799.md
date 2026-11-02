## 2026-07-02 · fix(pricing): Setnayan AI shows ₱799/28 days · ₱499 first 28 days

Owner 2026-07-02 — the headline price is the ₱799 REGULAR, with ₱499 as the first-28-days intro
(previously the surfaces led with ₱499). Reflipped across all three price surfaces:
- Homepage "Prices" overlay (`HomeOverlays.tsx` + `pricing-data.ts`): the Setnayan AI card now
  shows `₱799 / 28 days` with a `₱499 on your first 28 days` line. `pricing-data` gains
  `aiIntroPrice`; `aiPrice` now resolves the REGULAR from the dormant `SETNAYAN_AI_RENEW` catalog
  row (resilient direct read, ₱799 fallback), and `aiIntroPrice` from the active `SETNAYAN_AI`.
- `/pricing` card: headline `₱799 / 28 days` + `₱499 on your first 28 days`.

Prices stay catalog-driven (fallbacks only if a row is unreadable). ⚠ Still ahead of billing
enforcement (per-event flag OFF → checkout charges the flat ₱499 today; couple-favorable).

SPEC IMPACT: None new — per-event ₱499/₱799 already recorded (DECISION_LOG 2026-07-02).
