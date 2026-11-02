## 2026-09-01 · feat(papic): challenges can be paused for the moments everybody must be watching

Owner, 2026-09-01, verbatim: *"instead of just stop. let us also allow pause for
the challenge. so challenges can all be not available on moments everybody must
be watching."* The vows, the first kiss, a parent's speech — nobody should be
hunting a stranger for a selfie during them.

**Pause is not stop, and neither of them is hide — three different acts.**
*Hide* (`papic_missions.is_active = false`) takes ONE challenge off every board
for good. *Stop* (`papic_stop_challenge()`, shipping in parallel) ends the ONE
armed prompt while every challenge stays answerable. *Pause* quiets the WHOLE
board, for every guest, temporarily, and gives it back untouched. Pause is the
only one that is both temporary and event-wide, which is why neither of the
others can express it: hiding ten challenges to quiet a room and un-hiding them
afterwards is ten destructive writes to undo a two-minute silence, and any one
of them failing leaves a couple's board permanently wrong.

**🔴 It closes prompts. It does not close the shutter.** The first kiss is the
most photographed second of the day; a pause that stopped the camera would
silence the challenges by throwing away the pictures the product exists to
collect. No capture path reads it — asserted against the shipped function
bodies, not against a comment.

**⚠ And it does not empty anybody's board.** Owner's ruling on what a paused
guest sees: the board STAYS, with a notice over it. `papic_guest_missions` is
untouched, the route sends the missions AND the flag, and the panel renders
*"Challenges are paused — everyone's watching right now. Keep taking photos;
these come back in a moment."* A db case asserts the guest's board is
**byte-identical** across a pause — which is what keeps out the cheapest
implementation, teaching the board reader to return nothing. An empty board is
byte-identical to a celebration that set no challenges up, and shipping "not
available" as an ABSENCE is this project's signature defect.

**Fails to RUNNING, deliberately.** An unreadable pause state resolving to
PAUSED would silence every guest's board on a network blip, at a party, for a
reason nobody could see. Resolving to running costs a courtesy, not a
celebration — the same direction as "closes the prompt, never the shutter". The
coordinator's control still shows three states, because "we couldn't check" is
not "running".

**Manual only** (owner). No duration, nothing resumes on its own, and a unit
test refuses a clock in the module — `papic_challenges_paused_at` is an anchor
with nothing derived from it. The form posts explicit intent rather than
toggling off the rendered state, so two taps on a slow connection cannot resume
the pause they just started.

🪤 **`lint-events-column-grants.mjs` caught a second half I did not know about.**
A new `events` column needs its own `GRANT SELECT`/`GRANT UPDATE` — the table
re-grants a computed column allowlist at apply time, so the PGlite replay
recomputes it and cannot catch a missing grant. It also needs
`public.events_host` REBUILT, because that view has an explicit column
projection and `/dashboard/[eventId]/details` throws on a query error:
`site_art_direction` was refused to every signed-in person for over a month
exactly this way. Both are in the migration, and a db case asserts the column is
not a phantom on the view.

Tests: 9 unit cases (the fail-open direction, the notice reaching the pixel, and
three separate refusals of the capture path) and 6 against a replayed database.
11753/11753 unit tests pass.

SPEC IMPACT: DECISION_LOG.md — pause is a new owner decision, and it is the
first thing that deliberately overrides "arming takes nothing off a guest's
board" for a bounded, reversible case.
