## 2026-10-22 · fix(attire): the Maker's guest strip draws the chosen designs, not one design per colour

Owner, 22 Oct, live Maker › Mood Board & Dress Code › Guests: ticked Suit and tie → four designs, the Wear ▾ said
"Suit and tie · 4 designs" — and the figure strip above it drew the Classic two-button suit four times, once per
colour (*"they did not show still just 1 design showed"*); the same with suits + a barong + smart casual ("+2 · 5
designs"), and four of one long dress for the women.

- **Cause:** the strip drew every colour option in the column's HERO drawing (`heroArt` — the first allowed design);
  the allowed designs reached only the Wear ▾ and the line under it.
- **Fix** (`mood-board-studio.tsx`, `stripLooks` in `lib/attire-design-picks.ts`): the colours are worn in turn along
  every allowed design, across styles in tick order — design 1 in colour 1, design 2 in colour 2, …; more colours than
  designs cycles the designs, more designs than colours cycles the colours. Each figure is its design's own drawing,
  tinted by its own zones (suit: the colour on the tie over black; barong: its body, pants charcoal; smart casual: its
  top, chinos khaki; women: the whole dress), labelled with the design's name and what its colour colours; its dot
  edits the colour it wears. Men and women alike.
- **Unchanged:** a column with one design (every dress code before 2026-10-21, or one narrowed to one) keeps the
  shipped strip byte for byte — one figure per colour, no names. The guest page's "Dress with us" board already drew
  the chosen designs (#6749) — re-walked, not changed.
- Guard: `lib/guests-pick-styles-and-designs.test.ts` § 8 (the four suits · the mixed five across styles with
  cycling colours and per-style zones · the women · designs cycling · a 40-seed fuzz · the legacy strip).

SPEC IMPACT: None — implements DECISION_LOG 2026-10-21 "STYLE → UP TO FIVE DESIGNS (GUESTS)" ("colours in turn")
in the Studio's strip as the guest board already does.
