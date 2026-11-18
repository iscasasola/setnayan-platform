## 2026-11-16 · feat(own-clients): Add a client + the gift step + the gift on your own link (Own clients v3+v4)

Built to the owner-approved drawing `prototypes/supplier_own_clients_2026-11-16/supplier_own_clients_v4_2026-11-16_fable.html`
(specs 5af4037b) and the 16 Nov rulings: OWN CLIENTS v4 (both rows) · NO CAP ON CLIENT IMPORTS · EVERY SUPPLIER IMPORT
CARRIES AT LEAST ONE SETNAYAN GIFT · GIFTS ARE ALWAYS BOUGHT AS STOCK FIRST · own-link clients need one gift ·
the Shortlist QR is not an import.

- **Customers › QR codes** gains "Add a client" + the promise line above Booked and Crew. The sheet: Name · Email or
  phone · Agreed a date? · Note, then "Gift from you · At least one" — one ▾ per gift listing the shop's BOUGHT stock
  only ("x left"; a badge reward greyed "Doesn't count here"; "＋ Buy more"), "＋ Add another gift", "1 from your stock
  is used when the couple joins". No stock → the catalogue's Papic packs to buy, paid with the shipped Buy gifts sheet.
  Add → the confirm (To · Invite · Gift · From your stock · Booking fee: None — your client) → Send opens the phone's
  own share sheet (no Setnayan email, no SMS). "Yes, booked" goes on to the shipped Booked code.
- **The invite link** is the Shortlist link carrying the client's token (`/vendor-invite/<slug>?ci=…`). Joining gives
  the gift from stock (`own_client_gift_give`, once per shop + event) and only then makes the row `vendor_invite`
  (own client, no fee). Too little stock → the couple lands on the shortlist as a normal Setnayan save (the fee).
- **Shop › Promote › My page** gains "Gift with your link" — set once on the code. A first ask through `?src=own`
  is stamped `website` (own client) only when that gift is given; otherwise `shop_page` (the normal fee).
- **Shop › Promote › Shortlist · free** is labelled "Not your own client — If they book, the normal booking fee applies."
- **The couple** meets the gift through the shipped gift moment ("A gift from <shop>") — `gift_moments_for_event` /
  `gift_moment_claim` learn the own-client gift (source stays `shop_gift`).
- Migration `own_clients_carry_a_gift`: `vendor_client_invites`, `vendor_own_link_gifts`, `own_client_gifts`, stock
  kind `own_client`, `own_client_gift_give`. One new server action (`saveOwnClient`, two modes).

SPEC IMPACT: None — builds the approved drawing; no ruling changed.

## 2026-11-16 · fix(customers): a new shop's first outside client is never refused for "no schedule" (W1-B18)

Walked live on 8c1bbc1: Clients › + Add → Name + Date → Add said "Pick which schedule this client belongs to. Nothing
was added." with no picker on screen — the sheet had posted an empty `pool_id`. One rule now (`lib/outside-client-pool.ts`),
asked by the sheet and by `importExternalClient`: a posted schedule wins; none posted and exactly one schedule → that
one; never an empty pool. The "+ Add" button's look is unchanged (the v4 drawing does not draw it).

SPEC IMPACT: None.

## 2026-11-16 · feat(own-clients): the import records its fee facts; verified shops only

- Import-fee ruling (specs d4899cd5, amended 9fe95ebe): `own_client_gifts` records, once and by the server,
  `account_new_by_import` · `event_new_by_import` · `first_import_on_event`. An Add-a-client join is marked the
  shop's own client only when the import created the client's account, or the shop is the event's first imported
  supplier (`importIsOwnClient`). Everyone else still gets the gift and pays the normal fee. The 12-month window and
  every other fee arm are the booking-fee logic's (`booking_fee_attribution_for`), not this PR's.
- Unverified shops (DECISION_LOG "UNVERIFIED SHOPS DO GET THE QR", which reverses the same-day 34909f12 lock): they keep
  Add a client and the own link, their imports and own-link asks are never fee-free, and both screens carry the owner's
  line "Get verified to qualify for free bookings from your QR."
- The Shortlist QR "Not your own client" label is removed: the Shortlist QR now follows the first-supplier rule (specs
  1abf35b). Moving its booking source is left to the booking-fee logic.
- DB test `an-own-client-gift-is-given-once.db.test.ts` (6 tests, two sabotages measured red).

SPEC IMPACT: None — implements the 16 Nov rulings as recorded.

## 2026-11-16 · feat(own-clients): owner's copy answers + the own-link "add a gift" notice

Owner, on #7889, verbatim "7. Yes 8. Yes":
- The three drawing lines re-worded to the import-fee ruling: "Your clients can book you free." · "Clients new to
  Setnayan book you free for a year. Each one comes with a Setnayan gift from you." · confirm Booking fee "None if they
  are new to Setnayan, or you are the first supplier on their event".
- A verified shop whose own link has no gift is told first, on every own code it can share (My page · Check a date ·
  Reviews): "Add a gift to your link so your clients book free."

SPEC IMPACT: None — the owner's answers, applied as given.

## 2026-11-16 · fix(own-clients): the controller's audit — one verified test, no fee on an unknown, every gift kind

- One verified test (`shopIsVerified` / `fetchShopVerified`) for the QR screens, the claim and the own-link door —
  `isMarketplaceVendorBookable` (true for unverified shops since 15 Nov) no longer decides a promise. A failed read
  says "couldn't check", never "not verified".
- An own-link ask whose read FAILS keeps its own-link stamp (never charged on an unknown); only a measured "not own"
  (unverified, no gift, short stock) is stamped `shop_page`.
- Event Plus / Pro / Ultra can be own-client and own-link gifts: they unlock the event exactly as a quote gift does
  (a `given` row carrying `unlocks_sku`, so every entitlement reader sees it), each kind from its own bought stock.
- "Buy and add": the client is saved at once, the invite is sent, then the shipped Buy gifts sheet opens with "This
  client is added with one of them."
- The couple's gift moment carries "This shop is not yet verified by Setnayan" for an unverified giver; on an own
  client its ⓘ says only "Setnayan hasn't checked this shop's documents yet."
- One 5-gift limit: a guard holds `OWN_GIFT_MAX_LINES` equal to the migration's CHECK and the door's refusal.

SPEC IMPACT: None.
