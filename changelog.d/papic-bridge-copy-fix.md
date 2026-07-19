## 2026-06-26 · fix(papic): restore the orphaned Camera Bridge ₱100/seat/day copy (PR10)

PR7 (#2265) merged at an early commit (auto-merge race), so its LATER Camera
Bridge edits never reached main — the studio Papic page still showed the OLD
"DSLR Camera Bridge included with Papic · no extra cost" copy (the owner saw a
stale ₱200 from an intermediate preview deploy). The catalog was already correct
at ₱100.

- Studio Papic page DSLR Camera Bridge section: "included with Papic" →
  **"₱100 / seat / day"** heading + "₱100 per seat, per day (capped at ₱2,000 ·
  native app V1.5)" body + the two stale code comments.
- New migration re-applies the orphaned catalog reprices (Pabati ₱500 +
  Camera Bridge ₱100 + title) for fresh-DB reproducibility — the LIVE DB is
  already correct (applied via admin SQL), so it's a prod no-op.

Verified: typecheck + next lint + papic-keep + retired clean.

SPEC IMPACT: None new — already in DECISION_LOG 2026-06-26 (Camera Bridge
₱100/seat/day) + `0012_papic.md`; this restores the orphaned code + migration.
