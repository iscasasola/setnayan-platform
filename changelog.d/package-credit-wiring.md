## 2026-07-26 · feat(packages): wire the credit engine into the lock path (flag-dark)

Closes §6.2. `computePackageCredit` had **zero production callers** — a written,
tested, 750-line engine that nothing ran. It is now the single authority for
every number on a package booking when `NEXT_PUBLIC_PACKAGE_CREDIT` is on.

### Why flipping the flag is safe — the parity property

With the DB-default `'expiring'` policy and no upgrades, the engine reproduces
the shipped `computeCustomization` **to the centavo**. That is asserted **by
exhaustion** — all 16 subsets of four lines (one required, one add-on, two
ordinary), in both the flexible and non-flexible package shapes, comparing
booking total, remaining pool and removed total on every one.

So on a plain package, turning the flag on is a **no-op by construction**, not
by inspection. An upgrade is the only thing that can move the total.

### Fails closed, but forgives exactly what it used to

The engine refuses a removal naming a required or never-included line; the
shipped path silently ignores it. Passing the raw list through would have turned
a **stale page** — a vendor marking a line required after the modal loaded —
into a hard failure on a money action.

`allowedRemovals` narrows the list first. Dropping a removal is conservative in
the direction that matters: the line stays in the booking and its value never
enters the pool, so it can only ever hand out **less** credit, never more. The
engine's fail-closed guarantee exists to stop credit being *inflated*; this
cannot inflate it. Everything else it refuses is surfaced, never papered over
with a fallback number — being charged by one model while shown another is worse
than an error.

### 🐛 Fixed a defect in yesterday's choice UI

The engine **refuses to auto-apply the default on a REQUIRED choice line**
(owner rule, `package-credit.ts:571-576`: *"must pick a main course" is a
decision the couple has to make, and pretending otherwise hides it from them*).
The modal shipped in #3744 preselected the standard option on **every** choice
line while holding no actual selection — so with the credit flag on, a required
choice line would have displayed a pick and then been rejected server-side.

Required choice lines now start genuinely unselected, the legend reads **Pick
one to continue**, and the lock button blocks until every one is answered. A new
`choice_required` result is the stale-client backstop, and an anti-drift test
asserts the UI gate and the engine agree about which lines are unresolved.

### Also

- `unspent_credit_policy` is now SELECTed — without it the engine returned
  `invalid_package` on **every** call, so this was a hard prerequisite.
- Package and package-item select lists are centralised into
  `VENDOR_PACKAGE_SELECT` / `VENDOR_PACKAGE_ITEM_SELECT`, the same treatment
  `PACKAGE_ITEM_OPTION_SELECT` got — these were copy-pasted across four sites,
  and the last time a name in such a list was wrong, every copy was wrong
  together and every test stayed green.

### Two stale warnings in the engine, now checked rather than trusted

- Its `keptItemIds` comment warns of a divergence from `keptItems()` and says
  the lock wave "MUST pick one". **Stale** — #3730 already made `keptItems()`
  exclude `is_default_included = FALSE`. The two agree; nothing to pick.
- The `'refundable'` semantics remain **owner-blocked and unreachable**:
  verified that **nothing writes the column**, so every package is `'expiring'`.
  The adapter defaults unknown/missing values to `'expiring'` and a test pins
  that, so the unresolved semantic cannot be reached by omission.

**Tests:** 20 new (3952 total). Falsifiable — defaulting the policy to
`refundable` turns 5 red; removing removal-sanitisation turns 5 red.
`tsc --noEmit` exit=0, `next lint` exit=0.

⚠ **Still unverified end-to-end:** prod holds 0 packages, so none of this has
run against a real one. The math is covered; the flows are not.

SPEC IMPACT: `HANDOFF_Package_Wave_2026-07-26.md` §6.2 done. Catalogue
`additions` are deliberately **not** wired — there is no schema and no picker
(§6.9). §6.3 (free-5 → bookings) and §6.4 (package fee base) remain next; note
§6.4 now has its number, since `total_locked_centavos` is the agreed total.
