## 2026-08-21 · fix(dashboard): the card counter no longer says the same number twice

Owner, looking at his own home screen: the card read **"9 need you · 9 tasks
overdue"**. Nine, twice.

🔑 **THE SECOND COSTUME OF A BUG FIXED THE DAY BEFORE.** That one was
*"9 3 payments to settle"* — two DIFFERENT numbers running together with nothing
between them. Giving the total its own noun ("need you") fixed the collision but
not the **repetition**: `summarizeEventDecisions` always returns a **count-led**
label, so when everything waiting is a single kind, `total === top.count` and the
pill states one number in two places.

The total is now passed only when it says something the label cannot — when other
kinds are also waiting, i.e. `total > top.count`. One kind waiting renders
**"9 tasks overdue"**, which already answers how many AND what.

🔑 **A SUMMARY THAT REPEATS ITSELF READS AS A BUG EVEN WHEN THE NUMBER IS RIGHT.**
The owner needed no context to see it was wrong — he just looked at his own board.
No test could have failed here, because both numbers were correct.

**Guard:** 16 assertions (1 new). Both sabotages mutation-checked with counts
printed before → after, both RED.

SPEC IMPACT: None — copy correction to the 2026-08-20 counter.
