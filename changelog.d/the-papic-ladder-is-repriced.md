## 2026-08-26 · feat(pricing): the Papic ladder becomes a scrollable list of 16 rungs

Owner 2026-08-26, given first as a table and then as the rule behind it: *"if they were to add a number of shots, and we have a scrollable amount it would be something like this if compared to 1 peso = 1 credit."*

## Two numbers on every rung, and only one of them is stored

- **Regular price** = the credits themselves. **₱1 buys 1 shot.** It is not a column and must never become one — it is `points`. A stored second copy of a rule is how prices drift.
- **Bundle price** = what the couple actually pays. This is the catalog row.
- **Discount** = `1 − bundle ÷ credits`. Derived, for the same reason.

| credits | bundle | regular | off |
|---:|---:|---:|---:|
| 100 | ₱50 | ₱100 | 50% |
| 200 | ₱100 | ₱200 | 50% |
| 300 | ₱150 | ₱300 | 50% |
| 400 | ₱200 | ₱400 | 50% |
| 500 | ₱250 | ₱500 | 50% |
| 1,000 | ₱500 | ₱1,000 | 50% |
| 2,000 | ₱1,000 | ₱2,000 | 50% |
| 3,000 | ₱1,200 | ₱3,000 | 60% |
| 4,000 | ₱1,600 | ₱4,000 | 60% |
| 5,000 | ₱2,000 | ₱5,000 | 60% |
| 6,000 | ₱2,400 | ₱6,000 | 60% |
| 7,000 | ₱2,800 | ₱7,000 | 60% |
| 10,000 | ₱3,200 | ₱10,000 | 68% |
| 20,000 | ₱5,000 | ₱20,000 | 75% |
| 30,000 | ₱7,500 | ₱30,000 | 75% |
| 50,000 | ₱10,000 | ₱50,000 | 80% |

## ⚖ One rung was flagged rather than quietly corrected, and the owner removed it

His first table had **40,000 at ₱10,000 — the same price as 50,000**, which made it a row nobody could ever rationally choose, with 10,000 free shots sitting immediately below it. It was surfaced rather than silently "fixed", because a price is his call and a silent edit to one is exactly what this project's pricing rules forbid. He removed it: *"remove the 40,000"*. **Do not re-add it without a price of its own.**

🔑 **That is the rule working in both directions.** Building his table verbatim would have shipped a dead row; editing it myself would have moved a price without him. Neither is the job — surfacing it is.

⚖ **The free 50 is untouched** — a grant, not a catalog row. **Cameras stay free and unlimited.**

⚠ **Nobody is affected by the two increases** (3,000 was ₱1,000, 10,000 was ₱3,000). Production has taken exactly **one** order in its life and it was not a Papic rung. This is a list change, not a repricing of anything anybody holds.

## 🚨 A rung on sale that nothing funds takes the money and grants zero shots

`activateOrderSku` dispatches on an exact key map and ends `if (!hook) return; // default no-op`. A row live in the catalog and in the tier table but absent from that map is fully purchasable and **silently grants nothing** — no throw, no log, an empty pool and a paid order. It came within one commit of shipping the last time this ladder grew.

So the eleven new rungs are three places each: the catalog row, the tier row, and a line in `sku-activation.ts`. `papic-rungs-are-fundable.db.test.ts` spans that gap — replayed migrations for what is **sellable**, module source for what is **funded** — and fails the build if they ever drift.

**The four rungs that leave** (13,000 · 16,000 · 23,000 · 26,000) are **deactivated, never deleted, and keep their hooks**: an order minted before today must still convert on approval.

## Details that are not cosmetic

**The seventeen prices exist once in the file**, as a temp table the inserts select from, so a reprice is one edit rather than seventeen.

**`saas_overhead_cost_php` is derived, not invented** — ₱0.024 a shot, the rate the existing 100 / 10,000 / 20,000 / 30,000 rows already carry (2.40 / 240 / 480 / 720). The 3,000 rung's ₱174 was off that curve and joins it. ⚠ Omitting the column does not default; it **fails the migration**, which is how this was found.

**The migration refuses to apply if any of it did not take.** An `UPDATE` naming a renamed code matches zero rows, commits cleanly and leaves the old price on sale — the shape this project keeps paying for. Every rung is read back and the count asserted at 17.

**A stale price in a comment** in `add-ons-catalog.ts` quoted ₱1,000/₱3,000; it now points at the catalog instead of carrying numbers.

## The couple sees the saving, and it is derived

The buy sheet already renders every sellable rung from the tier table and prices them from the catalog — **no hardcoded list**, and it is already `max-h-[85vh] overflow-y-auto`, so the seventeen rungs scroll without a layout change. **RULE 0 paid: the scrollable list the owner described already ships.**

What was missing is the half his framing is about. A rung now reads:

> **₱1,200** — adds 3,000 shots to your shared pool · **60% off ₱3,000**

⚠ **The saving is derived from `points × ₱1`, never stored**, and it is shown **only when it is real**: a rung priced at or above ₱1 a shot says nothing rather than printing "0% off" or a negative one. A rung that is not a discount is a pricing mistake, not a badge — and the guard asserts exactly that with `papicRungDiscountPercent(100, 100) === null`.

## 🛡 Guards + mutations

Two rules added beside the pinned ladder: **no rung may cost more than ₱1 a credit** (or the "discount" is a markup), and **buying more must never cost more per credit than buying less** (or the scroll rewards you for choosing the smaller number). ⚠ The second is `<=`, not `<`, and **the reason changed when 40,000 was removed** — the stale justification is corrected rather than left in place. It is not about that rung: the ladder holds a **flat rate across whole bands by design** — ₱0.50 a credit from 100 through 2,000, ₱0.40 from 3,000 through 7,000, ₱0.25 across 20,000 and 30,000. A strict `<` would fail on **eleven of the sixteen** rungs.

| sabotage | count | result |
|---|---|---|
| a sellable rung has no activation hook | 1 → 0 | 🔴 |
| a rung priced above ₱1 a credit | 1 → 0 | 🔴 |
| buying more costs more per credit | 1 → 0 | 🔴 |
| a rung silently dropped from the ladder | 1 → 0 | 🔴 (the migration refuses to apply) |

## The AI-facing price list quotes the whole ladder, rendered not typed

`/llms.txt` named four rungs. With sixteen on sale that leaves twelve live prices unquoted in the file whose entire contract is *"every active retail price is quoted somewhere"*. The ladder is now **rendered from the price book** — the codes are listed once, the prices come from the catalog — so the prose cannot drift from what is on sale. That is the failure this file already has on record: a hand-typed document matched against a hand-typed allow-list, both typed by a human, neither compared to the catalog; they drifted together and CI stayed green for three weeks.

⚠ **"₱1 a shot" had to come out of the copy** — the guard requires every quoted figure to trace back to a catalog row, and there is no ₱1 row. It reads "one peso a shot" instead. **That guard was right**: a peso figure in this file that matches nothing is exactly how an invented number gets published.

### 🪤 And the fixture disagreed with itself

It held **two rows for `PAPIC_GUEST`** — one at ₱1,200 (mine) and a leftover at ₱1,000 carrying retired *"Papic Pool"* wording. `buildPriceBook` keeps the **last**, so the 3,000 rung silently resolved to a price no rung had, and the failure read as "₱1,200 is active but never appears" — pointing at the prose rather than the fixture.

**A hand-typed second copy of the catalog can disagree with ITSELF, not only with production.** A new rule asserts the fixture names each code exactly once, before any other rule reads it. Mutation: re-introducing a duplicate goes **red**.

## 🔬 Dry-run against production, rolled back

Run inside `BEGIN … ROLLBACK` on the live database. End state on the real objects:

```
rungs 16 · catalog rows 16 · PAPIC_GUEST_40K rows 0
100=50 · 200=100 · 300=150 · 400=200 · 500=250 · 1000=500 · 2000=1000 · 3000=1200
4000=1600 · 5000=2000 · 6000=2400 · 7000=2800 · 10000=3200 · 20000=5000
30000=7500 · 50000=10000
```

Exactly the owner's table, the removed rung absent, the price list and the shot list agreeing at sixteen each. Re-queried afterwards: **production is unchanged** — still 4 rungs, no 50,000 row, 3,000 still ₱1,000 — until this merges.

**Verified:** `tsc --noEmit` exit **0** · unit suite **10,193 tests / 0 failures** · the rung guard 7/7 · llms.txt guard 13/13 · **18 lints** pass.

**SPEC IMPACT:** `Pricing.md § 00` and the ladder line in the corpus `CLAUDE.md` — applied in this change.
