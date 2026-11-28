## 2026-11-27 · feat(gown-maker): the gown maker's contract (step A1)

- New `apps/web/lib/gown-config.ts`: the one file both gown builders build on. The design (`GownConfig`, the v186
  `LOOK_BASE` keys plus length, heels, colour and Your colours), her body (`GownBody`: numbers, body shape, bust
  position, what matters, bra size), the gown's own measurements tagged typed or estimate (`GownMeasures`), and what
  a design needs with no money in it (`GownQuantities`).
- Append-only catalogs with the prototype's words; the measurement steps pinned in the owner's order.
- The server's checks refuse, never repair: out-of-catalog picks, sliders off their range or steps, another shop's
  fabric, lace or look, forbidden cut-outs, a bust more than 28 cm over the underbust, weight outside BMI 10–62 for
  her height, and any price or cost riding along with the quantities.
- Nothing a person sees changes yet.

SPEC IMPACT: None (implements WHATS_NEXT_Gown_Maker_Port_2026-11-27.md §2.3 as written).
