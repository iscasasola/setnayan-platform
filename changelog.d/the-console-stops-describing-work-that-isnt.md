## 2026-08-19 · fix(admin): two cards described work that does not exist

Both came out of the owner answering, one by one, which of the ten uncounted
queues need attention. **Two of the ten were not queues at all** — their *card
text* invented the work, not the product.

### Payouts — "Vendor payouts ready to release"

Owner, asked directly: *"we do not have a payout."* Correct, and the code already
agreed: `lib/admin/work-rows.ts` took payouts off the work list on 2026-08-04
because it **"can never accrue new work"** — the 2026-05-28 V2 cutover made
Setnayan a software publisher rather than a marketplace intermediary, and couples
pay vendors directly, off-platform. It fires only for pre-V2 orders still
carrying a vendor id.

🔑 **A CARD THAT SAYS "READY TO RELEASE" DESCRIBES MONEY WAITING ON YOU.** This
one can never have any. Now reads as what it is: a closed trail from before
Setnayan stopped handling vendor money. **Kept, not deleted** — the pre-V2 trail
must stay readable during a dispute.

### Pax changes — "Guest-count change requests awaiting review"

**Nothing is awaiting review.** The page's own docblock says *"Read-only by
design — the parties act on their own surfaces; HQ only observes."* A guest count
moves, the cost recalculates, the vendor accepts or declines the surcharge on
their own screen, and a row lands here so a mediator can answer *"why did this
vendor's cost jump?"*

Owner, asked whether pax changes should be automatic: **"automatic."** They
already are — and his earlier *"minimum is different"* is built too: the vendor's
`min_pax` is a **billing floor**, not a refusal. The count may drop freely and the
service still bills at the minimum, which is exactly what makes fully-automatic
safe. **Nothing to build.**

🔑 **"AWAITING REVIEW" PUT WORK ON A SCREEN THAT HAS NONE.** It is how a
read-only trail came to be counted among ten uncounted queues in a review of the
admin console — including by me, an hour earlier, reading the card instead of the
page.

### The pattern

Same family as everything else this session: **a sentence claiming something the
mechanism does not do.** A screen that says "nothing here" without checking, a
menu row pointing at a page nobody can open, a confirmation naming an id instead
of a song — and now a card advertising work that cannot arrive.

RULE 0 earned its keep twice here: both looked like builds and neither was.

SPEC IMPACT: None.
