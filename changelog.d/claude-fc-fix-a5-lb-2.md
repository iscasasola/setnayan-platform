## 2026-11-25 · fix(supplier): final check area 5, lane B 2 — the card maker rises over Shop; Shop on a computer

- **B8** Making or editing a service card rises over the page you were on (`@rise/(.)services`): full screen on a phone,
  the large centred dialog from 701; the picker and the maker share one layer; an edit is headed by the card's name;
  ✕ falls back to Shop at the same scroll. The ‹ Shop / ‹ Services / ‹ Quote links hide only inside the layer — a hard
  load of the address draws the whole page as before. Only the maker rises: `requests`, `requests/[requestId]` and
  `their-work` stay as they are (the card folder rises only for a card id; any other name loads as its own page).
- **B7** Every field of a booked card (Name, Description, Video link, the price and payment rows) reads as plain words
  with no pencil (`FormRowsReadOnly` around the form; `TypedRow` `readOnly`), and its gallery draws no add tile (the
  gallery's limit is what it holds).
- **B10** Shop › Logo · Cover photo · Storage open the shared Sheet (half on a phone) instead of a full-screen layer
  (`ShopDoorScreen` `half`).
- **B11** From 1280 the Shop tab uses the body's width; a fixed 320 side column; service cards one per row until each has
  320 (two-up from about 1600).
- Guard: `app/vendor-dashboard/services/the-maker-rises.test.ts`; the Layout A and gallery guards hold the new values.
- Known follow-up (accepted for launch, controller 25 Nov): a soft tap to `/vendor-dashboard/services/requests` or
  `/vendor-dashboard/services/their-work` is caught by the card folder's intercept and loads the page whole (one full
  load of the same address, `LoadWhole`); the page itself is unchanged.

SPEC IMPACT: None.
