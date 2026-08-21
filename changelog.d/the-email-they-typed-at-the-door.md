## 2026-08-21 · fix(join): the email a guest types at the invite door is written down

The shared "Invite guests" QR opens `/{slug}/invite`, which asks for
**"Email (optional)"**. That address was used to send a passwordless sign-in link
and **never written to the guest row** — so the host, whose own guest page carries
an Email box, never received it, and the reply card asked the same person for the
same address again thirty seconds later.

Owner, 2026-08-21, on that door: *"there should be a content here already"* — and,
all day: stop asking for what the app already knows.

- A guest who **adds themselves** keeps the address on the row they just created.
- A guest **matched to an existing seat** can only **fill a blank**. That row was
  written by the HOST, and the token reaching that branch is printed on a poster,
  so an address the host already has must not be replaceable by whoever scanned it.
  🔑 The safeguard is `.is('email', null)` in the statement itself, not only the
  app-side `!match.candidate.email` — a database-side no-op survives a future
  edit that forgets the app check.
- The **signed-in** path deliberately stores nothing here: that person's address is
  already on their account and the reply card prefills from it. Two copies of one
  fact is how they drift. A guard asserts `admitAsUnlisted` never grows an email
  argument without someone first deciding which source wins.

🪤 **Both new guards were anchored on a string that appears twice** and failed on
their first run for the wrong reason: `entry_source: 'self_added_unlisted'` is
written by BOTH join paths, and the first occurrence of `self_join_bound_seed` is
inside `recordJoinScan`'s own type signature, not at the call site. Re-anchored to
`selfJoinAction`'s body and to the CALL.

4 sabotages, all landed by occurrence count, all RED. 9352 unit tests green.

SPEC IMPACT: None.
