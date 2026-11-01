## 2026-10-28 · feat(guests): a guest row is Share + Delete — the pencil goes, the row opens the card

Owner 2026-10-27 (DECISION_LOG "GUEST ROW = SHARE + DELETE; THE PENCIL GOES"): *"share and delete only"*.

- Each Guests › List row now ends in exactly two buttons: **Share** (the ONE Send button) and **Delete** (the shipped
  remove, its warning and its Undo — the button's word changes from "Remove" to "Delete", icon ✕ → bin). A +1 with no
  name keeps "Release seat" in Delete's place and gets no Share (they ride on their guest's invitation).
- **Share is the shipped Invite cell (`GuestInviteCell`) drawn as one icon** (`layout="icon"`): on a phone it opens the
  phone's own share sheet at once (the same `shareInvite`, the message with their own link; an app taking it stamps
  Sent ✓ as before); on a computer, or where the sheet refuses, it opens the cell's shipped sheet (WhatsApp · Viber ·
  Messenger · Copy message · Copy ticket · Mark as sent · Copy invitation link), with "Did you send?" on return. No new
  sender. The card's own sheet is now one shared block in that file (no behaviour change).
- The pencil (Edit) and the dormant Message button are gone from the row — the row's name/avatar already open the card.
  The screen's `chatHrefFor` and `linkedGuestIds` props (Message's only inputs; no couple↔guest chat ships) and the
  page's `event_members` read for them are removed.
- The page hands the rows `invite` (`RowInvite`): the event's invitation address + words (the reads the card already
  used) and the token of each guest the send run would hold (`mayBeInvited`), never to a look-only helper.
- Guards: new `the-guest-row-is-share-and-delete.test.ts` (executed verbs, rendered row = exactly two buttons, one
  sender, page wiring; three sabotages seen red); `guest-row-actions-share-the-name-line`, `no-row-invite-no-nudge`,
  `a-seat-with-no-name-can-be-released`, `the-list-sends-only-what-it-draws` follow the new property;
  `message-needs-an-account.test.ts` retired with Message (its property no longer exists).

SPEC IMPACT: None — implements the 2026-10-27 DECISION_LOG row "GUEST ROW = SHARE + DELETE" as recorded.
