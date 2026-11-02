## 2026-10-03 · feat(tours): the centered tip popups are switched OFF — one switch, until the spotlight tour ships

Owner, 2026-10-03, verbatim: "also remove these since we will place the spotlight tour soon" — about the centered step carousel ("STEP 1 OF 2 · … · Back / Skip / Next").

**One switch: `TIP_POPUPS_ON` in `apps/web/lib/tip-popups.ts`, set to `false`.** It turns off every centered tip popup at once, with the mounts left exactly where they are:

- `MiniTour` (the ~40 mounts) returns null before any `users.tour_seen_keys` read — a mount now costs nothing.
- `GuidedTour` (couple, admin and supplier welcomes in the role layouts) returns null; `guidedTourView` draws no slides, so a guest page no longer carries the words either.
- `GuestGuidedTour` (invitation page, Papic guest pages) never opens and never reads localStorage.
- `GuidedTourCard` itself opens only while the switch is on (last backstop; `open` false also means no scroll-lock).

**What stays on:** "Who can reply?" (`WhoCanReplyAsk`) — it is a real settings question that saves a choice, not a tip, and does not read the switch. The Maker's "About the Maker" menu item still opens its own carousel on request (user-pulled, not a popup).

**What stays in the tree:** every mount and every word in `lib/tours.ts` — they are the spotlight tour's keys and script (corpus `prototypes/spotlight_tour_sample_2026-10-02.html`). New features add their words to `lib/tours.ts` as before; nothing pops up until the switch is flipped or the spotlight tour replaces it.

Guard: `lib/tip-popups-are-off.test.ts` (7 cases) — the switch is off; `GuidedTour` and `guidedTourView` are CALLED and return null / zero slides; `MiniTour`, `GuestGuidedTour` and the card are source-anchored (switch check precedes the first DB / localStorage read); the mounts still exist; `WhoCanReplyAsk` does not read the switch. Sabotaged: flipping the switch on → 2 red; deleting the MiniTour guard → 1 red; restored → green.

SPEC IMPACT: DECISION_LOG row "2026-10-03 · TIP POPUPS OFF UNTIL THE SPOTLIGHT TOUR" (applied directly in the corpus).
