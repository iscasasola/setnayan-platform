## 2026-09-09 · feat(vendor-thread): the tools are a list on the right, not a wall above the box

The supplier's conversation screen had six panels sitting between the last
message and the text box, so the conversation rendered as a sliver and on a
phone was pushed off screen (owner: *"still messy chatbox"* · *"the right most
can be the tools"*). The same six now mount **once**, closed, above the message
stream, and the customer rail's right column is the labelled list that opens
them. Nothing was removed.

Shipped as one change rather than two, because moving the panels alone breaks
four live controls in silence — the rail's own "Send proposal" and the client
brief's Quote / Call / Log-payment deep links all point at ids that would then
sit inside a closed disclosure, so they scroll to a collapsed strip and read as
buttons that do nothing. `revealThreadTool` opens every disclosure on the way to
its target, and `ThreadToolHashReveal` does the same for a hash the page is
opened with.

Also: "Voice call" and "Video call" are two entries (they open one panel and
focus different buttons — nothing dials), the launchers render only while the
panels are on the page, and a shop with **no proposal template** is told so with
a link to the maker, because the composer refuses to send without one and offers
no way out.

Guard: `apps/web/lib/the-thread-tools-open-what-they-name.test.ts` — 8
reachability assertions, each mutation-checked by occurrence count.

SPEC IMPACT: None — no schema, no customer-facing copy, no pricing.
