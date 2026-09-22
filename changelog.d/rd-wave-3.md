## 2026-09-22 · chore(wave): redesign wave 3 — four builds, one merge

| build | what it fixes |
|---|---|
| the gift is named at the decision | a supplier switched the Setnayan gift ON, saw the photo count on their own screen, and the couple opening that SENT quote saw nothing until after they accepted |
| the money split refuses to guess | `(c ?? 0)` made an unrecorded supplier price silently ₱0. Prod event `044f7e64` printed "LOCKED ₱0" and "₱2,250,000 to spare" beside "₱26,499 paid" |
| Setnayan AI copy + the progress rail | published copy promised "₱499 first 28 days → ₱799 per 28 days" while the catalogue charges ₱2,499 one-time and the renewal SKU is INACTIVE; plus a stage that printed its percentage twice and a 0% ring that read as failure |
| the small sign-up card | 11 posted fields down to 8 + Terms, each departing field to a named home, and a contract test that refuses their return |

**11 commits · 40 files · 0 migrations.** No two of the four share a single non-changelog file —
all six pairs checked in python, after a zsh string comparison silently returned a false
"no overlaps" earlier the same day.

### Generated files regenerated on the merged tree

`port-control-baseline.json` was the only one that drifted; `exposure`, `dup-rule` and
`money-formatter` already matched. The exposure generator finished in **10 s** where another
session measured ~2 min over 1,482 migrations, so its silence was **probed rather than trusted**:
a sabotage line appended, the generator re-run, the line gone and the sha restored.

### The money copy derives, it does not quote

The Setnayan AI price is resolved from the catalogue with **no literal anywhere**, including in the
tests. The four assertions that pinned ₱499/₱799 now assert the **relationship** — hard-coding
today's *correct* ₱2,499 still fails them.

⚖ Whether a ₱499/₱799 subscription is still intended is on the owner's desk. If it is, that is a
catalogue change and the derived copy will start saying it with no code change at all.

SPEC IMPACT: None.
