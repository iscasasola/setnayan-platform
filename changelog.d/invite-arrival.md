## 2026-09-10 · feat(invite): the invite link is an arrival — Name · Reply · Enter

Owner, 2026-09-10: the invite link "finds/adds them on the list · adds their
information · then offers to sign up to link this event to their personal
account · and jump to the event hub after" — and, the same day, the email on
the reply IS the account, so there is no separate sign-up step. Three doors,
each wearing `DoorShell`'s step rail (built with the shell, never passed by any
door until now):

- **01 · Name** (`/[slug]/invite`, `JoinFlow`) — one field, one action. The
  18-role picker is **removed** from both the accountless and signed-in forms,
  building the owner-locked 2026-06-25 addendum ("role is host-controlled — the
  join role-picker is REMOVED"); the picker had shipped five days before that
  lock (e567da125) and was never taken down. No join action reads `role` from a
  form any more — a matched guest inherits the couple's role, everyone else is
  `guest`. The optional email and "Sign in instead" moved to Reply.
- **02 · Reply** (`/[slug]/invite/reply`, new) — the guest completes their own
  record with the Event Hub's own RSVP card (`RsvpWidget`, new `doorAction`
  variant: same fields, same `submitRsvp` write, no letterpress card head, no
  start-free pitch). Continue with Google / Apple sit at the top — before any
  typing — and return through `/join/[eventId]/connect?then=reply`, which binds
  the seat to the account. An email typed instead is sent the passwordless
  sign-in link on save (`submitInviteReply`, at most once per event per browser).
- **03 · Enter** (`/[slug]/invite/enter`, new) — "You're in", "You joined as",
  the not-on-the-list notice and a truthful "your sign-in link is on its way",
  then **Open your invitation** → `/{slug}`, which IS the Event Hub.

Redirects are driven by KEYWORDS (`return_to=invite`, `then=reply`), never
paths; every destination is built from the slug the database returns.
`submitRsvp` and the connect route behave exactly as before without them. The
signed-in join path (`enterAsGuest`) still lands on the Event Hub, as its guard
pins. Guarded by `app/[slug]/invite/the-arrival-has-three-doors.test.ts`
(mutation-checked: 5/5 sabotages turn it red); the two new doors are listed in
`doors-are-designed.test.ts`.

SPEC IMPACT: builds `0000_ADDENDUM_invite_join_model_2026-06-25.md` §3 (role
picker removed) and records the 2026-09-10 invite-arrival decision — DECISION_LOG
row added in the corpus.
