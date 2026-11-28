### Attire Maker: her neckline, back and hem on the designer's cutting blocks (prototype v209)

- **On the blocks.** When the bride shapes her own neckline, back or hem, the maker measures them on her in cm as she sends. The designer's bodice and skirt blocks now draw those lines as rust "design" lines, labelled ("design neckline (custom)", "design hem (scalloped)"), on screen and on the printed pages. The blocks themselves are unchanged. The ball gown's circle skirt gets no hem line yet (as in v209).
- **On the order.** Her lines are said as a designer measures them, under her design: "17.5 cm below the collarbone at centre, 14.5 cm wide at the bust line…", plus armholes cut in and the hem's heights and edge. Lines that can't be read are said, never drawn as the plain ones.
- **On the price list.** A new Hem group, after Skirt, with "Scalloped hem: shaping and finishing" and "Handkerchief hem: shaping and finishing", both unpriced until the designer prices them. They reach the quote when her design has that hem edge.
- The lines are stored with the design in a new column, `gown_designs.edges_cm` (cm and the named words, no money), read like the rest of her design. The port is held to v209's own `lnBlocks` and `lnSummary` to 1e-9 mm and word for word.

SPEC IMPACT: None. This ports v209's blocks and quote half (plan step B9). The bride's side (the handles, `neckLine` / `backLine` / `hemLine` / `hemEdge` and measuring `lines` at Send) is Builder A's.
