## 2026-08-24 · feat(dashboard): one screen that answers "who is in my event?"

**W5-C item 1.** The answer was spread across five routes and never assembled:
hosts and delegates on `/hosts`, the invited on `/guests`, hired helpers on
`/manpower`, suppliers on `/vendors`, whoever is holding a camera on
`/studio/papic/crew`. A couple could count each and nobody could count them
together. `/dashboard/[eventId]/people` is that view.

⛔ **BUILT ABOVE THEM, NOT INSTEAD OF THEM.** Every row links into the route that
already owns its group. No editor, form or control is duplicated; all five pages
are untouched and keep their own gates.

⛔ **ROSTER ONLY — no broadcast.** Whether a coordinator nobody promoted may
message all the guests is an owner decision. There is no compose box, no send and
no recipient list, and a guard matches the SHAPES a messaging surface takes
(`<form`, `action={`, `recipients`, …) rather than one spelling of one word.

🔑 **A ROW YOU CANNOT OPEN IS A DEAD END** — the same rule as this session's
ribbon fix, and the reason the gate decides the QUERIES, not just the markup: a
count somebody may not see is still a disclosure. Visibility MIRRORS each
destination's own rule and never widens one. `/manpower` and
`/studio/papic/crew` redirect a delegate and have no delegate area to consult, so
they are couple-only here; adding them would be inventing a permission.

⚠ **A TEST I WROTE ASSERTED THE WRONG RULE AND THE CODE WAS RIGHT.** I expected
the live external planner to see only the host list. `moderator_area_level` in
production ends `WHEN p_area IN ('guest_list','seat_plan','schedule','vendors',
'invitations') THEN … ELSE 'view'`, so a delegate with no explicit key holds
**view** on guests and suppliers. That is the DECISION, written the same way in
SQL and in the TS mirror. The roster mirrors it rather than narrowing it —
showing her less than the routes themselves do would be a second, invisible
permission rule. The corrected test records why.

🪤 **AN UNREAD COUNT IS NOT ZERO, ALL THE WAY TO THE WORDS.** On a roster, "No
guests yet" and "Couldn't count them just now" send a couple to two different
places. `null` survives to the copy, and the headline **names how many groups it
could not reach** instead of printing a confident total that silently omits a
whole group. This is also why `getConfirmedVendorCount` is deliberately NOT
reused — it returns **0** on a failed read, which on this screen says "you have
booked nobody".

**Proof:** 15 tests; **7 mutations, every one RED** — fold null into zero · drop
the headline's hedge · offer a delegate the couple-only lists · count an
ungated group · restore the 0-on-error supplier helper · inject a compose box ·
remove the doorway. ⚠ **Two of them (the first two) initially printed an
UNCHANGED count and reported GREEN** — the patterns could not match a curly
apostrophe, so their pass proved nothing. Both were redone with the substitution
asserted before the result was read. Typecheck exit 0 · 9848/9848 · port-controls
lint clean (404 routes, nothing lost).

SPEC IMPACT: None — new read-only surface over five existing ones.
