## 2026-08-21 · fix(events): a supplier you have paid holds the delete

Owner, 2026-08-21: *"when a user decides to delete an event and they paid vendors.
they can only delete it if the vendors with paid purchase accepts that this
deletion. but if the event is already completed and they have completed their
service for that event, the user can delete it anytime."*

🚨 **NONE OF THE EXISTING MONEY SIGNALS COULD SEE THIS.** The delete gate refuses
an event carrying a settled order, a payment row or a BIR receipt — all of which
are money paid **to Setnayan**. The couple pays a supplier **directly,
off-platform**; Setnayan never holds it. Measured in prod: **"Maria & Jose" has
12 booked suppliers and 3 paid a deposit — and every Setnayan-side signal reads
zero for it.** One press would have erased all twelve bookings and three payment
records.

**The gate now also refuses while any supplier is UNSETTLED** — paid, and not yet
released. Verified against production: Maria & Jose → **3**, every other event →
**0**, so exactly one event is held and it is the right one.

**Released needs BOTH halves**, because the owner named both:
- the celebration's **last** day has passed (`event_end_date ?? event_date`, on the
  **PH-local** day — never the server's UTC clock), **and**
- the job is **confirmed** — `completion_status` at `confirmed`/`auto_confirmed`,
  or the older booking enum at `delivered`/`complete`.

🔑 **`vendor_marked` IS A CLAIM, NOT A RELEASE.** The ladder is
`awaiting_vendor → vendor_marked → confirmed/auto_confirmed`, and `vendor_marked`
is the supplier *saying* they finished with nobody agreeing. Treating it as
finished would let the couple delete on the supplier's own unconfirmed word — the
opposite of the consent asked for.

🚨 **A `disputed` completion NEVER releases**, checked first so nothing can
override it. That is the one state where deleting the evidence is least
acceptable: the two parties disagree about whether the job was done.

**Paid is read four ways**, because a couple records it four ways: the booking at
`deposit_paid`, a deposit amount, a deposit timestamp, or a logged payment row.
Any one means real money left their hands.

⏭ **THIS IS THE STOP-GAP, NOT THE RULE.** The owner's rule gives the couple a way
through — the supplier ACCEPTS — and that handshake is not built yet. Until it is,
a paid supplier holds the delete outright and the message says to put the event
away or message us. Refusing is the safe half of the rule; the accept flow is next.

⚠ **AND THE BIGGER HALF OF HIS INSTRUCTION IS NOT IN THIS PR.** *"statistics and
data for the vendor stays, including the reviews"* — **`vendor_reviews.event_id` is
NOT NULL and ON DELETE CASCADE**, so a review cannot currently outlive its event,
along with 37 other vendor-linked tables. That is a schema change and its own PR.

**Guards:** 18 assertions (7 new). All 7 sabotages mutation-checked with counts
printed before → after, all RED — including one proving a dispute cannot be
released by the older status enum, and one each proving neither half of the
release works alone.

🪤 **I DELETED A FUNCTION MID-EDIT AND THE TESTS CAUGHT IT.** Replacing "from this
symbol to end of file" took `confirmationMatches` with it — three unrelated tests
went red immediately. Restored from `origin/main` and verified by diffing the
exported symbols against main: only the two new ones differ. **A replace anchored
to end-of-file has no right edge.**

🪤 **AND THE FIRST DRAFT NAMED THREE PHANTOM COLUMNS** — `event_vendor_id` on both
tables and `vendor_profile_id` on `event_vendors`, none of which exist. The join
key is `vendor_id`. Caught by asking production for the real columns before
trusting the code; the fail-closed default would have hidden it as a permanent
refusal.

SPEC IMPACT: `DECISION_LOG.md` — row added 2026-08-21 (paid suppliers hold a
deletion; vendor data must survive — the latter still to build).
