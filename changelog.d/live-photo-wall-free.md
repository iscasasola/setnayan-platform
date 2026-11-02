## 2026-08-11 · feat(pricing): the Live Photo Wall is free for every event

Owner decision, verbatim: **"live photo wall FREE."** It was ₱2,500 and had never
been bought by anyone. Both halves are now free — the venue projection **and** the
mirror that runs on every guest's own phone during the celebration.

**⚠ The catalog flip alone would have done the OPPOSITE of what was asked.**
Every gate on the wall asks `eventOwnsSku` / `eventSkuActive` for `LIVE_WALL`.
Setting `is_active = false` the way a genuinely retired product is taken off sale
means nobody can buy it ⇒ nobody owns it ⇒ **the wall goes dark for everyone**.
Free and retired are identical in the catalog and opposite in the product.

So this ships as two halves that must travel together:

- **`FREE_FOR_ALL_SKUS`** (new, `lib/entitlements.ts`) — a permanent, unflagged set
  of SKUs that are free for every event, short-circuiting all three ownership
  predicates (`eventOwnsSku`, `eventSkuActive`, `eventActiveSkus`). Seeded into the
  batch set too, so the Studio's owned-state badge cannot disagree with the feature
  gate.
- **The catalog row is deactivated** (migration `20271136665973`) purely so nothing
  quotes a price. `retail_price_php` is deliberately left at 2500.00 so the
  historical figure survives a reversal.

**⚠ Not a promo window.** `lib/promo-free-windows.ts` already makes SKUs free for
everyone, but it is deliberately **ephemeral and flag-gated** — "free this weekend",
reverting when the window closes. This is a permanent decision about what a product
costs, so it does not belong there.

**Copy follows the price, in the same PR:**
- `llms.txt` drops `LIVE_WALL` from `REQUIRED_RETAIL` and its prose line now reads
  **free** (and finally mentions the guest-phone mirror). 🪤 **Mandatory, not
  cosmetic:** leaving either the entry or the `R('LIVE_WALL')` call throws and drops
  the whole AI/GEO document to its 603-byte stub — which happened in production
  hours earlier when `PAPIC_ADDON_STORIES` was retired without touching that file
  (#4357).
- The hand-written `llms-txt.test.ts` fixture is updated in the same PR, because it
  is a **second hand-typed copy of the catalog** and CI reads it, not the database.
- `/pricing` no longer lists it among the paid à-la-carte rows (correct — that page
  lists what you pay for); the code stays listed with a note, matching the file's
  own convention for legibility.

**Tests that would have gone quiet were repointed, not weakened.** Five entitlement
tests used `LIVE_WALL` as their stand-in "paid SKU"; they now resolve owned with no
order, so each would have kept passing while testing nothing. Repointed at
`PAPIC_ADDON_THANK_YOU` (genuinely paid + active) so they still test the mechanism.
One assertion of `active.size === 0` became a precise statement of its intent rather
than a count. **Three new tests assert the free behaviour directly** — if someone
removes `LIVE_WALL` from the free set while its row stays deactivated, the wall does
not become paid again, it goes dark, and those tests are what make that loud.

Left alone deliberately: the wall still requires Papic to be active (it projects
Papic captures — owner 2026-06-26), and the demo-only Maya price book, whose own
docblock says its figures are stale by design and never bill.

Verified: typecheck clean · 7,643 unit tests pass.

SPEC IMPACT: Yes — `Pricing.md` (Live Photo Wall is free, not ₱2,500) and a
`DECISION_LOG.md` row. Applied directly per the standing 2026-06-04 authorization.
