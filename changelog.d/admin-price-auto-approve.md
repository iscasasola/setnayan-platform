## 2026-11-23 · fix(admin): a price change is live on save, with no second admin

**Owner, 23 Nov 2026,** about his Live Watch price that sat in /admin/approvals: *"no need for a second admin. auto approve"*.

- **Catalogue › Prices › Save this price** (`saveRetailRow`):
  - A change to a customer price applies at once. It goes through the one writer, `executeRetailPriceChange`.
  - The page says `Live — ₱…`.
  - The audit row keeps before → after, who, when, and `applied_directly`.
  - The title and description still save first, apart from the price.
- **An older request is closed on save.** A request still pending for the same item becomes `expired`, with the
  reason "Applied directly, owner rule 23 Nov". An approval opened before the ruling can no longer put the old price
  back. The approvals dispatcher keeps its arm for requests on other items that are still pending.
- **The price formula's "Apply to all"** now reports "N prices live now", not "each waits for a second admin".
- **Stays two-admin:** plan contents (`approve_plan_contents_change` is a separate gate, not a price) and every
  other approval type.
- **Guards:**
  - `a-price-change-takes-two-admins.test.ts` is now `a-price-change-applies-at-once.test.ts`, holding the new rule
    with the owner's quote. It still holds one writer per surface, writes to price columns only, and the audit row.
  - It newly holds the close of pending requests, the close coming before the apply, and that no new request is opened.
  - Sabotaged twice (the executor call removed, then the close removed): red both times, restored.
- **The contract quote is kept.** `lib/two-admin-promise.ts` keeps the Vendor Agreement § 9.1 price row, because the
  help page quotes the contract. The row is marked NOT ENFORCED, by this ruling. The admin help articles now say a
  price takes one admin and is live at once.

SPEC IMPACT: The owner's ruling (controller updates DECISION_LOG). ⚠ Vendor Agreement § 9 / § 9.1 still say mid-quarter price changes need two admins. Amending that text is the owner's call.
