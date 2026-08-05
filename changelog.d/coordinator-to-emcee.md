## 2026-08-05 · feat: a coordinator can send a note to the host, without seeing anything else

You asked for coordinators to be able to message the emcee. The emcee couldn't
read anything a coordinator sends, so building that message box as it stood
would have produced a box that was always empty.

The obvious way to fix that was to make the emcee a member of the event. I
didn't do that. A member can read the couple's private notes on their own
schedule — the *don't mention the surprise yet* kind, which exist precisely
because they're not for saying out loud. Handing a supplier the whole event to
fix a messaging gap gives away far more than what was asked for.

So a note is **addressed**. The coordinator writes to the host, and the host
sees that note and nothing else. On their side it appears above their script,
because a note from the coordinator is nearly always a change to what happens
next — "hold the toast, the father is still parking" is useless if you find it
afterwards. They tap "Got it", and the coordinator sees it landed.

The send box only appears on events that actually have a host booked. A control
addressed to nobody is a promise the product can't keep.

Only the host can mark a note as seen — the sender can't stamp their own note
read. A receipt you can forge isn't a receipt.

SPEC IMPACT: DECISION_LOG row — coordinator→emcee is an addressed channel;
granting the emcee event-member access was considered and rejected.
