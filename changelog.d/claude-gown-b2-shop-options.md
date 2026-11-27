## 2026-11-27 · feat(gown-maker): the designer's price list and how a design is priced (port step B2)

Gown maker port, step B2 (corpus `WHATS_NEXT_Gown_Maker_Port_2026-11-27.md` § 5; prototype v189 `PRICE_ITEMS`, `HOURS`, `quoteLines`, `renderQuote`; DESIGN-REVIEW-v187 § D, approved by the owner 27 Nov). Pure code, no screen: the shop panel (B4) edits these options and the server (B3) prices with them.

- `lib/gown-maker.ts`:
  - `GownShopOptions`: the designer's own price list (centavos; empty = unpriced), how she prices ("covers the design until it costs more" or "base plus every extra"), what a starting price includes, her workshop time standards, her markup, and the add-ons.
  - `sanitizeGownShopOptions` refuses with a plain reason and never repairs.
- **Add-ons** (owner 27 Nov), 16 of them in their own leaf module `lib/gown-add-ons.ts` (no imports, so the bride's design file can read the same list; Builder A imports it), from veil and cape to fittings and alterations. Each is Priced (her amount) · Included free · On request (no amount shown) · Not offered (hidden). All start Not offered: which ones are free is each designer's choice. A petticoat add-on covers the petticoat's tulle and hoop, so a design is never charged twice. No bows.
- `gownDesignOf` prices a design's quantities with the shop's own list and returns two halves:
  - for the shop: every line grouped Attire Setup (by stage) → Labour → Add-ons, with totals and a count of unpriced lines;
  - for the bride: the estimate (or none: "Ask for a quote"), whether it is within the starting price, and her add-ons' words. No line, cost, markup or hour.
- v193 (coordinator 27 Nov): a new price item "Cape: cutting, sewing and finishing" (per piece) in a new "Cover-ups" group, unpriced until the designer prices it. It is separate from the bride's detachable cape add-on, and the designer may price either. Inside layers price by material per metre: tulle as `net`, organza and chiffon on their fabric items, the hoop per piece. The design's cape choice and per-layer metres arrive in the contract (Builder A); pricing reads them then.
- `isGownKind`: suggested for custom gown makers only (owner Q3).
- **Guard:** `lib/gown-maker.test.ts` (9). Both pricing modes on three gowns, worked by hand; unpriced stays unpriced; no estimate without a price; the four add-on states; the bride's half carries no cost; the options check refuses. Sabotage-checked: an unpriced line read as zero, lines leaking to the bride, and add-ons defaulting to free each turn it red.
- **Not in this PR:** the Toolkit tile (`lib/specialized-tools.ts`, `lib/supplier-store.ts`). It lands in B4 with the setup panel it opens, so no shop sees a tile that opens nothing.

SPEC IMPACT: None. The plan put the Toolkit tile in B2; it moves to B4 so it never ships as a dead button. The coordinator is told.
