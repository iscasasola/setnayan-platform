## 2026-08-29 · fix(admin): the price list clusters by what a thing is, and a switched-off price can finally be removed

Owner 2026-08-29, looking at the shipped list: *"why are there still so many old
prices"* → *"i think it would be better to fix the clustering of the prices since
there are only a few and we can organize them neatly."* Then: *"papic credits not
shots"* and *"assign a cell to indicate how many free Papic Credits per event
everybody has."*

### Nothing was old. It was interleaved.

Measured, not assumed: 44 on-sale prices, sorted by **price ascending**, and
**17 of the 26 customer rows are ONE product** — the Papic credit ladder, in 17
sizes. Sorted by price those 17 thread straight through the owner's **nine**
actual products, so nine things read as twenty-six.

The ladder also has its **own tab**, where it is edited as a ladder with its
anchors and discount curve — so repeating all 17 rungs in the main list added no
capability and buried everything else. It is now ONE line that opens; every rung
is still there, still searchable, still a full card with every control.

### 🔴 "Remove for good" has never been offerable on any row, ever

`viewOf` filed a row as *retired* only when it carried a `retired_at` stamp.
**Measured against production: not one row in either catalog has ever been
stamped.** So:

- the **Retired** tab could never show anything but 0;
- all 20 switched-off prices fell into **Drafts**, reading as work in progress;
- `HeldByPanel` — what is still holding a price in place — **never rendered**;
- `canOfferRemove` was **false for every row, always**.

The removability machinery was correct, computed, and unreachable. That is why
the 35 deletions on 2026-08-28 had to go by migration: the button on this screen
could not appear. 🔑 *A control gated on a state nothing produces is a gate with
no handle* — and this one guarded the very act the owner had asked for.

Draft and Retired merge into one **Switched off** shelf. Off is off; the reason,
where there is one, lives on the row's card.

### The free allowance has a cell, and it is read, not typed

`papic_event_pool_config.free_grant_points` is **50**, and five production events
carry a `free_grant` of exactly that — yet **nothing under `app/` read or wrote
that column**, so no screen could show it and only a migration could move it.
Same shape as the Setnayan AI band prices found this morning. The cell reads the
live value and says *"couldn't be read"* rather than printing a confident 50 the
product might not be giving away. It is drawn as **given, never sold** — filing it
among the products would make it look buyable.

### Guards

`pricing-clusters.ts` is pure and separately tested. The load-bearing one:
**every cluster the classifier can return must be in the render order** — the list
maps over that order, so a shelf it omits makes those rows *silently vanish while
still on sale*. Also pinned: an empty ladder summarises to `null`, never to
`₱Infinity – ₱-Infinity` (`Math.min()` of nothing is Infinity, `String(Infinity)`
is valid, nothing throws — that exact shape once reached the public on /vendors).

⚠ Grouping keys on the **service code, never the title** — a title is edited from
this very screen, so keying on it would let a rename move a product to another
shelf, or out of every shelf.

### Verification

`tsc` exit 0 · `test:unit` **11,425 pass / 0 fail** · `lint-port-no-lost-controls`
**410 routes / 1,495 controls / 4,138 blocks — nothing lost**, which is the check
that matters for a fold. **4 mutations, each landed by measured occurrence count,
all red.**

⏭ NOT in this change, named rather than buried: the free-credits cell **shows**
the number; giving it a save is its own change — the column has a home and still
no door.

✅ The **credits rename** landed separately while this was building
([#5000](https://github.com/iscasasola/setnayan-platform/pull/5000), merged) — it
touched a different set of files, so this port reverts none of it. Re-check the
catalog titles before assuming either way; this file is a claim with an expiry
date and that one is a day old.

SPEC IMPACT: None — no price moves and no product changes. Add a `DECISION_LOG.md`
row for 2026-08-29 recording the credits vocabulary ruling.
