## 2026-11-02 · fix(guests): the guest card's Access is three lines · guest import opens December 19

- **Access, simplified** (owner 2026-11-02: *"simplify access just like the rest of the guest card"*). Opened, the Access
  row is at most three lines:
  - **Access ▾**: ONE PickMenu, None · Helper (can view) · Co-host (`CARD_ACCESS_CHOICES`). What each choice means
    is in the ⓘ. It is offered for any guest the couple may manage, linked or not yet; a level set ahead starts once
    they sign in, which `setGuestAccess` already did. A viewer sees the word on the same row. The second
    "Access · None" line and its paragraph are gone.
  - **Account**: Not linked / Linked — email, on one line. "When they link, it shows here" is in the ⓘ.
  - **[Give this spot…] [Take this seat back]** side by side (`guest-seat-doors.tsx`). Give opens its name field and
    its Give only on a tap, and only while the guest has not replied. Both explanations are in the ⓘ. Both still post
    the one release door.
  - The Passed Away row is unchanged.
- **Guest import opens December 19** (DECISION_LOG 2026-11-02, "GUEST IMPORT OPENS DECEMBER 19, LIKE EVENT CREATION").
  This uses #7146's constant (`FIRST_EVENT_DAY`) and the shape of its message (`GUEST_IMPORT_OPENS_MESSAGE`,
  `guestImportRefusal`). Before the day, `guestImportGate` refuses a normal account's import on the server, before
  either step reads or writes. The import door shows the message in place of the upload. `is_internal` accounts, and
  events whose host is internal, are exempt. An unanswered exempt read fails closed.
- Guards: `the-access-row-is-three-lines.test.ts`, `guest-import-opens-dec-19.test.ts`. Re-pointed:
  `the-access-column-is-the-cards-access-line` (the 24 Oct "linked only" dropdown, superseded by the owner today),
  `a-failed-save-says-so`, `the-templated-card-holds-no-hand-made-control`, `give-this-spot-to-someone-else`,
  `guest-claim-release`.

SPEC IMPACT: None — implements the 2026-11-02 rulings as written. The import message adds one sentence
("Until then, add your guests one at a time…") for the owner to confirm.
