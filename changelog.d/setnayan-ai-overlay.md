## 2026-07-02 · feat(marketing): Setnayan AI homepage glass-nav pop-up overlay

The homepage nav's "Setnayan AI" item now opens a **pop-up overlay** (like Prices/Download/Vendors)
instead of linking away — per the GTM framework §4 (`Setnayan_AI_GTM_Content_2026-07-02.md`).

- `HomeOverlays.tsx`: new `SetnayanAiOverlay` (reuses the shared `OverlayShell`), registered in the
  `OverlayId` union and the parent render. Relief-forward, **shipped-only** content: lead "Stop
  remembering to check on everything," three jobs (does-the-legwork · stands-guard · reassures),
  the cadence line ("one calm weekly digest, loud only when it can't wait"), price read live from
  the catalog (₱799/28d · ₱499 first, via `pricing`), all-events + 0% commission + free-floor, and
  a CTA + deep-link to the full `/setnayan-ai` page.
- `HomeReskin.tsx`: the nav "Setnayan AI" changes from `<Link href="/setnayan-ai">` to a
  `setOverlay('setnayan-ai')` button, consistent with the sibling overlay triggers.

Honesty guardrails: NO personalization/cohort ("learns your taste" / "couples like you") teasers —
those are dormant; no tech named; no fake urgency; prices stay catalog-driven.

SPEC IMPACT: None — marketing UI to the recorded GTM framework (DECISION_LOG 2026-07-02).
