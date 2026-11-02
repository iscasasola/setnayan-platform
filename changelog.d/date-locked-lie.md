## 2026-08-04 · fix(dates): stop telling a couple their wedding date is locked when it isn't

**A couple who lost a race was still shown "your date is now locked."**

`finalizeVendor` can auto-finalise the event date when locking a vendor collapses the candidate set to one. The write is guarded `.is('event_date', null)` — correctly, because the `stillNoDate` pre-read above it is TOCTOU and the guard is the only thing stopping a slow lock from clobbering a date the couple set in a parallel tab.

**But a guarded UPDATE that matches zero rows succeeds with no error.** The code read `if (!dateErr) dateLockedNow = true` — the *absence of an error* as proof of a *write*. So when the guard did its job and refused, the couple still got the milestone, the toast and the `dateJustLocked` flag, for a write that never happened. The date they were congratulated on was someone else's, or their own from another tab.

`.select('event_id')` and a row-count check. `dateLockedNow` is now true only when a row actually changed.

**The guard itself is unchanged and must stay** — dropping it is the tempting wrong fix and reopens the clobber it was added for.

Found while designing the larger fix for *"a finalized date outlives the vendor it was derived from"* (DECISION_LOG 2026-08-04). That one is fully designed and still unbuilt; this is the independent half that needed no schema change, so it ships on its own.

⚠ **Not fixed here, and still live:** reverting the vendor whose narrowing produced the date leaves the date behind permanently, and the same `.is('event_date', null)` guard means a correct value can never replace it. That needs a provenance stamp column — designed in the decision log, deliberately not folded in.

Verified: zero typecheck errors in the changed file.

SPEC IMPACT: None — no rule changed. The code now reports what actually happened.
