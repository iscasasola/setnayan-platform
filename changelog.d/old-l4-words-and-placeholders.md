## 2026-11-27 · fix(words): L4 — brand slips, sample cards, explaining empty states, TBA and grammar

Owner rule R3 (27 Nov): "a fixed app, not an app with guidelines on what should be here."

- **Brand slips.** "free, for life" → "kept for life" (Papic reminder, Memories, photo delivery, the 3-month email). "Always free" is gone from the FaceBlock row and the Maker's "No reveal", and "Free to start, always." from onboarding. Unihome's shop row drops "Free to start." The plan button reads "Start an event". On /invitation, "Monogram" becomes "logo" and "Your invitation site" becomes "Your Event Hub".
- **Email only.** A guest with only a mobile number now counts as having no email, because Setnayan sends no SMS. The line reads "No guest emails yet." or "X of N have no email.", with an Add emails button.
- **No sample shown as if real.** The greyed "Example" look is retired everywhere:
  - Event Home tiles, Who's here, the to-do list, Budget, Memories, the Guests list and the Event Hub stage;
  - the schedule rail, booked suppliers, the user board shelves, Unihome (Events, People, Memories), the supplier portfolio, and the supplier analytics graphs (an empty graph draws no picture).
  - The shared `ExamplePreview`, `lib/empty-look-samples.ts`, `board-examples.tsx` and the `.sn-example` CSS are deleted.
  - On Unihome, a shop with no photo of its own shows a plain shop mark, not a stock photo labelled "Sample photo". The public front door's shop card and the supplier's own hero keep their "Sample photo" caption.
  - /for-suppliers drops "Sample cards.", and the two /features "Honest empty states" rows (A75, C39) move to EXCLUDED as retired.
- **One line plus one action.** These empty states were rewritten:
  - contracts → "No contracts yet." + Open chats;
  - budget → "No expenses yet.";
  - Money → "No payment plans yet." and "Nothing confirmed this year.";
  - Quotes: the explaining paragraph is gone, with "No booked clients yet." and "No templates yet.";
  - reviews → "No reviews yet.";
  - Unihome and Discover follows → "No events from people you follow";
  - Unihome Memories → "No photos yet.";
  - schedule → "No moments yet.";
  - lost dates and price position → short lines;
  - Maker background → "Needs a picture".
- **TBA and hints.** An unnamed +1 reads "Mia Cruz's +1" (the stored "+1 · TBA" rows are unchanged). The host's schedule hides "Venue TBA". The Guests search box says only "Search guests", with no rotating "e.g." lines.
- **Grammar.** "1 photo left", "1 guest photo left" and "1 ticket" now read correctly.
- **The "Someone" stand-in.** "Not Someone? Switch account" on an Event Hub now reads "Not you?".

New guard: `app/_components/states/no-sample-shown-as-real.test.ts`. It replaces `every-empty-part-shows-an-example.test.ts`.

SPEC IMPACT: R3 (DECISION_LOG 2026-11-27) supersedes the 2026-11-09 "Empty Look" ruling (greyed examples on every empty dashboard part); the corpus needs a DECISION_LOG row saying so, and MASTER-PLAN L4 items P1, P2, B1, B2, B3 and part of B4 are closed by this PR.
