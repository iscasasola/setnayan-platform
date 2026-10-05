## 2026-10-05 · feat(maker): the hub top nav (✕ red · the screen · [↺ | 👁] · ✓ green) · the ticket style waits for Apply · Look opens Look · four owner fixes

Part of `prototypes/maker_keynote_chrome_2026-10-05_fable.*`. These are only the parts that are owner decisions or bug fixes (controller, 2026-10-05). The bottom third (bottom nav, scene strip, sheet positions) is still being prototyped and is NOT in this change.

- **The ticket style goes through the hub draft (owner 2026-10-02 Q7, "the pass look waits for Apply").**
  - The draft's `print_details` now holds `pass_design` next to `name_style` (`HUB_DRAFT_PASS_DESIGN_KEY`). The two keys merge one at a time, so neither pick wipes the other.
  - Apply checks only the keys the draft holds (`printDetailsKeysChanged`) and merges them into the live settings blob as it stands at write time. The Apply sheet calls the change "Guest's ticket · Ticket style".
  - `PassCardDesignPicker` saves through `hubDraftAction` (`passDesignDraftPatch`, lib/pass-design-save.ts). The live door `POST /api/hub-print/pass-design` is gone.
  - Guests' cards, Save-all, the zip and the Phone card print keep reading the live look until Apply.
  - Prints and the Maker open on the drafted look.
- **The Guest's ticket scene shows the real ticket.**
  - The page draws the first coming guest's ticket (name and own QR) in the look being edited. The print route's screen preview gained `pass_guest=first`, which reads one guest only (`limit: 1`) and falls back to the stand-in when there is none.
  - The sheet carries ONE Ticket style ▾ (Classic · Ticket · Photo poster). The sentence and the "Open your guest list →" link are gone.
- **The top nav.**
  - ✕ Exit: red, an X, its own pill. It used to be "‹", which reads as back one step.
  - The top line names the screen you are on ("Invitation · Welcome", "RSVP · Reply", or the guided flow's one title) and truncates. "· as a guest sees it" is gone.
  - [↺ Undo | 👁 Preview] share one pill. ✓ Apply is its own pill and is now green (it was wine), still with its count.
  - One new shared wrapper, `IconPill` (`launch/_components/icon-pill.tsx`).
- **Look opens the Look tools directly.** A Look press used to land on the guided flow's stage list. Details now leaves the flow's screens for that visit and opens the Look panel (`detailsDoorKind`).
- **The Event Bar (i) note is gone.** Its bubble floated over the scene tiles with no solid background, and it could not be closed from the page. The switch keeps its word, "Event Bar".
- **The names & date sheet sends nobody elsewhere.**
  - Removed "This scene is made in the Hero editor.", "Open Hero editor", and the part sheet's "Open the Hero editor".
  - The row of part pills is ONE "Part ▾" dropdown. A tap on the part on the page still opens its sheet.
- **👁 Preview is seen on a setup screen.** Event Details and the RSVP stage cover the canvas, so a See as / Phone-Desktop / Both pick changed a page nobody could see. Those picks now put the stage back on screen, drawn that way.
- **Guards:**
  - New `lib/the-maker-top-nav-and-ticket-style.test.ts`: 12 tests, each sabotaged red, then restored green.
  - Updated to the new design: `every-scene-is-in-the-navigator`, `the-event-bar-is-the-stages-own`, `the-maker-keeps-the-page-on-a-phone`, `tap-to-type-is-instant`.

SPEC IMPACT: corpus `DECISION_LOG.md`, a 2026-10-05 row. It marks the keynote-chrome prototype PARTLY BUILT (top nav · ticket style through the draft · Look opens Look · Event Bar note · no Hero go-elsewhere · Preview on setup screens · Guest's ticket sheet) and says the bottom third is still in prototype. It also records that Q7 (2026-10-02) is now built.
