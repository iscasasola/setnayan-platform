## 2026-08-23 · fix(studio): a page that asks for money says what it is

**The complaint that started this.** Owner, pressing Unlock on Setnayan AI:
*"i tried unlocking setnayan AI. this is what shows when i clicked unlock. it
does not look appealing."* What he met was no product name, no promise and no
price — straight into a small heading and near-identical grey cards, with the
figure only after scrolling past all of them.

**What a person sees now.** Each of these pages opens with the name of the
thing, the one line that says what it does for them, and — where the page sells
one thing — the price, above the fold, with the way in beside it.

🔑 **THE WORDS WERE ALREADY WRITTEN AND WERE INVISIBLE.** "Stop guessing who to
hire", "One scan, and your guest finds everything", "Setnayan-curated supplies,
delivered." — all authored, all passed to `PageMasthead`, which renders its
title `sr-only`. Nothing here is new copy. Product names and promises come from
`add-ons-catalog`, the same record every Studio row already reads, so a buy page
cannot give a couple a second account of one product.

⚖ **THE MASTHEAD IS NOT THE BUG AND IS NOT TOUCHED.** It was reduced on
2026-08-21, is owner-locked, and is CORRECT for the ~380 pages a person already
lives in. A buy page is the opposite case — nothing has been decided yet — so
those pages get a hero of their own and every other page is unchanged.

🔑 **RULE 0: PORTED, NOT DRAWN.** `_doorway.tsx` already solves this for the
eight public product pages under an owner-approved archetype. The hero
reproduces its hero: the same `--m-*` tokens through the same `DOORWAY_TONE`,
the same serif scale, the same centred column, the same order.

### 🪤 THE BRIEF SAID NINE PAGES AND THE MEASUREMENT SAYS SEVEN

Two of the nine matched a grep for "checkout" **inside prose**:

- **`indoor-blueprint`** — a RETIRED SKU. Its own docblock records that the buy
  drawer was removed and that `checkout/actions.ts` hard-rejects its orders.
  **Closed, nothing built.**
- **`supplies-marketplace`** — its cart says checkout is *"intentionally NOT
  built"* and its products are examples. It gets the **headline half only**: a
  visible name and its line, no price and no button. A priced hero on the one
  page that already knows it cannot sell would be a fake door.

And three of the seven sell **several things at once** — Papic (a shot ladder, a
Keep Full-Res subscription, an unlock-all bundle), Save the Date (the film is
FREE; only the cinematic opening is paid), Patiktok (a booth pass on a template
picker). They get the name and the promise; their figures stay beside the exact
thing each one buys, because hoisting one above the fold would say the page
costs that.

### Also on the Setnayan AI page

The value grid claimed three columns whatever it held. ⚠ **Measured, and the
shape is not what the brief said** — it is not "eight cards with an orphan"; it
is NINE caps in THREE groups of 1, 2 and 6, so the holes were in the first two
groups and the six-card group was already tidy. Fixing the brief's version would
have left both real holes exactly where they were. Each group now sizes to what
it holds.

**Guards.** `studio-buy-hero.test.ts` — 6 assertions, subject list **derived
from the tree and floored** so an empty sweep cannot pass. Four mutations,
measured before → after, all red: a selling page losing its hero · a hero and a
masthead rendering together · the hero formatting its own price · the copy
lookup returning a nameless fallback instead of throwing.

🪤 **The two-h1 guard was decoration on its first run.** It asked only for a `?`
or a `:` between the two elements, and a sabotage that made the masthead
unconditional and wrote `{true ? (` walked straight through it. It now requires
the ternary ARM BOUNDARY `) : (`, which that sabotage cannot satisfy.

🪤 **And one sabotage did not apply at all** (a shell-escaping error in the
perl) and reported GREEN. Re-run in Python, it goes red. An unmeasured mutation
proves nothing in either direction.

🪤 **`lint-page-masthead` fired on a COMMENT I wrote.** The rule reads raw
source; my note explaining that the hero carries no eyebrow named both tokens in
one paragraph, and the rule's opening pattern matched the tag inside the
sentence and swept forward to the real closing tag. The lint was not wrong about
what it saw — the comment was rewritten, not the lint.

⚠ `port-control-baseline.json` regenerated: **zero routes, destinations or
actions lost**; the diff is `PageMasthead` → `StudioBuyHero` on the four pages
where the hero replaced it, and `StudioBuyHero` added beside it elsewhere.

⏭ **For the owner:** the supplies page is called **Paprint** in the catalog and
"Setnayan Supplies" in its own tab title. The catalog is the name a couple meets
everywhere else, so that is what the page now shows — flagged rather than
reconciled, because renaming a product is his call.

SPEC IMPACT: None.
