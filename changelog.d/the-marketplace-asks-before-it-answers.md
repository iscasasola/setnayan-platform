## 2026-09-08 · feat(explore): the marketplace asks a question instead of shouting answers

Owner, on `/explore`: *"if they want to search a category or per ocassion. they
can pick from a drop down. but we don't need to show as many buttons up front. we
want it simple and clean and easy to search. not bombarded with a lot of
choices."*

The landing opened with **four service chips over sixteen occasion chips**, a
"Browse all 192 categories" link and a sort row — twenty-odd targets before the
visitor had said anything. Both chip rows become two native `<select>`s in the
same GET form: *Any category* · *Any occasion* · Show.

### What survives, deliberately

Both filters stay reachable, and one of them had to. The occasion row's own note
recorded that `?event_type=` had shipped since **Iteration 0041** with *nothing
on any public surface able to set it* — the filter drawer does not render on this
landing. Deleting the row outright would have re-orphaned a filter that took a
deliberate act to give a home.

🔑 **Simplifying a screen is not the same as removing what it can do.** Every
`?category=` / `?event_type=` deep link still resolves; the params are unchanged.
Fewer targets, same reach.

They stay **two** controls, not one merged list: services and occasions answer
different questions, and one list would read as though "Debut" and "Florists"
were alternatives.

Native `<select>` on purpose — submits without JavaScript, keyboard- and
screen-reader-native, and on a phone it opens the platform picker rather than a
twenty-target tap area.

### An implementation note

`chipParam()` reads the value back out of the chip's own href rather than adding
a field to `ExploreChip`. One parser cannot disagree with itself; a second field
would have to be kept in step by every caller that builds a chip.

Mutation-tested four ways — orphan the occasion filter, remove the "Any" option,
bring the chip wall back, merge the two controls into one — each turns it red.

⏭ **NOT in this change:** the body still lists VENDOR cards, one per shop, which
is why searching `HOST MC` returns *"Live Band by Saysay… ₱35,000"* and the
₱40,000 Host Mc price appears nowhere on the page. Owner's model is that the
marketplace shows SERVICE cards and the **bench** is the per-category surface.
That is the next step and it is a much larger one.

SPEC IMPACT: None — same query params, same filters.
