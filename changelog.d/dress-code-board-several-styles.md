## 2026-10-21 · feat(attire): guests pick a style, and up to five designs inside it

Owner, 21 Oct: *"For the guests they can pick different outfit styles. This means we need different attire looks as
well."* → *"Show me a prototype. Where up to 5 different attires. Meaning 5 different smart casual, 5 coat and tie, 5
barong"* (prototype `attire_five_designs_per_style_2026-10-21.html`).

- **Library** (`lib/attire-library.ts`): the guests' six styles × five designs = 30 rows, one registry entry per
  drawing. 29 are drawn: the six shipped (#16 #17 #42–#45) and 23 new Higgsfield drawings (#46–#69) cut through the
  shipped pipeline (`scripts/build-role-attire.py`: zone boxes, sheer barong tops, traced chinos and clutches) into
  `public/attire/roles/<role>-<style>/<variant>…`. **Held:** "Polo and slacks" — its figure came back with white skin,
  so it stays not drawn (never offered, never rendered) until regenerated; a drawing ships by its files + its row's `w`.
- **Stored shape** (no migration): `designs: string[]` beside each guests' column's `style` (`"suit"` = the whole
  style, `"suit/classic"` = one design). `style` is always the first tick's, so every older reader is unchanged; no
  `designs` (every dress code before today) reads as the style's shipped design alone — never a board nobody chose;
  `designs` written for another `style` are ignored.
- **Studio › Mood Board & Dress Code › Guests** (the Maker too): the same Wear ▾, now ticking — each style a row
  (one tap allows all its designs), its drawn designs as tiles under it (a tap narrows). The pill says
  "Suit and tie +1 · 2 designs"; a line under it names what is allowed. Other roles' Wear ▾ unchanged.
- **Guest page "Dress with us"**: once a column allows more than one design, the Guests row is a board — hero pair,
  FOR MEN / FOR WOMEN with one line per allowed style, the colours once at the foot ("Wear any one of these colours, in
  any of the outfits above."). Each design wears the next colour in turn along its row and takes it by its own zones
  (guest man: tie over black, shirt white; barong: body, pants charcoal; smart casual: top, chinos khaki; women: one
  zone). One design per column keeps the shipped row byte for byte.
- **Prints** read the page's rows: a column allowing several styles prints "Suit and tie or Barong Tagalog".
- Guard `lib/guests-pick-styles-and-designs.test.ts` (10 properties, 7 sabotage runs red → green).

SPEC IMPACT: `Setnayan/DECISION_LOG.md` — new row 2026-10-21 "STYLE → UP TO FIVE DESIGNS (GUESTS)" (owner verbatim;
controller's calls on the prototype's three open questions recorded there for owner veto). The 24 new drawings are
listed with ready prompts in `shots-2026-10-21/dress-code-board-build/GAPS.md`; none is generated.
