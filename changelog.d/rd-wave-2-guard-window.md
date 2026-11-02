## 2026-09-22 · fix(guard): the offered-service mount guard reads a brace-matched block, not 600 characters

`the-offer-posts-a-card.test.ts` asserted the chat stream mounts `<ChatOfferedServiceCard>`
inside `if (m.offered_service_id)` by slicing a fixed **600 characters** from the branch. The
chat-frame build added a seven-line comment inside that branch — the quote-replaces-offer rule
— which pushed the mount to **offset 715**. The card was still mounted, still exactly once, and
the guard went red anyway: the window could no longer see it.

🔑 **A fixed character count fails in BOTH directions.** Too short and it misses the thing it
guards. Too long and it runs into the next branch and calls a neighbour's code a pass. Neither
failure says which one happened. The window now ends at the block's own closing brace, which is
the unit the assertion actually means, and a second assertion pins the mount **count at exactly
1** in the whole file — that is what stops a too-long window, and the old guard had nothing
like it.

Proved by sabotage, not by going green: renaming the mount → red; adding a second mount behind
a constant `false` → red; restored → 8/8. The cheapest off-switch was used each time, never a
deletion.

SPEC IMPACT: None.
