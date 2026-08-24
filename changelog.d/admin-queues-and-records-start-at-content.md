## 2026-08-24 · refactor(admin): the judgement queues and the record pages (4/4) — the bill reaches ZERO

Bill `18 → 0`. Every screen in the admin console now opens at its content.

**Nine judgement queues** — chat flags · Today's Focus enforcement · integrity watch · repost watch ·
review moderation · user reports · force majeure · editorial review · edit unclaimed vendor.
🔒 Two rescan controls moved into `actions` (each the only way to re-run its screening from that
screen) and are pinned by the guard.

🔑 **Eight RECORD pages were ported the OTHER WAY, and that is the finding.** On a record page the
heading is not a page name — it is a person's name, a shop's name, a flag's reference, the event
type the screen edits. That is the content, it is why you opened the page, and hiding it would be
deleting **data** rather than chrome. So the visible line is unchanged, keeps its exact type
treatment, and only its element moves from `<h1>` to `<p>`; `titleNode` carries the same words into
the masthead at zero pixels. A guard stops a later pass "finishing the job" and leaving somebody's
record with nothing on it saying whose record it is.

🪤 **THREE OF THIS GUARD'S OWN SENTENCE PINS WERE DECORATIVE, AND ONLY THE MUTATION RUN SAID SO.**
They asked whether a phrase still matched the file — and three of the phrases occur more than once
in their own file (`chat-flags` repeats one on every row; `repost-watch` says one twice; "starter
content" occurs **six** times). Deleting the sentence from the lede left a second occurrence
standing and the guard reported **GREEN**: measured 2 → 1 and 3 → 2, both green, both proving
nothing. Both rules now require an occurrence count of **exactly one**, which fails in both
directions — a deletion drops to 0, and a future duplicate that would re-arm the same blind spot
goes to 2.

🔁 **One half of a retired subtitle came back, deliberately, in a different slot.** `/admin/money`'s
subtitle ended *"the act-now money queues (Payments · Payouts · Subscriptions) live in Overview"* —
a pointer to somewhere the cards on that page do **not** go, which is the one thing a grid of links
cannot say for itself. Without it, an operator looking for Payments on the Money page concludes it
is missing. It returns as a `note` beside the cards; a guard pins that exactly one landing uses the
slot, so it cannot quietly become the subtitle again.

SPEC IMPACT: None.
