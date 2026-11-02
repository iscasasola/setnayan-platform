## 2026-09-22 · feat(invitation): CTRL-B4 — the invitation actually reaches a guest

Re-measured 2026-09-22: **146 guests · 0 with `invitation_sent_at` · 5 with an email · 0 with a
mobile and no email.** So 141 of 146 are reachable by no channel at all, and the couple's Invite step
could never complete. (The register said 142/2/1 — re-measure, never quote.)

### 1 — bulk "mark as given"

A couple handing out printed invitations faced **146 individual toggles**.

🔑 **RULE 0: `markGuestInvitationSent` is already correct** — it counts its rows, refuses silent
success, carries the undo. `markGuestsInvitationSent` is that same statement with `.in()` instead of
`.eq()`, not a second writer, and the guard asserts they share the shape.

⚠ **The count shown is the count WRITTEN.** A zero-row UPDATE is success-shaped and a *partial* one
is worse: ask for 146, write 3, and a screen echoing the request tells the couple 143 people were
recorded who were not. Ids are de-duplicated so a double-submitted checkbox cannot make the two
counts disagree for a reason that has nothing to do with the database.

### 2 — send an invitation by email

**One mechanism, two messages.** `sendAndStamp` was extracted out of the save-the-date fan-out and is
now shared: the message differs (hold a day vs come), the fact does not — *was this email accepted?*

🔑 **The stamp is the load-bearing property.** `sendEmail()` returns
`{ok:false, reason:'not_configured'}` and **no-ops** without a Resend key, so stamping regardless
would mark all 146 guests invited on a day nothing left the building — permanently, with the
couple's own screen counting it as done. Three refusals, each named: no key → send and stamp
nothing; already stamped → skipped; no address → reported by `invitationReach`, not silently dropped.

⚠ **Deliberately NOT gated on `landing_page_visibility`**, unlike the save-the-date. The STD links a
page a stranger must be able to open; an invitation carries the guest's own link and a couple may
well invite before going public. Different rule, stated rather than copied.

### 3 — say the truth about who cannot be reached

A screen reporting only "marked" is a lie of omission when 141 people have no address. New pure
`lib/invitation-reach.ts` computes both numbers once, and the unreachable line renders **beside** the
marked count — a guard holds them within 1,200 characters of each other so a later change cannot keep
one and drop the other. It counts across the whole list, not only the unmarked: a guest handed a
printed card is still unreachable electronically.

Guards: `invitation-reach.test.ts` (executed), `the-invitation-says-who-it-cannot-reach.test.ts`,
`the-invitation-actually-reaches-a-guest.test.ts`. **11 sabotages confirmed red.**
🪤 One sabotage initially passed because `replace(…, 1)` mutated the *single* writer's `invite=failed`
instead of the bulk one — the guard was never tested until the mutation was scoped to the right
function.

SPEC IMPACT: None.
