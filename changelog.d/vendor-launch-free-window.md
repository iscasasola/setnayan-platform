## 2026-07-25 · feat(vendor-pricing): launch free-window mechanism (inert foundation, flag-dark)

Phase-8 foundation of the LOCKED 2026-07-25 vendor monetization model (§ "Launch
posture"): selected paid vendor features are free until 2026-11-30 to seed
supply; listed prices are the post-launch steady state.

Lands only the **pure window mechanism** so consumers have one tested place to
read from:

- `lib/vendor-launch-free-window.ts` — `VENDOR_LAUNCH_FREE_WINDOW_END_ISO`
  (2026-11-30 end-of-day, Manila +08:00) + `isVendorLaunchFreeWindowActive(nowMs)`
  + `vendorLaunchAdjustedPricePhp(base, nowMs)` (₱0 while active, base after).
  PURE (`nowMs` passed in). It does NOT enumerate covered SKUs — coverage is the
  caller's decision (the model says "selected").
- `lib/vendor-launch-free-window-flag.ts` — `NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW`
  (default OFF); the window is inert until the owner flips it.
- `lib/vendor-launch-free-window.test.ts` — 6 cases (active/inactive, inclusive
  end boundary, non-finite-now fail-safe, ₱0-during / base-after, negative-base
  coercion).

INERT: no checkout applies the window yet, so nothing is free. Wiring the covered
add-ons onto it lands with the add-on price wiring PRs.

SPEC IMPACT: None (implements the already-locked model + DECISION_LOG 2026-07-25).
