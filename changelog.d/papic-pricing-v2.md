## 2026-06-26 · feat(papic): per-tier price caps + Ltd/Unli rename + add-on reprice (PR7)

Owner-set pricing model (2026-06-26): Papic cameras are per-tier-capped, the two
tiers are renamed Ltd/Unli, and the à-la-carte add-ons are repriced.

- **Per-tier caps** replace the single ₱6,999 event cost cap. Each tier locks
  independently: Ltd (Roll) at ₱6,000 (≈200 cameras × ₱30), Unli at ₱10,000
  (≈100 cameras × ₱100) — so 300 guests on Ltd still pay ₱6,000.
  `computeCameraQuote` now caps each subtotal separately; new per-event columns
  `events.papic_ltd_cap_php` / `papic_unli_cap_php` (admin-adjustable · default
  6000 / 10000). The old `papic_cost_cap_php` column is deprecated (left in
  place, no longer read).
- **Rename** Roll → **Ltd**, Unlimited → **Unli** across the buy picker, the
  studio page, the public /pricing collapse, and the catalog titles. The
  internal `service_code` + the `tier` enum stay `roll`/`unlimited`
  (never-rename-technical-ids lock) — display-only rename.
- **Add-on reprice** (admin catalog): Thank You ₱3,499 → **₱1,500** ·
  Stories ₱1,499 → **₱2,000** · Pabati (video guestbook) ₱999 → **₱500** ·
  Camera Bridge ₱1,499 → **₱100/seat/day, max ₱2,000** (reverses the 2026-06-18
  "included free" decision; studio copy corrected to the ₱100 rate + cap).
- **₱2,999 removed**: `PAPIC_GUEST` (Disposable) deactivated, joining
  `PAPIC_SEATS`. Encoded in the migration so a fresh DB reproduces it.
- Re-applies the public `/pricing` "Papic Cameras · from ₱30/camera" collapse +
  the per-camera build-status — both were orphaned when #2261's auto-merge fired
  on PR5 only (before the collapse commit was pushed).

Min order stays 5 Ltd = ₱150. Kwento ₱500 + Photo Wall ₱1,000 à-la-carte SKUs
and the ₱15,000 "Unlock all" bundle are PR8 (pending the Kwento free→paid call).

Verified: typecheck clean · migration applied to prod (`setnayan-prod`) · catalog
renamed/repriced live.

SPEC IMPACT: Papic pricing model — DECISION_LOG 2026-06-26 + `0012_papic.md`
AS-BUILT header + the strategy doc updated to per-camera + per-tier caps.
