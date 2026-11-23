## 2026-11-23 · fix(for-suppliers): a closed shop leaves the live cards row, and the story of each change is told under the cards

Owner, 23 Nov, on the live cards ("One card. It fits every couple."): *"this needs to show what is happening and not just changing"*. Then, on the PR preview: *"shouldn't we maximize the screen? so the story telling of what is happening can be under?"*

- **Date.** A sample shop that is not free on the picked day now LEAVES the row: a ring marks it, it fades and shrinks out, and the cards after it slide into its place. It comes back the same way on a day it is free. Before this, on Sat 12 Dec Casa Lirio's day was greyed "Not bookable" but its card stayed, labelled "Booked that day". A day with no sample shop free (24 · 25 Dec) says so in words, never a blank strip.
- **Script.** It now starts on a day all four shops are free (11 Dec), so the scroll shows a card leaving on Sat 19 Dec. The per-guest caterer stays in for the guest step.
- **The story, under the cards.** The live-cards stage fills one screen under the top bar. Under the cards, one plain sentence says what just happened: a card left or came back, the caterer's new total, or the new distance. The pointer is on the card itself: a ring on the card that left or came back, and a wash over the price or distance line that changed. Nothing floats over the cards; the floating tip of the first preview is gone, and with it the overlapping text the owner saw.
  - The panel wears the spotlight tip card's solid surface.
  - Its words are `LIVE_STORY` in `supplier-front-data.ts`, one place. It is a `role="status"` region.
  - Motion is opacity and transform only, on the `--sn-m-*` tokens, behind `[data-motion]`. Reduced motion: the words only.
- **Badge line.** On a 158 px sample card the medal line wraps, so the badge's name is never cut off ("F", "S…").
- **Tests.** `the-redraw-plays-what-ships.test.ts`: the drop-out rule replaces "the first day shows both answers", with new story, ring, full-screen, empty-row and badge-wrap checks. `supplier-front-reads-its-numbers.test.ts`: the card's date line is always the free one.

Not in this PR: the plan picker (centring, bars sized to storage, tool lines). It changes the same files as #8217, so it follows that PR.

SPEC IMPACT: Small. The live cards' date step changes from "Booked that day" on the card to the card leaving the row, and the story of each change sits under the cards (owner 23 Nov). A DECISION_LOG row with the owner's words is still to be written in the corpus.
