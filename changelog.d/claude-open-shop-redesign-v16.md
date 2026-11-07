## 2026-11-06 · feat(open-shop): the sign-up at prototype v16 — category cards, the plan explained on Continue, specialties, services per event, About you + three-button account

Brings `/open-shop` from prototype v8 (what #7351 was first built against) to the owner-approved **v16**
(`prototypes/open_shop_redesign_2026-11-06/open-shop-redesign-v16.html`, specs `57feebf1`; owner, 6 Nov: *"those are
the last fixes"*). Only the delta is built; the shipped picker, `EventTiles`, `PhoneField`, `PasswordField`,
`InfoTip`, `Sheet`, the OAuth rows, `insertCoverage` and `mergeServiceRefinements` are reused.

- **Five steps** — 1 Name your shop · 2 What you do (page 1 Your services, page 2 Events you serve) · 3 Where you are ·
  4 About you · 5 Your account. Five segments in the step bar. Server refusals: name/number → 4, email/password/terms/
  account → 5 (`OPEN_SHOP_FIELD_STEP`, `decideOpenShopAccount`, `createVendorAccountForShop`, `four-steps.test.ts`).
- **v11 · categories as photo tiles** under small group headings (balanced rows), a category → its services as rows,
  "All categories" back. Photo = `service_categories.sample_photo_r2_key`, ⓘ = `hint_en` (Admin › Categories), both
  through the taxonomy snapshot; no photo → the plain tile, no hint → no ⓘ.
- **v14 · ① one plain card per picked category** (`service-cards.tsx`, replaces `more-services.tsx`): the category's
  photo, name, group; its services as rows (Change / Remove); a blank "Also do …?" row for the rest of that category or
  "Every ‹category› service is on your list"; a dashed **Another category** frame → tiles → row, which never offers a
  category or service already picked. The card a pick lands in **scrolls into view and flashes once**.
- **② the plan explainer moves to Continue** (`plan-sheet.tsx`): when the picks are more than Free holds and the box is
  not ticked, Continue opens "Before you continue" — the shipped `Sheet` on a phone, the right pane at ≥768 — with
  "Your first booking is free once you’re verified", the ladder Free · Verified → Solo → Pro → Ultra adds (`planLadder()`,
  every number from `TIER_CAPS`, no peso), the agree box ("Tick the box to continue."), Continue and "Back to my
  services". One hint + ⓘ stays inline under the meter. The meter past Ultra no longer says "Custom plan (Talk to us)"
  (Custom is retired from the app) — it says what stays after the first booking.
- **③ specialties compile**: each service's chip-shaped refinements (`canonical_service_schemas` via
  `fetchCategoryChipRefinementsMany`, readable signed out); closed with picks = the picks in ink + "+ Add", open = every
  chip + Done, opening one closes the others. Written after the shop opens through THE ONE merge
  (`mergeServiceRefinements`, re-validated against the live schema; best-effort, logged).
- **④ events per service**: under each ticked event the picked services as chips — all on, untick per event ("3 of 4
  services"); a service the event does not offer (its leaf's `allowedEventTypes`) is greyed with "X isn’t offered for
  ‹event›". Continue — and the server — refuse a service on for no ticked event ("Pick at least one event for each
  service."). Each service posts its own events (`primary_service_events` + `extra_services`); the shop's
  `event_types` = the union of what its services are on for.
- **⑤ About you** (name · +63 number · "Your role at the shop" optional, free text → the shipped `contact_position` →
  `business_owner_position`), then **Your account**: Continue with Google / Apple / Email as three equal buttons; Email
  opens Email + Password in place with ONE hint "At least 8 characters" (`PasswordField mode="new" quiet` — the bar and
  rules are not drawn; the leak check still answers on submit, under the box). Terms, "Open my shop — free".
- **Owner 7 Nov, folded in (PR comments):** a category with only ONE service adds that service on the tile tap — no
  drill-in row, its specialties never auto-picked (v16 updated in place, specs `f15a3a7`); and the phone sentence no
  longer starts with 0 beside the fixed +63 — `contactPhoneNotPh` "That doesn’t look like a Philippine number. Use 9XX
  XXX YYYY, or a landline like 2 8XXX YYYY." and the box's own "Use 9XX XXX YYYY, or a landline like 2 8XXX YYYY."
  (also read by My Shop's details save). The v18/v19 rulings wait for the controller's go — the PR is on hold.
- The shipped fee disclosure line stays on the account step (`the-fee-finds-the-supplier.test.ts`, owner 2026-09-20).
- `/dev/open-shop-lab` (dev-only): steps 1–5, category photos from `public/taxonomy/tiles`, and a few services' event
  scopes and specialties taken from the prototype's own `SVC_EVENTS` / `FILTERS`.
- Proof: `build-sessions/proof/open-shop-v16-2026-11-06/` — prototype left, build right, 390 px.

SPEC IMPACT: None — builds the approved v16 prototype; the rulings are the DECISION_LOG 2026-11-06 rows already in the
corpus.
