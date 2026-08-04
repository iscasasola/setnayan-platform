## 2026-07-11 · feat(plan3d): demo-room vendor rotation wired (slice 9 · Part B, PR 2/N — Part B complete)

Wires the Part-B rotation into the single demo seam. All behind
`NEXT_PUBLIC_PLAN3D_DEMO_ADS` (off → the public homepage demo shows its normal
sample booths, byte-identical).

- **`plan3d-demo-actions.ts` → `applyDemoBoothRotation`** — in
  `loadPlan3DDemoScene` (which feeds BOTH the homepage overlay and the
  `/3d_plan/demo/[token]` guest view), after the sample booths are built, swaps
  each booth's vendor/kind/label to a ROTATED real marketplace vendor while
  keeping its position. Pool = publicly-visible + verification-gated
  `vendor_market_stats` vendors (joining `vendor_profiles.tier_state`), coerced
  services[] → `VendorCategory` (skipping `misc`); ranked + rotated by the tested
  `selectDemoRotation` (Pro/Enterprise + ad-boost weighted, everyone cycles,
  hourly window). Booth kind follows the vendor's category via
  `boothTypeForVendorCategory` so the look matches; logos resolved via
  `displayUrlForStoredAsset`; only Pro/Enterprise brand their logo
  (`boothCanBrand`), and the tap-through card links to `/v/[slug]`.
- **Fully defensive:** the flag off, an empty pool, or ANY query error returns
  the booths unchanged — the public homepage can never break from this.
- No PII on the wire (public business identity only). No render changes — the
  existing booth pipeline draws the rotated vendors.

Rotation suite 10/10 green · `tsc` clean · guards clean. `.env.example` documents
the flag. Part B COMPLETE (rotation core · demo wiring), flag-gated off.

SPEC IMPACT: None (implements locked slice-9 Part B).
