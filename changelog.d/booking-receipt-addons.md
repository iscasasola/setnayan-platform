## 2026-07-27 · fix(packages): the booking receipt no longer claims the couple bought an optional ADD-ON

The booked-package detail page (`app/dashboard/[eventId]/vendors/packages/[bookingId]/page.tsx`) built its two display lists from `removed_item_ids` **alone**:

```ts
const keptItems  = pkg.items.filter((i) => !removedIds.has(i.item_id));
const removedItems = pkg.items.filter((i) =>  removedIds.has(i.item_id));
```

It never consulted `is_default_included`. An optional **add-on** — a line that is never inside `total_price_centavos` and was never charged — was therefore printed under the heading **"Included in this booking"**, with a green tick and no qualifier. The couple's receipt claimed they bought something they did not pay for.

**The page disagreed with the LOCK PATH.** Every other surface filters on `is_default_included` (`lock-modal.tsx`, `package-card.tsx`, `lib/proposal-merge.ts`, `vendor-dashboard/.../proposal-actions.ts`), and the exported `keptItems` in `lib/vendor-packages.ts` refuses to cascade an add-on into an `event_vendors` row for exactly this reason — its own comment reads *"there is no purchase path for add-ons yet"*. So the receipt and the booking said different things about the same package.

**Why the drift was invisible: the local `const keptItems` SHADOWED the imported helper of the same name.** At the call site the two definitions were indistinguishable. The rule now lives in a pure co-located module, `[bookingId]/receipt-sections.ts`, which imports the exported `keptItems` and `isRemovableItem`; the page destructures it under names that cannot shadow anything.

**Three lists, not two** — matching the owner's own design (`Design_Package_Credit_2026-07-26/couple_customize_and_requests.html`, which models the couple side as Included · add-ons · requests): add-ons are **shown in their own labelled section**, never hidden and never folded into Included.

1. **Included in this booking (n)** — now the exported `keptItems`. Not-included excluded, required survives a removal id, follow-up excluded.
2. **Not included in this booking (n)** — NEW. *"Optional extras {vendor} offers on this package. They weren't part of what you booked, and nothing was charged for them."* The design's "Add on if you'd like" is the pre-lock **configurator** voice and is wrong on a post-lock receipt: there is no purchase path for add-ons yet, so an invitation to add would promise something the product cannot deliver. The section names the **status** instead. No peso figure is printed either — `replacement_value_centavos` is a replacement *value*, and a number beside a line that was never billed reads as a charge.
3. **Removed (n)** — unchanged copy, now gated on `isRemovableItem`.

**Double-listing ruling — "not included" WINS over "removed".** A stale or hand-rolled client can put a not-included line's id in `removed_item_ids`, which would have listed it twice. "Removed" is not a neutral label: it asserts the line *was* part of the booking and then came out, and it implies a refund. `computeCustomization` prices a removal only `if (removedSet.has(id) && isRemovableItem(item))`, so the lock path **ignored** that id — nothing was charged, nothing was given back. The receipt reports the status the money agrees with, and does it by reusing the lock path's own predicate rather than forming a second opinion. The same rule keeps a **required** line under Included when its id appears in `removed_item_ids`.

**`is_required` added to the SELECT.** The page's hand-typed column list omitted it, so `keptItems`'s "a required line survives a removal id" branch read `undefined` → falsy and silently no-opped — the receipt would have printed a mandatory line the vendor is still charging for under "Removed". The select is now the canonical `VENDOR_PACKAGE_ITEM_SELECT` (which the lock path and `/v/[slug]` already use, so the column demonstrably exists) plus `parent_option_id`.

The follow-up filter and comment added by the preceding PR are untouched; `receipt-sections.ts` re-applies the follow-up guard itself because it is also handed objects built **in memory**, and because that is what makes the three-way split provably exhaustive.

Tests — `[bookingId]/receipt-sections.test.ts` (new, 9 cases; server component, so the RULE is tested, not the JSX — following the repo's existing co-located pure-module pattern in `app/[slug]/_lib/site-menu.test.ts`): an add-on is never in `included` and IS in `notIncluded`; a required line stays included under a removal id; a follow-up appears in no list, in its legal DB shape and in an illegal in-memory one; the double-listing ruling for both add-on and required lines; and the partition is exhaustive and mutually exclusive over a six-line package. **Neutralised** — restoring the inline `.filter((i) => !removedIds.has(i.item_id))` turns 4 named tests red, led by *"an ADD-ON is never printed as included — the whole defect"* (`actual ['base','addon']` vs `expected ['base']`).

No pricing, no lock path, no `keptItems` logic, no fee code touched. Display only.

SPEC IMPACT: None (receipt correctness; no pricing change)
