## 2026-08-29 · feat(vendor): "no limit" covers the waiting list too — one axis, both ceilings

**SPEC IMPACT:** `apps/web/VENDOR_TIERS_AND_BENEFITS.md` §11 rate-card row updated in this PR ·
`DECISION_LOG.md` row 2026-08-29.

**Owner 2026-08-29, verbatim:** **"yes wait list add them"**.

The ₱2,500 "no limit" axis shipped hours earlier (`20271182153977`) covering ONE of the two per-date
ceilings — customers a shop may be **chasing**. The **booked-out waitlist** was deliberately left out
and the owner was told so in those words, as a separate list needing its own ruling rather than
assumed into the same purchase. He made the ruling. **One axis now removes both.**

### What changed

- `vendorEffectiveCaps` lifts `waitlistAcceptances` as well as `whitelistPerDate`.
- 🔑 **The calendar surface and both calendar actions now read the EFFECTIVE cap, not the
  tier-only one.** `vendorWaitlistAcceptances(tier)` answers from the tier alone, which is right for
  every plan except the one that can BUY the ceiling away. `fetchEffectiveCaps` is the shipped
  overlay and reads the shop's own active composed plan **through their own session** — a vendor may
  read their own `vendor_custom_plans` row, so no service-role client and no new RPC. *This is what
  those three call sites should have used all along.*
- `pickWaitlistCouple` — **the actual enforcement** — stops counting for such a shop. The setting is
  only a number until this refuses on it; without this the axis would be sold, quoted, stored,
  displayed and inert.
- `clamp_vendor_waitlist_to_tier` no longer clamps it.
- The settings picker becomes a sentence (*"as many as are waiting — no limit on your plan"*) and the
  pick button drops its denominator. ⚠ Not cosmetic: `Array.from({ length: Infinity })` **throws a
  RangeError**, so the unlimited branch has to come before the option list, and `"3/10"` on a shop
  that paid to remove the 10 is the product arguing with itself.

### ⛔ Two things deliberately NOT done

- **`vendor_profiles_max_waitlist_0_10` is not widened.** Under "no limit" the stored number stops
  being a ceiling at all — the enforcement skips it — so raising the CHECK to 999 would change
  nothing except leave a bigger number in a column that nothing enforces. **A ceiling nobody
  enforces is worse than no ceiling: it reads as a promise.** The column keeps its meaning: *the
  number this shop chose, while it has a ceiling to choose within.*
- **The axis raises a ceiling; it never conjures a waiting list onto a plan that has none.** The
  zero-allowance arm is checked BEFORE the no-limit arm. Custom's base is 5 so this is belt and
  braces today — which is precisely when an ordering gets written down wrong, so a test pins it and
  **reordering the two arms turns that test red.**

### Verification

`tsc --noEmit` exit **0**, 0 errors · `test:unit` **11,418 pass · 0 fail** · `test:db:ci` · all **30**
CI guard scripts.
**Two mutations, occurrence-counted, both RED:** remove the clamp's question (1 → 0) · move the
no-limit arm above the zero-allowance arm (the ordering claim is not decoration).
Both new db tests ship with **controls** — a Custom shop *without* the axis is still clamped to 5 —
because an outcome that was never going to be refused proves nothing.

⚠ **Two assertions were INVERTED hours after being written, by an owner ruling, and kept rather than
deleted** — they read *"THE WAITLIST IS NOT LIFTED"* and *"the axis NEVER lifts the booked-out
waitlist"*, which was the correct and deliberate scope at the time. They are still what proves the
scope is what the owner said; now in the other direction.

⚠ The clamp body was copied from the **live object** (`pg_get_functiondef`), never from the migration
that last touched it.
