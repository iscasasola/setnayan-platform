## 2026-11-23 · fix(for-suppliers): a closed shop leaves the live cards row, and each change is explained by a "what's happening" tip

Owner, 23 Nov, on the live cards ("One card. It fits every couple."): *"this needs to show what is happening and not just changing"* · *"pointing at something like a what's happening pop up"*.

- **Date.** A sample shop that is not free on the picked day now LEAVES the row: it fades and shrinks out, and the cards after it slide into its place. It comes back the same way on a day it is free. Before this, on Sat 12 Dec Casa Lirio's day was greyed "Not bookable" but its card stayed, labelled "Booked that day". A day with no sample shop free (24 · 25 Dec) says so in words, never a blank strip.
- **The script** now starts on a day all four are free (11 Dec), so the scroll shows a card leaving on Sat 19 Dec. The per-guest caterer stays in for the guest step.
- **One tip per change** points at what changed: the card that left or came back, the caterer's total for the new guest count, or a distance for the new venue. It reads for a moment, then settles away. Its look is the approved spotlight tip card (`spotlight-tour.tsx`, corpus `prototypes/spotlight_tour_sample_2026-10-02.html`), small and without the dim. Its words are `LIVE_TIPS` in `supplier-front-data.ts`. It is a `role="status"` region. Motion is opacity and transform only, on the `--sn-m-*` tokens, behind `[data-motion]`. Reduced motion: no slide, no fade.
- Tests: `the-redraw-plays-what-ships.test.ts` (the drop-out rule replaces "the first day shows both answers", plus new tip and empty-row checks) and `supplier-front-reads-its-numbers.test.ts` (the card's date line is always the free one).

Not in this PR: the plan picker (centring, bars sized to storage, tool lines). It changes the same files as #8217, so it follows that PR.

SPEC IMPACT: Small. The live cards' date step changes from "Booked that day" on the card to the card leaving the row (owner 23 Nov). A DECISION_LOG row with the owner's words is still to be written in the corpus.
