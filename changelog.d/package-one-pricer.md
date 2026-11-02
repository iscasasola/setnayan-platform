## 2026-07-26 · fix(packages): one pricer for the package total — the two write sites had diverged

Found while starting §6.4 (package booking-fee base), and it had to be fixed
first: the fee base **is** `event_vendor_packages.total_locked_centavos`, and
that number could silently drop.

### The bug

`total_locked_centavos` is written in two places, and each computed it
independently:

| Site | Priced with | Sees choices? |
|---|---|---|
| `lockPackage` (after §6.2) | credit engine / surcharge-aware | ✅ |
| `removeItemFromPackage` | `computeCustomization` alone | ❌ |

`removeItemFromPackage` also **fetched no options at all**, so every choice line
read to it as a plain line.

Net effect: lock a package carrying a paid upgrade, then remove any unrelated
line, and the stored total silently loses the upgrade — while
`chosen_option_ids` still records the couple's pick. The vendor delivers the
upgrade against a total that no longer contains it, and once §6.4 lands, the
booking fee shrinks with it.

### The fix

One pricer, `priceCustomizedPackage`, called by **both** sites. It takes the
flag as an argument rather than reading it, so it stays pure and both flag
states are assertable. It returns `null` when the credit engine refuses —
callers surface that, never substitute a number. `removeItemFromPackage` now
fetches options like the lock path does.

### What the tests pin

- an upgrade with **no pool** to absorb it is charged, under **either** flag —
  nothing makes a picked upgrade free
- the remove path genuinely **sees choices** (the actual regression)
- under credit, freed credit **absorbs** an upgrade instead of raising the
  total — this is the owner rule, not a bug, and is pinned so it can't later be
  "fixed" into double-charging. The upgrade must still be **deducted from the
  pool**, so *absorbed* can never quietly become *free*.

⚠ Two of these tests were written wrong first and caught it: they asserted an
upgrade must always raise the total, which contradicts "credit offsets
upgrades; the couple pays the difference only if they overspend". **No
production code was changed to make them pass** — the fixtures were corrected
to isolate what they meant.

**Falsifiable:** reverting the shared pricer turns 3 red. 4005 unit + 308 DB
green, `tsc --noEmit` exit=0, `next lint` exit=0. No migration.

SPEC IMPACT: prerequisite for `HANDOFF_Package_Wave_2026-07-26.md` §6.4 — the
fee base is now computed in exactly one place. §6.4 itself (the package-aware
fee entry point) still needs a new RPC: `booking_fee_open_lock_charge` derives
its base from a single `event_vendors.total_cost_php`, and the cascade splits a
package across N rows, each of which would carry its own ₱50 floor.
