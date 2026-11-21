## 2026-11-21 · feat(cake-maker): the Cake Maker v2 — Your cake options · the ONE cake figure (2D + 3D) · A design arrives

Built from the owner-approved drawing `prototypes/cake_maker_2026-11-21/cake_maker_fable.html` (specs `0acc074a`), the
DECISION_LOG row "CAKE MAKER — APPROVED TO BUILD" (10 calls) and the controller's v2 rulings of 2026-11-21. Cakes only
(`wedding_cake`, `cake`).

- **Supplier · Your cake options** (Card Maker, after "How clients book"; new and saved cards): real tiers (up to 10,
  a Standard count and an extra per added tier), display tiers (optional, own max and own extra), flavours written once
  and asked per real tier, finish, per-layer accents, arrangement (stacked · floating · pillars · offset · side by side),
  a flowing accent, topper, the monogram, colours "Choose 1–N" (max 3), the message's letter cap, and cupcakes (packs,
  an optional tower). Every extra is ≥ ₱0 and the supplier's own — nothing priced by us. Stored as the card's own
  ★ Customization lines (`vendor_package_items.cake_part`, `vendor_package_item_options.look_key`) — priced by the
  shipped `choiceTotals`, no new money path.
- **One cake model, drawn in code**: `lib/cake-config.ts` (catalog · `sanitizeCakeConfig`, which refuses and never
  repairs · `cakeFigureSpec`) and ONE `<CakeFigure>` in `plan3d/kit` (SVG). A lazy 3D view (`cake-figure-3d.tsx`, R3F,
  physical materials, no HDRI or font fetched) draws the same spec, with the 2D picture as its fallback. N tiers draw a
  complete N-tier cake with the topper on the top tier. Rules: the cutting tier is always real, at least one tier is
  real, flavour applies to real tiers only.
- **Special tools are included in Supplier Pro and up** (`TIER_CAPS.specialTools`; no fee): before the admin's start
  date (`platform_settings.special_tools_paid_from`, Admin › Launch offer) every shop has them; after it, a shop below
  Pro sees "Included in Pro · Upgrade" and keeps its saved options. The save and the couple's send check the same flag.
- **Supplier · A design arrives**: the sent design is stored once (`cake_designs`, RLS: thread members read; written
  server-side only) and the message names it ("Design ref:"). The "Cake design" card in the chat and on the order
  draws the figure and lists every pick, the special instructions and the inspiration photo; a failed read says
  "Couldn't load this cake design".
- **"Need your own form? Tell us what you need"** on every card in the Card Maker, opening Message Setnayan prefilled.
- The couple's "Design your cake" screen waits for the v4 drawing (not in this PR).
- Migration `20271356877338_cake_maker_parts_and_designs.sql`: `cake_part` / `look_key` / `max_letters` /
  `special_tools_paid_from` columns with CHECKs, and the `cake_designs` table.

SPEC IMPACT: None — builds an approved drawing and the controller's logged rulings; no ruling changed.
