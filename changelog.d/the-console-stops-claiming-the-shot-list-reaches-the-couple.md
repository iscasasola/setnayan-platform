## 2026-09-14 · fix(dayof): the console stops telling a supplier the shot list reaches the couple

Both headings above the day-of shot list read **"Shot list · syncs to the couple"**.
It does not. `shot-list.tsx` says so in its own docblock — *"Nothing here touches
the server"* — and its only persistence is `window.localStorage`, namespaced by
eventId. The list never reaches the couple and does not even follow the shooter
to a second device.

**The claim and the mechanism were written by the same commit and contradicted
each other from the start.** Nothing ever failed: a sentence cannot fail a test
that does not exist. A photographer reading that heading on a wedding morning
has no reason to send the couple anything, because the screen says it is done.

Headings now read **"Shot list · yours, on this device"**. Nothing else changes —
this is a claim being withdrawn, not a feature being removed. A synced,
couple-shared shot list remains a follow-up (it needs a table plus booked-vendor
RLS), and the component's own docblock already said so.

`the-console-claims-only-what-it-does.test.ts` pins two properties, and the
second is the load-bearing one:

1. no console heading says the shot list syncs/sends/shares/delivers to the couple;
2. **if `shot-list.tsx` ever gains a real server writer, the test FAILS** — so
   the claim may return, but only together with the mechanism, and whoever
   builds the sync is told to update the heading rather than finding it already
   there.

Property 2 is why this is not a string ban. A guard that only forbade the words
would stay green on the day somebody shipped the sync and left the honest
heading in place, and would forbid a true statement.

The verb list is deliberately narrow — the console legitimately says the shot
list sits *against the couple's live timeline*, which is true: the timeline is
read, the list is not sent.

🛡 Mutation-checked, occurrence counts printed before and after so the sabotage
is proven to have landed: restoring the claim on ONE of the two sites went RED
naming line 968 (honest headings 2 → 1); adding a fake `await fetch(...)` to
`shot-list.tsx` went RED on the writer rule; the untouched tree is GREEN in a
control run after each restore.

SPEC IMPACT: None — this withdraws a false claim from a screen. The owner's
2026-09-14 ruling that the console must stop claiming the shot list reaches the
couple is already recorded in `DECISION_LOG.md`.
