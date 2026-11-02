## 2026-08-02 · fix(papic): high-res originals expire per EVENT, not per photo

Owner-locked: *"the total time we keep their high resolution is 6 months from the
first day they use the service. the reason why i said 5 month for until the event
date is so they have at least 30 days to download the files they have."*

🚨 **The old rule deleted the beginning of the journey first.** The sweep aged
each photo against its OWN capture time, 90 days. Fine for a one-day wedding, and
wrong for the journey this product is now for:

> a photo taken 5 months (150 days) before the wedding had its original deleted
> 90 days later — **two months BEFORE the wedding itself.**

The longer the couple's journey, the more of its start was destroyed, and it was
**silent**: the gallery keeps working because the compressed copy survives. Only
someone asking for a print-quality file months later would ever have found out.

A per-photo clock cannot express the owner's sentence, because the sentence is
about the **event**. So the clock moved: one per event, 6 months from its first
capture, spanning both capture tables (a guest phone and a seat camera are the
same service to the person paying).

**Two terms, not one.** The rule also holds a photo until 30 days after the event
date. That is not extra policy — it is the owner's own stated *reason* turned into
a rule instead of left as arithmetic that only works while nobody opens their
window earlier than 5 months out or moves their date. It can only ever keep files
longer; it can never cause an earlier deletion.

**Fail-CLOSED throughout.** An unreadable clock drops nothing that pass, and an
empty list short-circuits rather than reaching a query with an empty `IN`.
Deleting an original is irreversible; a sweep that does nothing is recoverable
next run.

⚠ Three existing tests pinned the per-photo fuse. Rewritten to assert the new
invariant — and the "unparseable timestamp fails closed" half they also carried
was kept, since only the age assertion was wrong.

⚠ Also fixed a stale header comment claiming the sweep ships dry-run by default.
It has been ON by default since the owner enabled it 2026-07-11; only the comment
was out of date. Prod holds excluded sample photos only, so nothing was at risk.

SPEC IMPACT: `DECISION_LOG.md` — full-res retention is 6 months from an event's
first capture (was 90 days per photo), with a 30-day post-event download grace.
