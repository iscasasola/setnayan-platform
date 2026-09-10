## 2026-09-09 · fix(bench): a booked supplier can be reached, and the card's elements are pinned

**A locked bench card rendered no controls at all** — `if (vendor.status === 'locked')
return NO_ACTIONS;`. Correct for *Add to build* and *Lock this*, which the rule's own
comment justifies; wrong for the conversation, so **a couple could not open a thread with
the one supplier they had actually booked** — the card most likely to have something
waiting on them. Rules 5 and 6 in the same file had already drawn that distinction for
their own cases. A settled booking is not a finished conversation.

⚠ **A passing test asserted the defect** (*"a locked vendor shows none of the three"*) and
is corrected here, with why.

Alongside it, a guard that pins **every element a bench card renders** — photograph,
initials fallback, ★ Chosen / Asked corner, name, city, rating, Setnayan and Verified
badges, fit badges, price, free dates, the three actions, and both **Find** and **Add
manually**. A design pass had silently dropped ten of those and only the owner's eye
caught it.

⚠ **The guard asserts COUNTS, not presence** — the file renders two card shapes and two
Find-more sites, and the first cut passed three sabotages because deleting one copy left
the other satisfying it.

SPEC IMPACT: None.
