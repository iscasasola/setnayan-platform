## 2026-11-25 · fix(supplier): final check area 5, lane B 2 — the card maker rises over Shop; Shop on a computer

- **B8** Making or editing a service card rises over the page you were on (`@rise/(.)services`): full screen on a phone,
  the large centred dialog from 701; the picker and the maker share one layer; an edit is headed by the card's name;
  ✕ falls back to Shop at the same scroll. The ‹ Shop / ‹ Services / ‹ Quote links hide only inside the layer — a hard
  load of the address draws the whole page as before. The static siblings (`requests`, `their-work`) rise as themselves.
- **B7** A booked card's name reads as plain words from its start (no pencil) and its gallery draws no add tile
  (`TypedRow` `readOnly`; the gallery's limit is what it holds).
- **B10** Shop › Logo · Cover photo · Storage open the shared Sheet (half on a phone) instead of a full-screen layer
  (`ShopDoorScreen` `half`).
- **B11** From 1280 the Shop tab uses the body's width; a fixed 320 side column; service cards one per row until each has
  320 (two-up from about 1600).
- Guard: `app/vendor-dashboard/services/the-maker-rises.test.ts`; the Layout A and gallery guards hold the new values.

SPEC IMPACT: None.
