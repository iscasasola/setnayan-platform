## 2026-08-28 · fix(papic): a plus/minus for credits, and the sheet stops disagreeing with the navigation

**Two things the owner hit on the live Papic page.**

### The ladder is a stepper, not a dropdown

Owner: *"we want a +- value and they will see how much will be added. from 50 pesos
to 10,000 pesos?"* — and his range was exactly right: the sixteen live rungs run
**₱50 to ₱10,000**, measured in the catalog, not read off a doc.

🔑 **IT WALKS THE REAL RUNGS RATHER THAN TAKING A FREE PESO AMOUNT.** Each rung
carries its own discount and the set is owner-locked; a free "type any amount"
box would have to invent a price for ₱137, which is a pricing decision, not a
control. Every press lands on something the catalog actually sells, and both
halves of the trade are on screen at once — what you pay, and what lands.

⚠ **NOT ONE FIGURE IS TYPED IN THE CONTROL.** Prices, credit counts and the
saving all arrive as props read from `platform_retail_catalog_v2`. That is
load-bearing right now: the top rung is ₱10,000 today and the owner's own price
sheet moving it to ₱11,200 is **in flight in a separate open PR**. A number
spelled in this file would quietly outrank him within the week.
⚠ **The hidden field stays the SERVICE CODE, never an amount** — the server
charges off the code and re-reads the price, so a tampered client can change
which rung it asks for but never what a rung costs.
⚠ **Sorted by price at the call site**, because the catalog guarantees no order
and a ladder whose `+` goes down is worse than the dropdown it replaced.

### 🚨 The sheet and the navigation disagreed about what a phone is

`sheet.tsx` docked as a right-side desktop drawer from **`sm:` (640px)**.
`nav/bottom-nav.tsx` is **`lg:hidden`** — the floating phone bar is on screen to
**1023px**.

**So between 640 and 1023 the app rendered its phone chrome and its desktop
drawer at the same time:** a floating bottom pill underneath a half-width panel
pinned to the right edge, page blurred behind. That band is every tablet, a large
phone in landscape, a foldable, and any browser window that is not maximised. The
owner opened the Papic uploader there and said the screen looked unfinished. **He
was right, and it was not a styling slip — it was two components answering one
question with two different numbers.**

Fixed by moving the dock to the line the navigation already draws. Affects all
**7** Sheet consumers, and that is the point: one app, one answer.

⚠ **The four Papic "ways in" sheets now pass `wide`.** Behind those rows sit the
QR buttons plus the off-list camera ladder, the whole guest-camera tier card with
its two quotes, and an upload dropzone. At 22rem each wraps a control per line —
which is the `wide` prop's own stated reason for existing.

🛡 **New guard `sheet-agrees-with-the-nav.test.ts` asserts AGREEMENT, not a
value** — it reads the breakpoint out of the sheet AND the bottom nav and fails
when they differ. A guard pinning the literal `lg` would have to be edited by the
person doing the very thing it exists to catch. It also fails if any single
desktop rule (height, corners, shadow, either width) is left stranded at another
breakpoint — half-transformed reads as broken rather than as a choice.

🪤 **AN EXISTING GUARD WENT RED AND IT WAS RIGHT TO.** `live-studio-wave8-layout`
pinned the literal `wide ? 'sm:w-[min(34rem,92vw)]' : 'sm:w-[22rem]'`. Its subject
is that **`wide` is additive** — the `sm:` was incidental. It now asserts the
ternary exists, defaults false, and that **both halves flip at the SAME
breakpoint**, and the breakpoint itself is pinned harder than a literal by the new
guard. **Re-verified by sabotage that it still catches a stranded width** — this
is not a guard weakened to go green.

🪤 **`npx tsx --test <a full path containing [eventId]>` printed `# tests 0` and
exited 0** — a false green. Escape as `[[]eventId[]]` and always read the counts.

⚠ **DELIBERATELY NOT DONE HERE:** the card still says **"shots"** where the
approved drawing says **"credits"**. That word lives in a shared copy module used
by five surfaces and pinned by a copy-guard test, and **two pricing PRs are open
right now** — a wording sweep would land exactly where they conflict. Flagged as
its own small job rather than ridden along.

**Verification:** typecheck exit 0 · `test:unit` 10,587 pass / 0 fail · lint exit 0 ·
Papic guards 58 pass · **5 mutations, each measured before → after, all 5 RED**
(dock back to `sm:` · strand one width · type the floor price · post an amount
instead of the code · drop the price sort), plus a 6th proving the repaired
wave-8 guard still bites.

SPEC IMPACT: None — no price, SKU or rule moved. The ladder is the same sixteen
rungs behind a different control.
