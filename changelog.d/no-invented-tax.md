## 2026-08-20 · fix(money): ₱499 is ₱499 — four screens stop naming a 12% tax the platform does not charge

**Owner ruling, 2026-08-20:** *"just stay with 499. remove the 12% let's keep it
simple and effective for everybody."*

Setnayan is **not VAT-registered** (sole proprietorship, 8% flat; VAT only at the
₱3M tripwire) and the configured rate is **0**. Four separate surfaces said
otherwise — and were found one at a time, over two days, only because a person
happened to open each screen.

| surface | what it said |
|---|---|
| the receipt | recorded a 12% rate it was never charged at *(fixed earlier, #4614)* |
| **admin quote screen** | `total × 1.12` — *"₱499 · buyer pays ₱559 incl. 12% VAT"*, and an input labelled *"Buyer pays base × 1.12 incl. VAT"* |
| **customer checkout** | a fixed *"incl. 12% VAT"* printed under a price that was already correct |
| **supplies cart** | *"Final price + 12% VAT are confirmed by the Setnayan team…"* |

🔑 **THE PATTERN, AND IT IS THE WHOLE POINT: in every single case the arithmetic
was already right and the WORDS were wrong.** The rate had been correctly moved
into settings long ago; what was left behind was a hardcoded sentence sitting next
to a correct number. **Fixing the calculator does not fix the label.**

⚖ **The money was never wrong on the admin screen either — only the screen.**
Everything that decides what is actually owed already reads the configured rate.
But the operator types the *"Note to couple"* from that card, so a figure ₱60 too
high was one copy-paste from being quoted to a real customer and chased for.

⚖ **DERIVED, NOT DELETED.** Every surface now takes the rate from settings and
says nothing while it is 0. The day the ₱3M threshold is crossed the owner sets
**one number** and every line returns by itself, with the right figure. Nothing
here hardcodes a zero.

Also corrected: the shortfall notice quoted an amount and described a 12% VAT as
being *inside* it, and two comments still described the gross as "base + 12% VAT".

Guard — `lib/no-invented-tax.test.ts` **sweeps every money surface** rather than
asserting on the four known files, because each of these was found by accident and
the next one would be too. It bans the literal (`12% VAT`, `× 1.12`) and never the
concept, asserts it scanned more than 50 files so a route move cannot turn it
green, and strips comments first — every file fixed here explains the string it
removed, and a raw scan would report the defect it just fixed forever.
⚠ Bare `1.12` is deliberately **not** banned: it is a common line-height and a 3D
coordinate in this repo, and a guard that cries wolf is one nobody reads.

Mutations, each confirmed to have LANDED by occurrence count, all red: the admin
screen multiplying by 1.12 again (1→2) · the checkout hardcoding its label (1→2) ·
the supplies cart promising +12% (1→2) · the admin page no longer reading the
configured rate (8→0). Baseline green, tree clean.

Full suite 8957 passing, typecheck exit 0, lint clean.

SPEC IMPACT: Applied — `DECISION_LOG.md` 2026-08-20 records the ruling that the
quoted price is what the buyer pays, with no VAT shown or added anywhere.
