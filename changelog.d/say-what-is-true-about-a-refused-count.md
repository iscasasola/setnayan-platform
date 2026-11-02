## 2026-08-25 · fix(docs): say what is true about a refused count, and about who is reading

Last of the fixes from the adversarial audit. No behaviour changes except one
line of user-facing copy — the rest is sentences that were not true, each one
load-bearing because a reader stopped checking when they got to it.

**"`countGuestsByEvent` already returns `null` for a refused read."** It does
not. An RLS refusal arrives as `count: 0, error: null`; the `null` path covers a
query that *failed*, which is a different thing. So the finished-event summary
reads a wedding as having had nobody at it, for a delegate the couple never
shared the guest list with. The helper genuinely cannot tell the two apart —
only the caller can, by asking who is looking — so the fix is to say so at both
sites rather than to invent a distinction the layer does not have.

**"RLS scopes every read to the couple — a non-member gets null/empty."** Four
files. `events_moderator_read` admits every accepted delegate, so a helper
reaches all four. On the two seating exports it is load-bearing: a delegate
granted the seat plan alone downloads a complete-looking, empty caterer count
and print pack. **The gate is deliberately left as it is** — refusing on the
guest list would also strip the floor plan and the table signs from somebody the
couple *did* give the seat plan to, and that widening is not what the owner
ruled on.

🪤 **I nearly left the sentence in two of the four.** My first guard asserted
"at most two remain, and both are couple-only surfaces" — I had opened the two
seating routes and *assumed* the others were gated. Neither is. The guard now
requires zero, and it excludes itself from its own sweep, because its first run
reported the test file for quoting the sentence it bans.

**"The couple haven't shared…"** on the refusal notice, one day after the solemn
register shipped. There is no couple at a funeral, and fifteen of the sixteen
event types are not weddings. That screen has no access to the event's
terminology, so it now uses wording true for all of them.

3 mutations, measured before → after, all red. Unit suite 9934/9934.

SPEC IMPACT: None.
