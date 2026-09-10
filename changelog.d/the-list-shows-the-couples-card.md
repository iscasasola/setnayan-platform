## 2026-09-08 · feat(vendor): the card list shows the COUPLE'S card

Owner: *"there is already a template of how a service card looks like. all we
want is for that to show instead of this. with the edit details under."*

He was right that it existed. It was simply unreachable. `toServiceCard` sat
~3,300 lines into `app/v/[slug]/page.tsx` and `ServiceCardView` inside that
page's own gallery component, so the only surface in the product that could draw
a couple's card was the couple's page. A vendor looking at their own shop got a
grey wrench glyph and one line of text.

### Moved, not rewritten

- `apps/web/lib/service-card-view-model.ts` — `toServiceCard` verbatim. It
  depended on **no local helper** in that file (every call it makes already came
  from a lib), so the public profile keeps calling the same function.
- `apps/web/app/_components/service-card-view.tsx` — `ServiceCardView` verbatim.
  Its only dependencies were lucide icons, `next/image` and `CardRecordSection`.

The vendor list now renders that card, with `Edit details` under it exactly as
before. It carries what the row never did: the showcase **photo strip**, the
**video**, inclusions as a ✓ checklist with "+N more included", the terracotta
discount pill, and the "Serves" line.

🔑 **A SECOND BUILDER WOULD HAVE BEEN THE OBVIOUS FIX AND THE WRONG ONE.** A card
is a promise about what a couple sees; two implementations of "from ₱X", of which
discount wins, of what counts as included, agree the day they are written and
drift at the first pricing change — and the vendor is the last to find out,
because their copy keeps looking right to them.

### Two decisions worth naming

- **`onOpen` is now optional.** Every use of it is already gated on
  `detailsEnabled`, which is what lets a SERVER component render the card. The
  vendor list is a server component; making `onOpen` required would have forced
  either a client wrapper existing only to satisfy a type, or a second
  non-interactive copy of the card — the exact thing this change removes.
- **`hidePrices` is NOT passed on the vendor side.** It is a *public* choice.
  Forwarding the shop's own setting would hide a vendor's prices from the vendor,
  on the screen where they set them. Guarded.

`apps/web/lib/the-list-shows-the-real-card.test.ts` holds it: the list renders
`ServiceCardView` via `toServiceCard`; the public profile still uses both and has
grown no copy of either; `onOpen` stays optional; the vendor list never passes
`hidePrices`. Mutation-tested four ways.

SPEC IMPACT: None.
