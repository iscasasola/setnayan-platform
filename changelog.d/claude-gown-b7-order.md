## 2026-11-27 · feat(gown-maker): the gown on the supplier's order: her numbers, your tape, the cutting blocks (port step B7)

Gown maker port, step B7 (corpus `WHATS_NEXT_Gown_Maker_Port_2026-11-27.md` § 5). It follows the shape of the Cake Maker's `cake-design-on-order.tsx`. The approved drawing is `prototypes/gown_maker_2026-11-27/gown_maker_v197.html`, "Quotations and orders" and its pattern panel.

A supplier's client › Details now shows **Her gown design** when the bride sent one in the chat. Nothing is drawn when she didn't; a refused read says so.

- **Her design:** the design in words, and the estimate she saw (or "She asked for a quote"). It says when she sent a newer design after this one.
- **Your costs (only you see these):** the cost lines, priced now from the shop's own list on the server by the existing `design` op. Nothing is priced on the device. With no lines it says "No cost lines for this design yet".
- **Her numbers:** each tagged as hers or the mannequin's estimate. Arm and leg are stored as proportions of her height and read as "about N cm". Also her bra size (or "Couldn't read it"), and what matters to her.
- **The gown's measurements:** only those this design needs. Each shows hers or the estimate, with your tape beside it. **Save tape** stores it through the existing `fit` op (`gown_fittings`, the shop only).
- **Cutting blocks** (loads only when opened):
  - starting blocks from her numbers in what she wears underneath, the design's own ease, and your tape over both (`lib/gown-pattern/order.ts`);
  - each block's check rows;
  - the "from memory" note;
  - **"ESTIMATE: measure before cutting"** whenever a number on a block is an estimate. It goes away once your tape covers it.
- `design` now also returns the stored design's id, so the tape saves against it.
- "Open on the mannequin" comes after Builder A's step A8, never as a dead control before then.
- **Guards:** `lib/gown-pattern/order.test.ts`. Every number is tagged. The estimate line follows the blocks' own flag (sabotage-checked). The screen reads and saves through the one action, loads the engine on demand, prices nothing itself, and has no mannequin button yet. The couple-can't-read-the-tape db test is B1's.
- **Lab:** `/dev/gown-shop-lab?view=order`.

SPEC IMPACT: None. This builds step B7 as planned.
