## 2026-07-02 · refactor(vendor-shop): "How you're doing" above "Manage your shop" + centred stat tiles

Follow-up to the tiles pass (#2638). On `/vendor-dashboard/shop`:

- **Reordered** the read-only "How you're doing" performance section (6
  StatTiles) to sit directly under the hero, **above** the "Manage your shop"
  grid — see-your-numbers-first, then act. JSX moved verbatim; no data or prop
  changes.
- **Centred each StatTile** (`flex flex-col items-center text-center` on the
  tile + `justify-center` on the icon+label row) to match the already-centred
  Manage tiles. The tiles stay de-carded (frameless) — they're static readouts.

Type-clean (`tsc --noEmit`) and lint-clean (`next lint`). A 3-lens adversarial
review (correctness / UX / a11y) plus an independent adjudication pass returned
`ship` with zero findings.

SPEC IMPACT: None (UI-only reorder + alignment of the already-shipped My Shop
sections; no SKU, price, schema, or route change).
