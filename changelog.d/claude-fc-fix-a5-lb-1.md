## 2026-11-25 · fix(supplier): final check area 5, lane B 1 — Open a shop is one layer

- Open a shop, Add your logo and Invite shops you trust draw inside ONE layer, mounted by `app/open-shop/layout.tsx`:
  the shipped `ShopDoorScreen` (RiseScreen on a phone and a tablet; the centred form dialog from the desktop line). The
  layer stays up while the steps change (B1 · B2 · B3, drawing `final-check-area-5_2026-11-25.html`).
- Each step's title and line ride in the layer's head; the pages' own `<main>`, the desktop brand strip and the in-body
  title are gone. The SETNAYAN line stays above the step bars (owner 25 Nov).
- The logo step wears the supplier look (supplier-accent bars, no warm page). The invite step's Later and Done sit in
  the bar at the foot; ✕ on the logo and invite steps lands where their own buttons go.
- `ShopDoorScreen` gains `at` (switch line, default 701) and `page` (centred dialog); every Shop door is unchanged.
- Guard: `app/open-shop/one-layer.test.ts`.

SPEC IMPACT: None.
