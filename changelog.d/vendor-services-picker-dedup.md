## 2026-07-03 · fix(vendor): collapse duplicate "Services covered" options

Owner spotted duplicate checkboxes in the My Shop "Services covered" picker —
"Choir" twice under Ceremony, "HMUA" twice under Couple & Attire, "Photo &
Video" twice under Media.

Root cause: the admin taxonomy folds three legacy category pairs into one
modern tile (photographer + videographer → "Photo & Video", makeup_artist +
hair_stylist → "HMUA", string_quartet + choir → "Choir"). Any surface that
rendered the legacy keys with the live taxonomy labels showed both keys as two
identical rows.

- New `groupDisplayOptions(members, resolveLabel)` in `lib/vendors.ts` collapses
  members that resolve to the same label into ONE option carrying every folded
  key (primary first). Checked = any folded key present (a legacy row storing
  the secondary key like `videographer` still round-trips); ticking off clears
  every folded key; ticking on stores the primary. Pass-through (no change) when
  labels are distinct — e.g. the in-code fallback labels.
- Applied to both taxonomy-label consumers: the `<ServicesPicker>` checkbox grid
  (My Shop inline editor + /profile) and the Services-tab "Add a service" pills.
- Marketplace matching is unaffected — both keys in each pair already anchor to
  the same tile, and `/explore` matches by `overlaps`/`contains` on the stored
  key. `category-filter-chips` + the public `/v/[slug]` page use distinct
  labels / the vendor's real listings and were already correct.

SPEC IMPACT: None (display-layer dedup; stored `vendor_profiles.services[]`
vocabulary and the taxonomy bridge are unchanged).
