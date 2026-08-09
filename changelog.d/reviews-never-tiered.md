## 2026-08-09 · fix(reviews): a vendor can no longer buy a better reputation

Owner ruling, re-confirmed today in answer to a direct question: **reviews are
never ranked, hidden or unlocked by what a vendor pays.** The code did the
opposite.

### What was actually shipping

`tierCaps` carried two flags that gated reviews by tier:

| tier | star average + count | written reviews |
|---|---|---|
| Free | ❌ hidden | ❌ hidden |
| Verified | ✅ | ❌ hidden |
| Solo | ✅ | ❌ hidden |
| Pro / Enterprise / Custom | ✅ | ✅ |

In practice, for a Free vendor:

- their **own public shop page** told couples *"Reviews unlock when this vendor
  upgrades their Setnayan plan"*
- their **marketplace card** zeroed its rating and review count and rendered as
  **new**, however many real five-star reviews it had
- the **Explore sort** for "highest rated" and "most reviews" scored them at
  zero, so a shop with genuine reviews sank below a paying one with none
- the **public tier comparison table** advertised *"Full written reviews shown"*
  as a paid perk

That is a paid shop's reputation looking better than an unpaid one's for money
rather than merit — the exact thing the merit-first ranking lock exists to
prevent.

### Fixed

Both caps are `true` on every tier. The upgrade-to-unlock panel is **deleted,
not left unreachable** — an unreachable branch carrying a false promise is one
refactor away from being reachable again. The tier-table row is gone rather than
turned into a column of identical ticks. Explore's `gatedRatingOf` /
`gatedReviewCount` helpers are renamed, because a value that is no longer gated
must not keep reading as one.

The flags themselves are **kept, not deleted** — the render sites still read
them, so the guard has something to pin.

### 🔑 Settled while it was still free to settle

Production held **0 reviews and 2 vendors** when this landed (checked against
prod, 2026-08-09). Not one couple ever saw a hidden review. After the first real
review this would have been a migration and an apology.

### Guard — mutation-tested

`apps/web/lib/reviews-are-never-tiered.test.ts`:

| sabotage | result |
|---|---|
| re-gate the free tier | ❌ test 1 fails |
| restore the "reviews unlock" copy | ❌ test 2 fails |
| restore the tier-matrix row | ❌ test 3 fails |
| baseline | ✅ 3/3 |

It checks the flags for **every** tier including `null` (the pre-migration case),
asserts no surface carries the unlock copy, and asserts the tier table does not
read a review cap at all. The copy check strips comments first, so this change's
own history can be written down without satisfying its own guard.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-09 recording the ruling and the three
other decisions answered in the same sitting.
