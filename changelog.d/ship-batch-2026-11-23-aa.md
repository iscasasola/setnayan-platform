## 2026-11-23 · ship(batch-aa): #8190 the supplier plans' final prices, monthly only · #8177 a price change is live on save

#8190: Plus ₱1,990 · Pro ₱4,990 · Ultra ₱8,990 per month (owner, verbatim: "1990, 4990 and 8990"). The yearly plans, the extra seat and the extra branch come off sale. Their rows are kept, retired with a reason. Migration `20271360321657_supplier_prices_final_monthly_only.sql` (controller GO pinned to blob 1748904703). Its precondition (no shop on a retiring SKU, a yearly cycle or bought seats) was re-measured on production right before the merge: all zero. #8177: an admin's price save in /admin/pricing is live at once through the one price writer, with its audit row (owner: "no need for a second admin. auto approve"). An older pending request for the same SKU is closed, so it can never put the old figure back.

Ship controller: generated files regenerated once (port baseline, admin jobs); the exposure surface is unchanged.

SPEC IMPACT: None (each PR's own fragment carries its spec notes)
