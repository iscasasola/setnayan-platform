## 2026-09-08 · fix(copy): stop quoting a retired currency at suppliers

Owner, reading his own inquiry card: *"why do i see accepting token is free. this
token system does not exist anymore."*

The founder inquiry note read **"Accepting is token-free."** Two things were
wrong, and the second is the worse one:

1. **Tokens are retired.** `chat-actions.ts` says so at the point of accepting —
   *"answering is free — token packs are retired"* — and
   `unlock_vendor_event_free` forces `v_tokens := 0` for every tier, with its own
   burn path marked *"retained but unreachable"*.
2. **It advertised a privilege that is universal.** Answering is free for EVERY
   vendor since the inbox was ungated (owner 2026-07-24): *"no tier wall and no
   weekly cap."* Telling a supplier that accepting *this* inquiry costs nothing
   implies the others do — and the card already states the true, unconditional
   version one line above: *"Accept to see who they are and reply — it's free."*

🔑 **A PERK EVERYONE HAS IS NOT A PERK.** Naming it made a founder inquiry look
like a discount, denominated in a system that no longer exists.

### What changed

- `FOUNDER_INQUIRY_NOTE` and `FOUNDER_INQUIRY_NOTIFICATION_PREFIX` keep the
  identity half — the half that still says something — and drop the cost clause.
  The prefix matters more: it goes out by **email**, where no surrounding card
  can correct it and nothing can be taken back.
- Two **rendered admin strings** — the founder-seats page and its nav
  description — stopped listing "token-free vendor inquiries" among what a seat
  buys. They tell the person GRANTING a seat what it confers, so a stale benefit
  there is a decision made on wrong information.

### What deliberately did NOT change

The module docblock still records benefit (1) and the comp mechanism, now
annotated as **vestigial**: it was owner-locked on 2026-07-16, the comp row is
still written with `comp_reason 'founder'`, and the audit trail is intact — it
simply comps nothing, because there is nothing left to charge.

⚠ **Deleting the record of a locked decision is not the same as retiring a claim
made to a supplier.** The guard polices rendered strings only, and comments are
explicitly out of scope.

Mutation-tested six ways, including the two that matter most: reintroducing the
claim reworded as plain "free" (still a false privilege), and removing a REAL
benefit alongside the vestigial one.

SPEC IMPACT: None — the 2026-07-16 seat decision stands; only copy describing a
retired charge is withdrawn.
