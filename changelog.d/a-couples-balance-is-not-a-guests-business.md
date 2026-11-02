## 2026-09-14 · fix(papic): a couple's credit balance is not a guest's business

**PRIV-1.** Three surfaces printed a celebration's remaining Papic credits to
somebody who is not a member of that celebration:

- `/papic/seat/[token]` — "Running low — about N credits left for this event."
  The page's own comment says the claimer isn't an event member; a seat token is
  what a guest is handed at the table.
- `/papic/guest` — "N left for everyone", to a visitor whose whole identity is
  the `setnayan_guest_session` cookie. No sign-in at all.
- `/[slug]` — the same camera component, mounted inline on the public
  celebration page.

Owner's ruling (DECISION_LOG.md, Part A): a credit balance shown to a stranger
must be hidden — it is the couple's money.

**The figure is gone from the wire, not just from the pixels.** On the two guest
surfaces it was a prop on a client component, so it was serialized into the RSC
payload of a public page on every render — low pot or healthy, drawn or not —
and readable from view-source on the days the pill never appeared. On the seat
surface it came back in the server-action response on every successful capture.
So `EventPoolSignal` lost `remaining` + `total`, `GuestQuota` and
`GuestPapicCamera` lost `poolRemaining`, and the camera's `Props` lost it too.
A figure that cannot arrive cannot be printed by any future edit to any JSX.

**The warning stays; only the number goes.** A guest does need to know to wind
down. The seat camera now says "Running low — this celebration's credits are
nearly spent. Make the next few count."; the guest pill says "Running low for
everyone". The guest's PERSONAL counter — her own 150, or the ceiling the couple
set on her — is untouched: that number is hers.

**Not an oracle.** The figure is removed unconditionally, never suppressed only
while the pot is low — a number withheld in one state makes its own absence the
answer. No reader of these surfaces gets a figure in any state.

Legitimate readers are untouched: the couple and coordinator keep the real
number on `/dashboard/[eventId]/studio/papic`. The marketing figure on
`/(shell)/papic` is the platform-wide free grant, not any couple's balance, and
was verified and left alone.

Guarded by `apps/web/lib/papic-pool-balance-is-the-couples.test.ts` — per
surface, anchored on each declaration's own braces, asserting counts and naming
the surface in every message. Two assertions in
`papic-guest-quota-mirrors-sql.test.ts` that REQUIRED the balance field were
inverted (not deleted) to forbid it.

SPEC IMPACT: None — implements a decision already recorded in DECISION_LOG.md
Part A (2026-09-14); no new spec claim.
