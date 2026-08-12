## 2026-08-12 · fix(live-wall): the wall going free exposed a mirror the couple could not switch off

**The photo wall became FREE FOR EVERY EVENT today** (`FREE_FOR_ALL_SKUS`), so
`eventSkuActive('LIVE_WALL')` now returns true unconditionally. Yesterday it was
a paid add-on with **zero orders in production**, which meant the guest-mirror
gate was closed everywhere and two problems were invisible.

**1 · A control that is not reachable is not a control.** `LiveWallCard` — where
the couple's on/off switch lives — renders only when Papic is active. The guest
mirror did not check Papic. So on an event with the wall available and no Papic,
**the wall played on every guest's phone and the couple had no switch at all.**
That is the "fix nobody can reach" shape, arrived at from the other direction:
not a control nobody can find, but a behaviour whose control does not render.

**2 · An empty promise on every wedding page.** The wall projects Papic captures.
With no cameras, `wall_feed` is empty, and the block still rendered through the
whole live window saying *"the wall is warming up — photos appear here the moment
they're taken."* Nothing was ever coming. Prod: **4 of 5 events have live Papic
seats; 1 does not**, and that one would have shown the promise all day.

**The fix is one line in the one gate:** `guestWallMirrorActive` now asks the
**same** preconditions as the couple's own card. A test asserts they cannot drift
apart again — whenever a thing can be switched off, "is it on?" and "can they
turn it off?" have to be the same question.

### The test caught itself being decorative — twice, in the same file

The first cut asserted only that both preconditions were **called**. Deleting
`|| !papicActive` from the refusal left it **green** while the gate stopped
enforcing Papic entirely: *calling a check and dropping its answer is
indistinguishable from not calling it, and reads as more thorough.* Now each
precondition must also appear in a refusal that can `return false`.
Mutation-proved — all three sabotages red, green again on restore.

That is the second time in two days this exact shape has slipped past in this
file (the first was an assertion satisfied by a **type cast** while the query was
gutted). Anchor to the act, never the name.

### Dead prices removed

Yesterday's PR wrote the wall's then-price into five comments. It changed within
the day. Per the house rule — *"prices moved often enough that every copy of them
became a way to quote a dead number"* — the number is gone from all of them
rather than updated, including one in another session's comment.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-12 — the wall is free for every event, so
the guest mirror is now universal and default-on; it is gated on Papic so it
appears only where there is something to project and where the couple can switch
it off.
