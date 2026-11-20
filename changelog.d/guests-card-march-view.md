## 2026-11-20 · feat(guests): Guests redesign, the rest of the drawing — the guest card, March, the view menu, nothing fades

The rest of the approved Event › Guests drawing (`prototypes/guests_redesign_2026-11-20/`, artifact 8rQC8Ug4UCvu3YVvHQR99T; owner 20 Nov *"Yes, your picks"* → *"Yes, build it"*). Stacked on #8064, which built §1 List, §2 the thumb row and §4 Seats › List.

- **§3 The guest card** (carried in from `claude/guests-redesign-list` @ f77e162adf). It rises full screen on a phone. Four quick actions with words sit at the top: Send invite · Call (or "Add mobile") · Seat · Note. The ticket is one row, with its state in words. The rows sit in three groups: About · For the event · More. Not counted for, Passed away and Reset or delete moved under More. Missing things show in colour.
- **§7 March** (carried in from the same branch). One numbered line reads like the printed program, with each heading on the line. The three count tiles became one line of words. Preview is the one terracotta button in the top row.
- **§8 The view menu.** The top pill still reads where you are ("Seats · 2D"). It now opens three places, each with its count: Guests (N guests), Seats (N tables), March (N walks, the March's own count, shown once it has been drawn). One round in the thumb row wears the current look and opens upward: List · Map on Guests, and List · 2D floor plan · 3D room on Seats (drawn by the seat plan through the lens). March has no look round. Each place opens on the look you used last.
- **On every view.** The thumb row draws at full colour at once (on Guests only; the 27 Oct "arrives last" wait stays for every other page). The arrival motion moves and no longer fades. The loading screen is the List's own shape: the pinned row's known words, then row placeholders of the list's height, replacing the 15-tile grid.

No new server actions, no new reads, no migration.

SPEC IMPACT: None — the drawing and DECISION_LOG rows of 20 Nov ("GUESTS REDESIGN: BUILD IT", "Yes, your picks") already rule this. The guard `lib/the-thumb-row-arrives-last.test.ts` is amended for Guests only, per the drawing's "On every view".
