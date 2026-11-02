## 2026-09-16 · feat(invitation): every guest gets their own invitation message

Owner asked whether a "Viber blast" was possible. The honest answer shaped the
build: **there is no Viber integration and this does not add one.** V1 has no
SMS and no chat API. What it has is *clipboard delivery* — the app writes the
message, a person pastes it — and that was already shipped **for sponsors**
(`invitation-template-modal.tsx`, whose own docblock says *"host pastes into
Messenger / Viber / email"*). **Guests had a single shared join link and nothing
else.** This is that pattern extended, not a new idea.

### 🔴 Why guests needed it

Measured on a real event: **75 of 77 guests have no email AND no mobile**;
exactly one has an email. So for **97% of that guest list there is no channel
the product can reach at all** — those invitations travel by Viber or by hand.

And nothing recorded that they had. `guests.invitation_sent_at` has existed for
months with **zero writers anywhere** — no TypeScript, no SQL. The guest list's
old *"N to send"* counted it and therefore **could never fall**; that count was
removed rather than faked, and a guard has stood over the dead column since,
carrying instructions for whoever finally wrote to it. **This is that writer.**

### What ships

- **`buildGuestInviteMessage`** — a pure builder. 🔑 **The message carries THAT
  guest's own invitation link.** A sponsor message is an asking; a guest message
  is a door.
- ⚠ **No link → NO MESSAGE.** The builder returns `null` and the modal then
  offers **no Copy button**, because a cheerful *"you're invited!"* that opens
  nothing is worse than silence — the couple only finds out after they have
  pressed send.
- **A modal per guest** — edit, copy, paste. It says plainly that Setnayan does
  not send it.
- **`markGuestInvitationSent`** — a **toggle**, not a latch: marking is a human
  claim about the physical world and people mis-tap; a mark that cannot be
  undone teaches couples not to use it. The update **counts rows**, since a
  zero-row PostgREST update returns no error.
- **A count that can finally fall** on the invitation page: *"12 of 77 marked as
  handed out."*

### ⚖ The greeting is the FIRST name — and that is a decision, not a default

Deliberate contrast with `printedCardName` (shipped hours earlier), which puts
the **formal** name on the printed card. *"Dear Atty. Indalecio Subia Casasola
II"* reads like a summons in a Viber thread. **The surface decides, every time.**

### The guard was inverted, not deleted

`the-invite-step-counts-what-is-true.test.ts` asserted *zero* writers. It now
pins **exactly one** — because the original defect has a twin: a **second**
writer (a fan-out stamping every row) would make the number fall **without
anybody handing anything to anybody**. Same lie, opposite direction.

Its other test was replaced with the risk that actually moved one step along:
🔑 **the count must say "marked", never "sent"** — Setnayan delivers none of
these, and *"40 sent"* would be the product taking credit for forty acts it did
not perform.

⚠ **An earlier version of that assertion matched a single phrase, and rewording
two of the summary's three branches left it GREEN.** It now slices the whole
block and faces every branch.

### Sabotage-checked

writer removed → **9/1** · second writer planted → **9/1** · all three branches
relabelled "sent" → **9/1** · **only two of three relabelled → 9/1** (the case
the weak assertion let through) · link dropped from the message → **7/3** ·
restored → **10/10**.

### Deliberately NOT done

The guest list's Invite step keeps reporting whether the **shared link** works.
That is still what that stage does; the count of who has been handed their own
invitation belongs on the invitation page, where the sending happens.

SPEC IMPACT: first writer for `guests.invitation_sent_at`; row in
`DECISION_LOG.md`.
