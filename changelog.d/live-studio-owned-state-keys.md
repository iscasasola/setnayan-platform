## 2026-07-27 · fix(live-studio): a couple who pays ₱2,999 is no longer treated as unpaid

Found by the legacy-retirement audit, and independent of the retirement — this is wrong
today and arms the moment someone buys.

`ADD_ON_SKU_MAP` keys the two Live Studio generations separately: `panood` → the
**retired** Cast SKUs (`PANOOD_SYSTEM`, `PANOOD_SYSTEM_MOBILE`), `live-studio-roam` →
the live **`LIVE_STUDIO` ₱2,999**. `SKU_OWNERSHIP_ALIASES` does *not* expand at this
layer — it applies inside `eventSkuActive` — so a surface asking for `panood` resolves a
LIVE_STUDIO buyer to **not-owned**.

Two surfaces were asking for `panood`:

- **The day-of LAUNCH checklist** — a paying couple got an **"Add" button instead of
  "Go live"**, at their wedding, on the one doorway pressed exactly once.
- **GALLERIES** — no "Watch the recording" card afterwards.

Both now resolve from `live-studio-roam`. The launch **buy** doorway also moves off
`/studio/panood` — the Cast detail page, whose SKU is `is_active=false`, so it offers no
buy control and an "Add" button landing there dead-ends — to the unified detail page.

**Latent today, armed on the first sale.** No Live Studio SKU has ever been bought, but
`LIVE_STUDIO` is listed and purchasable on the public `/pricing` page right now.

4 new tests, including a **non-vacuity guard**: if the two feature keys ever merged, the
ownership assertions would pass for free, so the map divergence is asserted first.

4428/4428 unit green, typecheck + lint + production build pass. No migration.

SPEC IMPACT: none — makes the code match what `Live_Studio_Unified_Spec_2026-07-25.md § 3`
already says the SKU is.
