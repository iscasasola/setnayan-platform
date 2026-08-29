## 2026-08-29 · feat(papic): a 100,000-credit rung, and the seed catches up with production

Owner, with the number in the instruction: *"place an editable row like 50,000
and make the value 24000 php."*

**₱24,000 · ₱16,800 at sign-up · ₱0.24 a credit** against 50,000's ₱0.30 — a real
saving, and the ladder's "buying more never costs more per credit" rule still
holds.

⚖ **It is an ANCHOR, not a computed rung, and that is the whole point.** Computed,
it would have inherited 50,000's rate and landed at ₱30,000 — *exactly* two lots
of 50,000, so nobody could rationally choose it. That is the trap that got 40,000
removed. Only an anchor makes the rung worth buying.

🚨 **A rung lives in FIVE places and all five land here.** The catalog row and the
tier row (migration), `sku-activation.ts` (without it the rung is fully
purchasable and grants **nothing** — no throw, no log), `llms-txt.ts` (two lists),
the anchor list, and the db fixture.

### 🔴 The migration seed had drifted from production, and nobody could see it

The admin pricing screen writes **straight to the catalog**, so production has
been repriced repeatedly with no migration behind it. The seed still described
the 2026-08-26 ladder — 100 → ₱50, 50,000 → ₱11,200 — against production's ₱70
and ₱15,000.

Harmless until something new was added. `papic-rungs-are-fundable.db.test.ts`
replays MIGRATIONS and enforces that the rate never rises: ₱24,000 is ₱0.24,
correct against production's ₱0.30 and a **rise** against the stale seed's
₱0.224. The guard would have failed — correctly — on a price that is right.

So this migration un-drifts the seed rather than pricing the new rung against a
fiction.

🛑 **THE REALIGNMENT IS GUARDED BY THE OLD VALUE, and that guard is its whole
safety.** An unconditional write would be a no-op today and a **revert** tomorrow
— the screen can reprice at any moment, and a deploy landing after that would
silently restore the old numbers. Matching on the old price means only rows still
holding the drifted value are touched: true in the replay, false in production.
**Measured against prod in a rolled-back transaction: 0 rows updated.**

### Traps this hit, all caught by measuring

🪤 **`saas_overhead_cost_php` is NOT NULL with no default** and the first draft
omitted it. The replay would have accepted the row; **production refused it with
23502**. Caught by dry-running the file against prod inside a rolled-back
transaction — never by reading the `CREATE TABLE`.

🪤 **A sabotage in the anchor suite silently became a no-op.** It bumped the
10,000 anchor to ₱4,500 to force a rate inversion — which is 10,000's *real*
price once the seed was un-drifted, so the "bad anchor" was the good one and
there was no inversion to report. A sabotage that equals the truth proves
nothing. Restored at ₱6,000, which genuinely inverts while every total still
rises.

⚠ **The copy says "shots", not "credits"** — every sibling row does, and one row
using the new word would read as a different product on /pricing. That rename is
real and tracked separately; a half-done rename is worse than either state.

11,355 unit · 1,869 db · typecheck exit 0 · every blocking lint green.

SPEC IMPACT: A seventeenth Papic rung at ₱24,000. `Pricing.md § 00` and the
ladder in the corpus both stop at 50,000.
