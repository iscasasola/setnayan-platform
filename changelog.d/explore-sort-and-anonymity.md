## 2026-08-08 · design(#4): sorting you can see, and why a shop has no name

Two additions to the public marketplace. **Neither adds a query, and neither
changes how vendors are ranked.**

### 1 · The sort comes out of the drawer (E3)

Most reviews · Highest rated · Newest are now visible buttons above the results.
The sort itself already shipped — as a `<select>` buried in the filter drawer,
which is where nobody looked.

🔑 **A SECOND DOOR, NOT A SECOND MECHANISM.** Each chip is the page's own
`buildHref(filters, { sort, page: 1 })`, so every other filter in the URL is
preserved and `?sort=` round-trips exactly as it did. The drawer keeps its
`<select>`. Nothing about ranking changes — this only chooses which of the
existing orders applies.

`name_asc` deliberately gets **no chip**: it is a lookup order, not a way of
judging vendors, and putting it beside the other three would imply alphabetical
is a kind of ranking. It stays in the drawer.

Resetting to page 1 is required — keeping `?page=7` while re-sorting lands a
couple in the middle of a list they have never seen. The row hides when the grid
is empty, so it can never sit above "no vendors found" offering to re-order
nothing.

### 2 · Why a new shop has no name yet (E10)

A card whose business name is withheld now says so:

> New shops stay unnamed until they reply to their first couple.

🔑 **THE CONDITION IS THE EXACT INVERSE OF THE LINE ABOVE IT.** The card already
decides whether to render "*Service* by *Business*" by testing whether the
resolved label equals the real name; this line reuses that same expression rather
than deriving anonymity a second way. **A second, independently-derived signal
could disagree with the name actually on screen** — the same failure the vendor
date-availability chip was cancelled for earlier today.

### 🪤 Without one extra flag, this line was a lie on every card

The anonymity fields come from one batched read. **When it fails, the page hands
every row `name_revealed_at: null` — which is exactly what a genuinely hidden
name looks like.** Every card on the public marketplace would then have explained
why its name was hidden, on vendors hiding nothing.

Rows now carry `anonymity_resolved`, set only when that read genuinely answered.
A failed read shows **less**, never something untrue. Same disease as
`count === null` meaning "not measured": *absent* and *zero* must not render
alike.

### Verification

- **7,098 unit tests** pass · **853 database tests** pass · 21 lint guards green
- `tsc` clean · contrast guard clean · port guard: nothing lost

⚠ The database suite was run locally for the first time this session — it had
only ever run in CI, which is why an unrelated infrastructure crash there
surfaced at a merge gate rather than on my machine.

SPEC IMPACT: None — implements the Public + Marketplace spec E3 and E10.
