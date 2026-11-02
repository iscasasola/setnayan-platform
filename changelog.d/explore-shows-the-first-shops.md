## 2026-09-08 · fix(explore): the landing shows the shops it has

Owner, on `/explore` with two shops live: *"entering on this page should
automatically show service cards already. why don't I see any"*.

**The landing rendered the category taxonomy INSTEAD of vendors, and its own
comment carried the expired reason:** the catalog *"replaces the bare empty-state
that previously rendered when ZERO VENDORS satisfied the publishing gate."*
Written for an empty marketplace and never revisited once one wasn't. Nothing
caught it because it was a decision, not a bug — the page did exactly what it
was told, for a world that had moved on.

The catalog-only landing now renders only when the marketplace is **genuinely
empty**, which is the condition that comment always claimed. With shops live the
landing shows them, and the catalog is kept directly underneath, so the breadth
story survives for anyone who scrolls.

🔒 **It does not say "Trending", and that is a lock, not a style choice.**
*"Trending is earned, never sold"* (`FRONT_DOOR_CORRECTNESS_PASS_2026-08-11`);
below `TRENDING_MIN_LIVE_SHOPS` a ranking is noise wearing the clothes of merit.
The threshold is IMPORTED from `front-door-composition.ts` — the owner's number,
*"yours to move"* — so this page and the front door cannot disagree about whether
the marketplace is trending. No count is printed beside the heading: a number
there would be a second claim that rots.

🪤 **`is_published` IS NOT THE GATE, and believing it was is why the count would
have been wrong.** That column is legacy and the marketplace no longer queries
it. Measured in prod today: BOTH shops carry `public_visibility='verified'` while
one has `is_published=false` — so the legacy reading reports 1 where the grid
shows 2, and 0 where it shows 1. `LIVE_SHOP_GATE` moves out of `frontdoor/data.ts`
into `lib/live-shops.ts` so `/explore` reads the same rule instead of hand-typing
a second copy — the precise drift that file's own docblock predicted. The
front-door guard that pinned "defined exactly once here" is UPDATED, not weakened:
it now requires zero local copies AND the shared import.

`countLiveShops` returns `null` on a failed read, never 0, so a broken count
falls back to the catalog — yesterday's behaviour — instead of telling a visitor
the marketplace is empty when it is not.

Verified by sabotage: treating a failed count as empty, and hard-coding the
threshold, each fail the guard written for them. 10,676 tests pass.

SPEC IMPACT: None. No locked decision changed — this brings the landing into
line with two locks it was already subject to (merit-first / "Trending is earned"
and the live-shop gate). Vendor supply is unchanged and remains the real
constraint: two shops are live.
