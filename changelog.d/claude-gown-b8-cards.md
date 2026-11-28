### Attire Maker: a sent gown design arrives in the chat as a card, and the designer quotes from it

- **The design card (both sides).** A bride's sent design shows in her chat with the shop as a card, not a raw message. It lists her shape, fabric, colour, neckline, sleeves, back, train, closure, veil, add-ons and any hand work, with her estimate or "Ask for a quote". A newer design marks the older one "Replaced". A failed read says so, with Try again.
- **Make a quote, pre-filled.** The designer's Make a quote opens the shipped quote card with her estimate as the offer and her priced add-ons as their own lines. The design's cost lines never go on a quote, because the bride reads it.
- **Her add-ons are kept.** Until now the add-ons she picked were priced into her estimate at Send and then thrown away, so the designer's own view priced the design without them. They are now stored with the design (ids only, no money) and priced from the shop's own list when it reads.
- The card has no picture yet; the gown's still joins it when the bride's maker (A10) lands. The invite card and the ＋ tray tile wait for the bride's designer (A9).

SPEC IMPACT: None. This builds plan step B8's design card and pre-fill. It adds one column, `gown_designs.add_ons`, which the step needed and the plan's §3 did not list.
