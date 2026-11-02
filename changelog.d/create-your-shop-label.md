## 2026-08-10 · fix(wayfinding): the shop door says "Create your shop", in the shop slot

Follow-up to `open-shop-doorway.md` (PR #4328), on owner instruction the same
day: *"place a button on the user home where the shop button will be. show it
but instead of entering a shop. Create your shop. or something like that."*

Two changes:

**1 · The words.** "Open your shop" → **"Create your shop"**, on the home row
and in the account menu. In a list where every other row takes you INTO
something, "Open your shop" reads as *go to my shop* — the one thing this row
does not do. "Create" says it is not there yet. Changed in BOTH places: the
home and the account menu naming one thing two ways is the overlap this
codebase removes on sight. The route stays `/open-shop` — that is a URL, not
copy.

**2 · The slot.** The row now renders INSIDE the divided row list and BEFORE
the mapped space rows — which is where a real shop row actually sits, since
shops are pushed to `spaces` ahead of the HQ row. Previously it rendered after
the whole list, so an **admin with no shop** read it BELOW HQ, which is not the
shop button's position. For a plain customer (no shop, no HQ) nothing moves
visually; this makes the placement correct for every account, not just the
common one. The container condition also keeps a team-member-only account —
no owned shop rows AND no create-door — from rendering an empty div.

Guard extended to 4 tests: the label is pinned in both files (comments stripped
first, since they legitimately quote the old wording), and the row's position
is asserted relative to the mapped rows. All assertions mutation-tested.

🪤 One mutation initially passed and the guard was NOT at fault: a `perl s///`
without `/g` replaced the first match — a **comment** — instead of the visible
label the test reads. Re-run against the label, it went red. The trap this repo
already documented, hit again: verify the sabotage landed on the thing you
meant before believing the green.

SPEC IMPACT: None. Copy + placement only.
