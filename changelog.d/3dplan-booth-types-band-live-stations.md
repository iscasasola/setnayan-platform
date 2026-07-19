# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-04 · feat(seating-3d): band + live-cooking + live-performance booth types, each with its own 3D silhouette

Owner directive (2026-07-04): vendors run more kinds of booths in the 3D Plan — a **band/stage**, a live-**cooking** (action/carving) station, and a live-**performance** (acoustic act) spot — and each must have a proper 3D representation, not a generic block. Until now `BoothMesh` rendered EVERY booth as the same block + canopy lip regardless of type.

- **Migration `20270511347133`** — expands the `event_floor_booths.booth_type` CHECK to add `band`, `live_cooking`, `live_performance`. Also **fixes a latent gap**: `registration_desk` is used by the app (the seating editor auto-places a Front Desk; `BOOTH_CATALOG` offers it) but was dropped from the prod CHECK by `20270110320022` — a registration_desk insert would have violated the constraint. Re-included. Additive + idempotent (drop/re-add). **Applied to prod** (Supabase MCP + ledger row).
- **`lib/seating.ts`**: `BoothType` union + `BOOTH_CATALOG` gain `band` ("Band / Stage"), `live_cooking` ("Live Cooking"), `live_performance` ("Live Performance"). The booth-type picker is data-driven off `BOOTH_CATALOG`, so the new kinds appear automatically.
- **`lib/seating-3d.ts`**: `boothTypeLabel` gains the three labels (+ `registration_desk` → "Front desk").
- **`venue-objects.tsx` `BoothMesh`**: now switches on `booth.kind` for a per-type silhouette — **band** (riser + drum kit + cymbals + amp + mic stand), **live_cooking** (stainless counter + emissive cooktop heat bar + range hood on posts), **live_performance** (round riser + mic stand + speaker + a soft spotlight glow cone), **mobile_bar** (counter + back shelf + bottle row); everything else keeps the generic station block + canopy. Low-poly, no fetched assets — same discipline as the rest of the module. Lifts all three surfaces (lab, guest walk, homepage demo) via the shared component.
- **`seating-editor.tsx` `BoothIcon`**: 2D icons for the new types (band → Music, live_cooking → ChefHat, live_performance → Mic).

Next (owner-directed): Pro/Enterprise vendor logo textured onto the 3D booth signage, tier-gated (`vendor-tier-caps.ts`; `vendor_profiles.logo_url`).

SPEC IMPACT: None — extends the shipped 3D booth system with three vendor-station types; additive CHECK + code, no pricing/product-surface change.
