## 2026-11-28 · feat(seat-plan): S — the smart layer on Seats › List (suggestions, seat check)

Owner approved seat plan S on 28 Nov (DECISION_LOG; `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.4; drawing
`prototypes/seating_later_2026-11-27/`). No new page, and no new server action. The answers come from the engine's dry
run, `dryRun` (the engine lane, L11). Until that read lands, the plan draws none of this.
- **Card suggestions:** a card with empty seats shows a strip under it: ✦ the suggested names, the reason and "Seat N".
  One press seats them as a unit, in one write, with an Undo line.
- **Seat check:** one line under the counts, "⚠ N to look at ›", only when N > 0. It opens a Sheet listing each
  problem with its reason and one Fix or Review, then "All good", then one main "Fix all" with one Undo.
- **A failed check** says "Couldn't check seats · Try again", never a false "All good".
- **⋯ › "Suggest seats on the cards"** is on by default and remembered on the device.
- **C follow-ups (controller review of #8491):**
  - on 2D, a match with no seat clears the lit table and says "Not seated yet";
  - the pill's "Seat N" is the chair the plan draws, the same one that lights;
  - 3D shows no "1 of N", since Enter doesn't step there;
  - the pulse runs on the Sheen token, once per Find;
  - the count stays after the field lets go of the keyboard.

SPEC IMPACT: None — builds § 4.4 and the approved drawing as written. "Seat new RSVPs for me" waits for the engine's
RSVP hook and setting (L11).
