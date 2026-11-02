## 2026-09-23 · feat(admin): changing what a customer pays takes two admins

Vendor Agreement § 9.1: *"Mid-quarter price change on any in-app SKU | Pricing governance."*
`platform_retail_catalog_v2` is admin-managed and is **the only price a customer is charged**.
One admin could change it alone.

### ⛔ Why this gates EVERY price change, not only mid-quarter ones

The clause turns on "mid-quarter", and **the corpus never bounds the quarterly review window.**
"At the start of each calendar quarter" has no duration. § 3.8, § 9, § 9.1 and the 0034 cart
fixture all use the term; none defines it.

Picking one would decide whether a given money change needs two admins — owner ruling
2026-08-31: **"don't guess."** So this is stricter than the clause and never looser, which
cannot breach it: § 9.1 requires two admins mid-quarter and is silent on quarterly changes, so
requiring two for both is a self-imposed control that takes nothing from a vendor. § 9.1 agrees
with the direction — these happen *"once a week or less, where the two-admin friction is a
feature not a bug."*

⚖ Narrowing it is **one line** in `priceChangeNeedsTwoAdmins`, once the owner says where the
review window ends.

✅ Verified before shipping: production has **2 admins**, so `decided_by <> initiated_by` is
satisfiable. With one, every gate in this family would make its operation impossible rather than
careful.

### 🔑 Not every field on the form is a price

Gated: `retail_price_php`, `onboarding_price_php`, `billing_period`, `is_pax_priced`,
`pax_floor_price_php`, `pax_increment_price_php`. ⚠ The last two model fields hold **no peso
figure** — flipping one-time→monthly or flat→per-head changes the bill without editing a number,
and a gate watching only amounts would miss both.

Not gated, deliberately: the title, the customer-facing blurb, `is_active`, and
`saas_overhead_cost_php` — that is OUR margin, not anyone's bill. The gated branch strips **only**
the price fields and saves the copy immediately, so an admin fixing a typo is neither blocked by
a pending price change nor has that edit silently discarded.

### ⚠ A SECOND DOOR EXISTS AND IS NOT GATED — stated, not hidden

`app/admin/pricing/price-control-actions.ts` also writes `retail_price_php` and
`onboarding_price_php`, from `savePapicLadder` and `saveFamilyDiscount`. They recompute **many
rows from one derivation**, so they need a multi-row payload rather than the single-SKU one the
executor takes today.

It is named in the guard's expected-writer list **with a reason** rather than excluded by a
heuristic, so the gap is bounded and a **third** writer fails the build. This is the third time
today the same shape has appeared — the comp gate, the receiving-account gate (where a QR image
turned out to be a destination), and now this. **The obvious action is never the only writer.**

### Two guard bugs that sabotage caught, both of which would have shipped green

1. 🪤 **A spread names no column.** The first scan required `.update(` *and* a named price column
   in the same window. It reported ONE writer — the bulk surface — and **missed `saveRetailRow`,
   the very function this PR gates**, because that writes `.update({ ...nextRow })`. A guard that
   cannot see the code it was written for is the most expensive kind of green. The net is now
   every write to the table.
2. 🪤 **A dead branch still contains its own source.** Mutating `if (changed.length > 0)` to
   `if (false)` left the approval insert, the copy-strip and the rule call all in the file, and
   the guard stayed GREEN. It now pins the **condition**, not the text.

Three sabotages, three catches after the fixes: a spread-written third door (writers 2 → 3,
named), the constant-false gate, and the executor dropping its column allowlist.

Also fixed while in the file: `saveRetailRow`'s existing `admin_audit_log` insert discarded its
error. Supabase **resolves** with `{ error }` rather than throwing, so that was silent.

SPEC IMPACT: None — the contract is unchanged; this conforms to it.
