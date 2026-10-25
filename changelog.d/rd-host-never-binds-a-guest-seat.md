## 2026-10-21 · fix(guest): a host never binds a guest's seat — the page offers nothing, the server refuses

Owner, 21 Oct, signed in as himself (the HOST of his own wedding) on Pam's personal invitation, was offered
*"This invitation is for Pam. Save it to <his own email>? [Yes, save to my account]"*. A host who presses
"Open as Pam" carries her pass on purpose (the pass rule's `host_preview`), so the page built the guest's
`link_this_seat` state and `linkThisSeatAction` → `linkGuestSessionToUser` would run for the host's account on her
row (no membership change for a couple member — `ignoreDuplicates` — but her name, mobile and meal copied onto the
host's blank profile and a "connect with the hosts" ask; for a delegate with no membership row, a real bind).

Extends the 2026-09-30 ruling "A SEAT BECOMES AN ACCOUNT'S ONLY ON PURPOSE" in its own module, no parallel path:

- `lib/seat-binding.ts` — `seatBindRefusal` gains `'manager'`: an account that MANAGES the event (a `couple` /
  `coordinator` membership, or an accepted, not-removed `event_moderators` row — co-host or limited helper; the same
  "host" as `loadHostMembership` and the pass rule's `isHost`) is refused every seat that is not already its own.
  `hostViewingLine(name)` — "You’re viewing Pam’s invitation as the host. Only they can save it to their account."
- `lib/link-guest-account.ts` — `accountStandingOnEvent` (fails CLOSED: an unreadable standing refuses);
  `linkGuestSessionToUser` asks it before anything is written → `{ linked: false, reason: 'manager' }`.
- `lib/event-account-link.ts` — `findSeatToConnect` marks the seat `refusal: 'manager'`, so `connectEventForUser`
  binds nothing and `/join/{id}/connect/confirm` says the host line instead of the couple-seat sentence.
- `lib/guest-one-path.ts` — new account state `host_viewing`; `guestAccountState({ viewerManagesEvent })`. Every
  caller passes it: the Event Hub (`ownerCapability`), the thank-you (`loadHostMembership`), the plus-one door
  (`accountStandingOnEvent`). `SaveToAccount` draws the one quiet line, nothing to press.
- `/dev/me-lab?host=1` — Me on a guest's invitation for the host (before / after) and for the guest, no database.

Guards (each sabotaged, seen red, restored):
- `lib/a-host-never-binds-a-guest-seat.test.ts` — the rule as a property over every role × extra role × couple flag;
  the account state as a property; the REAL binder executed (fetch + cookies stood in) for a couple member, a
  coordinator, a co-host and a limited helper carrying the pass via "Open as Pam" → refused with ZERO writes; the
  ordinary guest control still bound; the host's own row still theirs; a failed standing read refuses; the connect
  question marks the host refused. Sabotages: binder refusal disabled (5 red) · page state ignores managers (1 red) ·
  rule line removed (7 red) · connect question skips it (1 red) · standing read fails open (1 red).
- `app/[slug]/_components/a-host-is-never-offered-the-seat.test.ts` — `SaveToAccount` in `host_viewing` renders the one
  line and no form/button/link (executed); every `guestAccountState(` call site passes `viewerManagesEvent`.
  Sabotages: the `host_viewing` branch removed (1 red) · the plus-one door's line removed (1 red).

Not changed, on purpose: platform admins (`is_internal` / team) are NOT treated as managers — the owner's own account
is `is_internal`, and must still be able to keep his own invitation at someone else's event. "Admin" in the report is
read as event management (couple · coordinator · co-host · helper).

SPEC IMPACT: None — extends the 2026-09-30 DECISION_LOG row "A SEAT BECOMES AN ACCOUNT'S ONLY ON PURPOSE" in code; no
new ruling (the owner's 2026-10-21 report is the instruction).
