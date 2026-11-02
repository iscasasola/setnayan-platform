## 2026-07-03 · fix(homepage): demo pop-up QR codes were cut / overflowing — fit the SVG to its box

- `lib/qr.ts` renders QR SVGs with fixed width/height attributes (220px); all
  three demo overlays injected them into smaller boxes — Papic's 160px tiles
  and Live Studio's 200px/104px boxes clipped the code (unscannable), and the
  3D Plan panel's 92px box let it overflow across the pop-up.
- New `.hr-qr-fit` rule (home-reskin.css) forces an injected QR svg to fill
  its wrapping box; applied to all four embed sites (Papic tiles ×2 via
  QrTile, Live Studio lobby + switcher, 3D Plan guest panel).
- 3D Plan guest QR bumped 92 → 128px with the house rounded border for scan
  reliability, aligning the panel row properly.
- Slipped through because minting fails without a service key locally — the
  QR-present states only ever rendered on prod. Verified this pass against a
  real mint (Papic 158/158, Live Studio 198/198) + a fixed-size-SVG probe of
  the 3D Plan panel markup (128/128).

SPEC IMPACT: None (visual fix).
