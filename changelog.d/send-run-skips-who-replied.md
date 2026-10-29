## 2026-10-29 · fix(guests): the send run counts only who is left to invite

Owner, live on his own event (iPhone app): the send run read "95 sent · 105 more to invite · INVITE 104 OF 200" and
walked him to *Kat Arroyo · Attending*. The one "to invite" rule (`isToInvite`, `lib/guest-roster-view.ts`) was
*may be invited + no `invitation_sent_at` stamp* — it never read the reply, so a guest who answered without a stamp
(marked Attending by the host, replied through the one link, sent from outside the run) stayed in every "to invite"
count and in the run's queue. The row's own pill already said Attending; only the count disagreed.

- `isToInvite` now also requires **no answer** (`hasReplied`: any reply but `pending` — Attending, Maybe, Can't come).
  One rule, so the List's "To invite" and its door, "Pick who", Setup's "Send to N", Home's "Send N invitations" and
  the run all drop answered guests together. They can still be SENT one (their row's Share; `mayBeInvited` unchanged).
- The run (`send-run.tsx`): its queue, "N more to invite" and "Invite k of N" count only who is still to invite;
  "Invite k of N" is now k of who is LEFT, never of everyone. A guest who answers while the run is open is stepped
  over like one who declined. A run opened on chosen guests (`?ids=`, new `picked` prop) walks each of them — sent or
  answered too — but never counts them as "to invite".
- A row's Share was already that guest's own share (`rowShare` → the phone's share sheet / the cell's sheet); it never
  navigates to the run. Now fenced.

Guarded by `apps/web/lib/the-run-counts-only-who-is-left.test.ts` (owner-shaped roster: 200 · 95 sent · 43 answered
unstamped · 62 left; sabotaged red four ways) and the updated `lib/to-invite-is-one-rule.test.ts`.

SPEC IMPACT: DECISION_LOG row 2026-10-29 "TO INVITE NO LONGER COUNTS A GUEST WHO ALREADY ANSWERED" — amends the
2026-10-08 "To invite has ONE definition" (no invitation sent, not declined, not a celebrant → + has not answered).
