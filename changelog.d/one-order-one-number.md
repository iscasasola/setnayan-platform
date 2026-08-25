## 2026-08-25 · fix(payments,papic): one order, one number — and one Papic, not two

Found by the FIRST REAL PURCHASE (₱2,499 Setnayan AI, order `S89O-BSTY3J0STT`,
paid and matched in 3 minutes). The flow worked; three things around it did not.

**1 · A buyer's inbox named one order three ways in three minutes.**
"Setnayan order SN9B5605B1 — received" (reference code) · "Order
S89O-BSTY3J0STT marked paid" (internal id) · "Payment of ₱2,499 matched"
(named nothing). Nothing said those were the same purchase. All customer
notices now use the reference code — the number the buyer is given first and
the one printed on their own order page. `lib/order-naming.ts`.
🪤 The old form `Order ${order?.public_id ?? ''} marked paid` renders "Order
marked paid" with a hole in it when the lookup misses; the helper names
nothing rather than leaving one.

**2 · The payments queue had no search at all.** Only status + platform
filters over the newest 100 rows, so a buyer writing in quoting their own
reference code could not be looked up. Now searchable by reference code,
order id, or the bank reference they typed — and the search reaches PAST the
100-row window, which is the whole point.
🪤 Sanitised, not escaped: PostgREST `.or()` takes a comma-separated filter
string, so a comma in the term silently re-parses as extra filters — rejected,
not thrown, with an empty queue as the only symptom.

**3 · 🚨 The cameras tab still sold a SECOND Papic product.** Owner, looking at
`/studio/papic?tab=cameras`: *"We only have 1 type of papic service that starts
at 50 credits and increases as they increase their payment."* The CATALOG
already obeyed that lock — every per-camera price row is inactive — but
`papic_tier_config.mini` was still `is_active = TRUE` under the retired display
title **"Papic One"**, and the screen reads the CONFIG, not the catalog. So a
separately-priced camera rendered beside the credit ladder.
🔑 Earlier retirements switched off BOTH halves; this one switched off the
catalog half and left the half that decides what the screen shows.
⛔ Deactivated, never dropped — `PAPIC_CAMERA_MINI_DAY` is still the sku_code
legacy seats and `papic_grant_camera_points()` reference.
✅ Safe by arithmetic, measured in prod first: 0 papic_one_orders · 0
papic_guest_orders · 0 seats · 0 PAPIC orders ever.
🔎 Exactly one reader of that flag (grepped, not remembered): the extra-cameras
buy picker. Setting credits aside for one camera goes through the point grant
and is unaffected.

Migration `20271168715385_one_papic_no_second_camera_product.sql`.

🛡 Guards: `lib/order-naming.test.ts` (5) · `lib/one-papic.test.ts` (3), each
mutation-tested by occurrence count — namer calls 5→4 red, migration FALSE 1→0
red, picker filter 1→0 red.
🪤 Rev 1 of the re-activation guard was decoration and failed on two false
positives — file-level matching (an unrelated catalog UPDATE in the same file)
and not stripping comments (the sibling migration QUOTES the bug it fixed). It
now strips comments and judges each statement alone.

SPEC IMPACT: None. Restates the 2026-08-11 one-Papic lock already in the corpus;
no price, SKU or rule changed.
