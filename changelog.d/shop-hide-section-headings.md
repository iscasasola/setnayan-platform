## 2026-07-02 · style(vendor-shop): visually remove the "How you're doing" and "Manage your shop" section labels

Owner: *"remove the How you're doing text and Manage your shop."* On
`/vendor-dashboard/shop`, both section `<h2>` labels are now `sr-only` — gone
visually, but kept in the DOM for the screen-reader document outline (no visual
cost). All spacing behaviour is unchanged (the `space-y-3` wrappers stay, so the
stat grid and the Manage tiles keep their existing rhythm and the inline
Collapsible panels keep their gap).

- `shop/page.tsx` — "How you're doing" h2 → `sr-only`.
- `shop/_components/manage-tiles.tsx` — "Manage your shop" h2 → `sr-only`.

Type-clean (`tsc --noEmit`) and lint-clean (`next lint`).

SPEC IMPACT: None (visual-only; no SKU, price, schema, route, or data change).
