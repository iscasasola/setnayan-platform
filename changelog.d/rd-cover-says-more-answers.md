## 2026-10-20 · feat(cover): "You're coming ✓ · N more answers", and the reply button wholly on the first screen

Owner, verbatim: *"Yes. Show "You're coming ✓ · N more answers" when answers are missing (tap opens only the missing
ones), and lift the button so it's fully visible on first open."* (corpus DECISION_LOG 2026-10-20 "THE COVER'S REPLY
BUTTON HAS THREE STATES", 453b7c42). Measured live on maria-and-jose (iPhone 13, WebKit): an attending guest with the
couple's meal + mobile questions unanswered met "You're coming ✓ · Change", identical to a complete reply, while the
reply page asked "Two more things"; the button stood at y 644–688 in a 664-tall screen.

- **N is the reply page's own missing set.** `moreAnswersOf(rsvpGate(…))` (`lib/guest-one-path.ts`) counts the verdict
  of the ONE rule the reply page asks for the questions it shows — never a second count. The Event Hub page counts its
  own key gate; the guest identity carries it (`moreAnswers`); the Reply card (Welcome · Me) says "N more answers" in
  "Change my reply"'s place; the cover says "You're coming ✓ · N more answers" ("1 more answer"), and its tap OPENS the
  reply page (which asks only those) instead of gliding to the card. The landing door (`invite/enter`) says it on its
  Change link too, from the reply page's own `rsvpGate` call (its select now reads `mobile`).
- **A failure does not look like success.** A row without `rsvp_status`/`meal_preference`/`mobile` is not counted
  (`guestAnswersRead`): the plain "Change", and a `[read-gap]` log line — never a wrong number.
- **Unchanged:** not answered "Confirm attendance"; complete "You're coming ✓ · Change"; a decline "You can't make it ·
  Change" (the gate asks a decliner nothing more, so no decline ever owes answers).
- **The lift.** The guest's foot is fitted by the SAME rule as the stranger's door in the foot (`FirstScreenDoor foot`,
  2026-10-18), now `FirstScreenDoor foot rsvp`: the air closes, the mark draws smaller, and only then whole parts move
  below the whole foot — never onto the date or the place. Also on a PHOTO cover (the plate gives way first, as on the
  stranger's photo page since 2026-10-13; the foot is now never counted as one of a photo cover's parts). The edge
  clearance respects the safe area (the foot's own `max(14px, env(safe-area-inset-bottom))` + 2, still 16 px with no
  inset). Not in the Maker's canvas (`fitFoot`).
- Guards: `lib/the-cover-counts-the-reply-pages-questions.test.ts` (the property over 96 attending rows + the three
  states + the read gap + the wiring) and `tests/e2e/the-guests-cover-button-is-on-the-first-screen.spec.ts` (66 cases:
  375×667 · 390×664 · 430×739 · 375×812, three states, two grounds + a photo cover, notice up/down). Sabotaged.

SPEC IMPACT: None — implements the DECISION_LOG 2026-10-20 row as recorded (453b7c42); no new decision.
