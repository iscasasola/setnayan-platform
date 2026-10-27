## 2026-10-27 · feat(guests): the thumb row arrives last; "Did you send <name>'s invitation? Sent · Not yet" on the way back

Owner rows of 2026-10-27 (DECISION_LOG): "THE THUMB ROW ARRIVES LAST" (*"make thumb row pop up last so it does not
intersect with the animation and build up of the page?"*) and "AFTER INVITE OPENS ANOTHER APP, ASK ON RETURN: \"SENT\"
OR \"NOT YET\"" (*"when we return is it better to ask if did they successfully invite the person? … just answer Yes or
No"*).

- **Thumb row arrives last** — `lib/thumb-row-arrives-last.ts` is the ONE timing (`THUMB_ROW_ENTERS_AFTER_MS` = 700,
  longer than the Guests ring's 600 ms build-up; reduced motion = no wait). Guests' row used to slide up two frames after
  first paint, over the ring and the section pop; it now rises AND fades in after the build-up, re-arming on List ↔ Map,
  and takes no taps until it is on. Other thumb-row pages adopt the same hook with the pinned-row template.
- **Sent / Not yet** — `lib/ask-on-return.ts` (`askOnReturnStep`, pure; `useAskOnReturn`) + `SentOrNotYet` (the approved
  `ConfirmDialog`). Armed by the presses that LEAVE Setnayan — "Send in an app" (Viber · WhatsApp · Messenger) and the
  copies (message, link) — at the press, before any await (opening an app can hide the page before its promise settles;
  found walking the lab). Asked only if the page really went to the background and came back, once, and not for an arm
  older than 2 minutes. **Sent** goes through each surface's own `mark(true)` → the ONE writer `setGuestInvitationSent`
  (guest moves To invite → No reply, in place); **Not yet** changes nothing. The phone's share sheet does NOT ask: it
  already stamps Sent ✓ when an app took the message. Wired on the guest card / one-by-one run (`SendInviteActions`) and
  the list's Invite (`GuestInviteCell`). "Mark as sent" stays for a host who never left (and on a computer).

Guards: `lib/the-thumb-row-arrives-last.test.ts`, `lib/ask-on-return.test.ts` (pure steps + both surfaces arm before
any await, never on share, answer through `mark(true)`). Sabotage: 10 runs, each red, restored. +0 server actions, no
migration.

SPEC IMPACT: None — builds the approved 2026-10-27 rows.
