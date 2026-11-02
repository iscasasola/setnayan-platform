## 2026-07-15 · feat(vendor): Glass PR-6 — vendor shell + home recomposition

Recompose the vendor dashboard Overview + shell into the Atelier-Glass language
(App-Wide Glass Rollout Plan § 3.3 / § 5 PR-6), translating the owner-approved
`prototypes/vendor_dashboard_v2_2026-07-15.html` while keeping every real data
source, action, route, copy-fact, and flag unchanged.

- **Focal — "Today at {shop}" `.sn-tile-dark`** (`VendorTodayFocal`, blooms via
  `sn-bloom`): inquiries-waiting CountUp + next-booking chip + earned-this-year
  chip (mono ₱) + one gold CTA anchoring to the What's-new feed. The single
  obsidian focal on this view; replaces the old gold-left-rail white hero. My
  Performance keeps its own "Business Health" dark tile (untouched).
- **Hero** — greeting eyebrow ("Kumusta, {name}") + `.sn-h1` "Your shop, today."
  + mono stat line (inquiries · bookings · ₱ this year), hidden-when-zero.
- **KPI cluster → glass `.sn-tile` bento** — gold ring sweeps (`sweep` prop),
  Space-Mono CountUp numerals, `.sn-eye` gold eyebrows; Earned tile is a
  `.sn-press` money doorway to `/earnings`.
- **What's-new feed → `.sn-card`s** with warm-semantic left accents + tone-mapped
  eyebrows; Accept stays ink-primary (one gold action/view rule). Ongoing +
  Upcoming → `.sn-tile` panels of opaque `.sn-row` items with obsidian mono
  date blocks (blur budget: one glass wrapper, flat rows).
- **Shell** — new `vendor-dashboard/template.tsx` (`.sn-page-enter` route rise);
  vendor sidebar identity card → glass (flat tint + gold rail/ring); section
  labels adopt the `eyebrow` `.sn-eye` treatment (matches the couple rail).
- **Retirements** — all residual `--v-blue` accents (sidebar identity rail +
  ring, reviews-legend dot, CashFlow / Next-shoot eyebrows), `m-serif`,
  `m-label-mono`, and `m-eyebrow` on this surface → gold-700 eyebrows / gold
  rings / warm semantics. `m-*` editorial tokens dropped from the vendor home.

Reduced-motion covered by the global freeze; `lint:radius` clean; blur ≤8
page-level elements/viewport; rows opaque. Fences honored — no changes to
`customers/**`, `shop/**`, `performance/**`, `on-the-day/**`, `notifications/**`,
or anything outside `vendor-dashboard`.

SPEC IMPACT: None (app-code visual recomposition per App_Wide_Glass_Rollout_Plan_2026-07-15.md § 3.3 / § 5 PR-6; no product decision, price, SKU, or schema change).
