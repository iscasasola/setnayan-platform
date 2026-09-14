## 2026-09-14 · feat(access): a delegate's access ends seven days after the event

Owner: "coordinators will only have access until event day. but no access
after." Asked what happens to wrap-up work: **"grace period until 7 days after
event"**.

**Nothing expired a delegate before this.** `resolveAreaLevel` has ~38 call
sites and not one consults a date; `event_moderators.invitation_expires_at`
expires the INVITE LINK, never the access it granted. A planner hired for one
wedding kept the guest list, the seat plan, the schedule, the suppliers and the
invitations — with every guest's name, email and mobile — indefinitely.

🔑 THERE WAS NO SINGLE CHOKEPOINT, AND THAT IS THE WHOLE DIFFICULTY. FIVE files
read `event_moderators.permissions_json`: `event-viewer.server.ts`,
`coordinator-broadcasts-server.ts`, `budget-visibility.ts`,
`run-of-show-advance.ts` and the schedule page. A window enforced in one is a
window four surfaces ignore — worse than none, because it READS as closed. One
pure rule (`delegate-access-window.ts`), one server helper that owns the read,
and a guard asserting all five import it. Sabotage-verified: unwiring any single
reader turns it red.

**Three refusals to guess, each from a real row in production:**
· `event_date IS NULL` on one live event — "not decided yet", never "long ago".
  A null date expires nobody, or a planner loses the event they are scheduling.
· `event_date_precision = 'year'` on another — its date is a placeholder in a
  year, not a day anyone marries on. Counting seven days from it would revoke a
  planner months early. Only a day-precise date closes a window.
· `event_end_date` anchors multi-day events, so the count runs from the LAST
  day. Counting from the first would expire a three-day celebration early.

⚠ A REFUSED DATE READ LEAVES THE WINDOW OPEN — the opposite of the fail-closed
instinct governing the identity reads beside it, deliberately. Being one read
late to revoke is recoverable; locking a coordinator out mid-event is not.

The COUPLE never expire, and the read is skipped entirely for them.

SPEC IMPACT: New access rule, owner-set 2026-09-14. Recorded verbatim in
`lib/delegate-access-window.ts`.

## 2026-09-14 · fix(access): the window helper drops `server-only`

Marking `delegate-access-window.server.ts` with `import 'server-only'` broke
THREE existing suites — `budget-visibility.test.ts`,
`run-of-show-advance.test.ts` and `stage-notes-event-side.test.ts` — with
"Cannot find module 'server-only'". `tsx --test` cannot resolve that marker, so
any file importing this one became unloadable BY ITS OWN TEST, and the failure
is a module-resolution error that says nothing about access windows.

Both consumers are unmarked for exactly that reason. The marker out-ranked the
layer it serves.

🔒 What keeps it server-side instead: it holds no credentials and reads no env —
THE CLIENT IS A PARAMETER, so it can only reach what its caller could already
reach. If it ever grows an ambient admin client or an env read, the marker comes
back and its consumers must stop importing it directly. That condition is
written at the top of the file.

Also repinned `stage-notes-event-side.test.ts`: its gate assertion pinned the
EXPRESSION'S SHAPE (an inline, multi-line `resolveAreaLevel(...)`), and hoisting
that argument into a variable — so the window could be applied BEFORE the area
question — broke a regex while preserving exactly what it protects. Now pinned
to the MEANING: both branches present, still asking for schedule:'edit'.
Sabotage-verified two ways — dropping the host branch goes red, and asking for
the wrong area goes red.

🔑 The process failure, not the code one: I ran only my own new test locally and
let CI find the other three. The full suite (15,642 pass) is the check that
should have run before the previous push.
