## 2026-11-19 · feat(shop): Shop › Makers › Templates — Quick Forms · Discounts and Promos · Payment Strategies (Card Maker part 4)

One place for what a shop saves once and uses on many cards (the HYBRID drawing's Templates screen; owner 17 Nov "Keep
Templates" and the kind names "Quick Forms / Discounts and Promos / Payment Strategies"), built onto the shipped Shop
per ruling 280d53a9 "Yes, extend it" — a fourth Makers tile opening in the shared in-body panel, server-drawn only
while `?maker=templates`.

- **Show ▾** — one dropdown picks the kind.
- **Quick Forms** — the SHIPPED Forms Maker body (`ShopFormsBody`), not a copy. Its library rows now **swipe left to
  delete with Undo** (`SwipeToDelete` + `deleteWithUndo`; `formsAction` op `retire`, written when the Undo window
  closes) — in the Forms Maker tile too, since it is the same list.
- **Discounts and Promos** — raises the SHIPPED Offer Maker over the panel (it already lists, opens, swipe-deletes with
  Undo and makes new offers). Unverified shops get the shared lock (Problem → Solution).
- **Payment Strategies** — NEW: the shop's saved pay plans (`vendor_pay_plans`, part 2) with "N payments · on N cards".
  Tap opens its payments; swipe left deletes with Undo (`formsAction` op `plan-retire`, a live plan of this shop only,
  one row or it says so). Every card keeps its own payment rows. A refused read is said, never "none yet".
- No new server action (the delete rides `formsAction`), no migration. Availability presets are the Availability
  builder's and are not drawn here.

SPEC IMPACT: None — implements the approved drawing's Templates screen on the shipped Shop; no corpus text changes.
