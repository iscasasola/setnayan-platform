## 2026-08-29 · docs(vendor): the pipeline ceilings are ON — correcting the doc that still says OFF

**SPEC IMPACT:** None (the corpus row landed with the flip). Doc-only.

`apps/web/VENDOR_TIERS_AND_BENEFITS.md` still read **"SHIPPED SWITCHED OFF"** with the flip
described as owed. It was performed on 2026-08-29 at the owner's direct instruction (*"Turn it on
now"*), after PR #4985 was **served** — verified by ancestry against production's own
`/api/health`, not by the version merely changing.

🔑 **A correction that lands only in the decision log has not landed.** This project has recorded
that exact failure four times, and each time a later session acted on the stale copy — most
recently sending the owner hunting for an order he had personally cancelled five days earlier. So
the doc a session actually opens is corrected in its own commit rather than left to catch up.

Two other stale claims in the same block are fixed while there: prod shops are **`solo` and
`verified`**, not `free`, and the reversal statement is written out so nobody has to derive it.

**Measured at the flip, and recorded because "safe" without a number is an opinion:** 2 shops ·
both Solo · both holding 1 with the waiting list off · **zero accepted chat threads in the entire
database**. Both rows byte-identical afterwards.
