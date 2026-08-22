## 2026-08-20 · fix(guests): the Invite step reports the link, not a count that could never fall

The guest list's progress ribbon has four steps. Three count real rows and move as
the couple works — guests to review, guests to seat, guests who arrived. The
fourth read **"32 to send"** and would have read "32 to send" forever.

It counted guests whose `guests.invitation_sent_at` is null, and **nothing anywhere
writes that column**: not this repo, not a migration, and not any function in the
production schema. All three were checked independently; **0 of 35 live guests are
stamped**.

🔑 **It was not a missing write — the feature does not exist.** This product has no
per-guest send to stamp. The Invite stage hands out **one** link for everybody; the
save-the-date fan-out has its own separate `std_email_sent_at`, and this column's
own migration describes it as *"the later formal RSVP invitation"*, which was never
built. **Stamping it would have been a lie in the other direction** — it would have
claimed we sent something to each guest.

🔑 **The family this belongs to — a gate with no handle, in reverse.** Elsewhere a
column had no writer, so a feature was silently inert; here a column had no writer,
so a **number was silently permanent**. Both look completely fine on screen, both
typecheck, and neither logs anything. **A count over a column nobody writes is not
a measurement, it is a constant wearing a number's clothes.**

**What it says now.** The one thing that stage genuinely has is binary: can the
shared link be handed out, or does it open to *"Link not found"*? The page already
knows without another read — `fetchJoinUrl` asks `sharedJoinLinkState` and returns
null when the event has no address, is still private, or its token was revoked. So
the step is silent when the link works and says **"link not working"** when it does
not, which is real outstanding work and is exactly what the invite page one tap
away explains in full sentences. The dead read is deleted outright — one fewer
Singapore round-trip.

⚖ **`inviteLinkReady` defaults TRUE, deliberately.** A caller that has not measured
must not paint a warning over a link that is probably fine; absence of a
measurement is not a fault. The opposite direction is chosen elsewhere on purpose
(`canOpenShop` fails closed, because being wrong there is permanent). Both are
recorded beside their code; they are not to be harmonised.

Guard — `lib/the-invite-step-counts-what-is-true.test.ts`, 4 assertions: nothing
filters the guest list on the dead column; the column still has no writer (in code
**or** migrations) and says what to do if that ever changes; the Invite step reports
the link rather than a phantom count; and the default stays true.

🪤 **Its writer arm was a file-level check on the first run and cried wolf
immediately.** It reported `dashboard/[eventId]/sponsors/actions.ts` — which writes
`event_sponsors.invitation_sent_at` on one line and, ninety lines later, happens to
read `.from('guests')` for something unrelated. Two queries, one file, one
confident false alarm. `event_moderators` and `event_sponsors` both have their own
legitimately-written column of this exact name. Every scan now walks forward from
`.from('guests')` to the end of that chain and looks only inside it, because a
guard that cries wolf teaches you to skim past the one time it is right.

Mutations, each confirmed to have LANDED by occurrence count: restoring the phantom
badge (1→0) 🔴 · defaulting the warning ON (1→0) 🔴 · restoring the dead read (1→2)
🔴 · a real guests-table writer appearing (1→2) 🔴 *(flips two arms, as intended)* ·
and the sponsors false-positive staying quiet 🟢. Full suite 8827 passing,
typecheck exit 0, lint clean.

SPEC IMPACT: None
