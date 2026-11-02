## 2026-08-19 · fix(shop): a refused read no longer publicly demotes a supplier to "New"

The public shop page's hero carries an experience chip stating a TIER — Elite ·
Expert · Experienced · Established · **New to Setnayan** — to strangers deciding
whether to hire this supplier.

The read behind it returned `null` on error **and** `null` for a vendor with no
completed events. `experienceTier(null)` floors to 0, which is the "New to
Setnayan" tier. So a refused read publicly demoted an **Elite supplier with 200
finalised events to NEW**, on their own shop page.

🔑 NOT A MISSING NUMBER — A CLAIM ABOUT SOMEBODY'S BUSINESS. And unlike every
other instance of this disease found today, **the person harmed is not the one
reading the screen and cannot see it happen.**

⚖ SUPPRESSED, NOT GUESSED. The chip disappears when the count was not measured.
There was already precedent for its absence — the dense explore card suppresses
this very chip, as the page's own comment records — and none for inventing a
tier. Showing "Elite" would be the mirror lie.

⚠ The sibling render (the "N events through Setnayan" detail row) was ALREADY
correct and is deliberately untouched: it hides itself on a falsy count, so it
states an absence rather than a false fact. Only the chip asserted.

SPEC IMPACT: None.
