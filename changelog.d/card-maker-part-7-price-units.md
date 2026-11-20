## 2026-11-19 · feat(card-maker): Per unit · Custom · Max — part 7

The maker's "How the price works" dropdown gains the drawing's last two ways to charge (HYBRID map 17 Nov):
**Per unit** and **Custom** ("Name your own"). Each has a Base price (shown as "from"), Initial units / Initial
number, Each extra (fills in as base ÷ initial number when left blank) and Max (empty = No limit). Custom adds
**Charge per**, and the typed word carries into "Each extra chair" and the card ("₱3,500 for 10 chairs ·
+₱350/chair"). Per guest and Per hour gain **Max guests** / **Max hours**. Max must be more than the starting number;
nothing can be negative — checked on screen, in the save, and by the database.

- Migration `20271352223098`: `pricing_basis` allows `per_unit`; new `vendor_services.unit_word`, `unit_base_php`,
  `initial_units`, `extra_unit_php`, `price_max` with their CHECKs. `save_vendor_service` and
  `copy_vendor_service_to_branch` are redefined from their latest bodies to carry the five (a CHECK runs per
  statement, so they must be written with `pricing_basis`).
- One words module, `lib/per-unit-price.ts`, for the maker preview, the saved snapshot and the couple's card.
- The couple's own self-added price record keeps its three bases (Per unit is a supplier card's).
- Not changed: no Setnayan price is set or read; `starting_price_php` stays the synced "from" anchor, so Explore,
  budget and quotes read a per-unit card as its base price. Max is stored and checked, not shown to couples and not
  enforced in the quote (owner questions in the PR).

SPEC IMPACT: None — builds the approved HYBRID map rows (Price: Per unit · Custom · Max) as drawn; no ruling changed.

**Review fix (20 Nov) — no silent undo:** `copy_vendor_service_to_branch` in `20271352223098` is now the UNION of every
earlier definition — #8012's (`availability_style`, `order_lead_days`, `usual_prep_days`, the 1..500 schedule cap,
carried since #8011) plus part 2's description, video link and pay plan, plus part 7's five price columns. As first
drafted (from `20271351531329`) it dropped the three Availability columns and put the copy's schedule cap back to 50,
which would have undone #8011 (live) and #8012 on merge. DB test: a branch copy keeps all three and a schedule of 300.
#8012 merged in (merge commit); the card maker's "How clients book" group (HYBRID layout) carries #8011's Availability
block, the Made to order rows and the style-aware day count; main's 701 px `tab:` breakpoint wins.

**Folded in from the #8012 re-review (20 Nov, non-blocking):** the supplier-yes comment in `vendorAgreeToLock` now says the supplier gives the number (owner Q2: no couple picker), and `singularOf` reads "buses" as "bus" (not "buse") while "vases" stays "vase".
