## 2026-06-29 · feat(discovery): First-Look Window — responsiveness scoring mechanic (Soon-benefits Wave 2)

The reusable scoring half of First-Look Window. A vendor who replies fast to
in-region inquiries earns a head-start in the compat-score ranking.

- `compat-score.ts` gains two optional inputs — `respondsFast` and an
  admin-managed `boostWeight` (from `platform_settings.firstlook_boost_weight`,
  shipped in the Wave-2 substrate). The blend scales the five-dimension score by
  `(1 - boostWeight)` and adds `boostWeight` for fast responders, so
  `COMPAT_WEIGHTS` still sum to 1 internally (a top-level blend, not a sixth
  weight). A fast responder lands at responsiveness sub-score 1; everyone else
  sits at NEUTRAL — **a head-start for the fast, never a penalty for the rest**.
- **Default `boostWeight` 0 → exact no-op**: every existing caller and the full
  compat-score test suite are byte-for-byte unchanged. Weight is clamped to
  [0, 0.5] so an over-large admin value can't overflow or invert the scale.
- 3 new unit tests (14/14 pass): no-op-by-default, fast-out-scores-slow at the
  same weight, and bounded-clamp.

Scoped intentionally as the scoring mechanic on its own — the matcher
**activation** (join `vendor_activity_stats`, compute SLA eligibility, pass
`respondsFast`/`boostWeight`, render the "Replies fast" badge) lands as the next
PR so the ranking-behavior change gets isolated review + verification. Until
then this is a flagged-off mechanic (no caller passes a weight → no ranking
change in prod). Typecheck + tests clean.

SPEC IMPACT: None — additive optional scoring inputs, no-op by default; the
SLA/weight are admin-managed config (no hardcoded thresholds).
