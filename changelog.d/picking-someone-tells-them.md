## 2026-08-29 · fix(vendor): picking someone off the waitlist tells them

A shop presses **"pick this couple"**, the screen says it worked, a timestamp is written — and the
person it happened to learns nothing.

**🔑 THE NOTIFYING WAS NOT MISSING, IT WAS ASYMMETRIC.** Three entry points already ship and all
three say *"a slot opened"*: the shop's one-click notify, the automatic one when a booking is
released, and the email both send. Each flips every `pending` row for a date to `notified` and
emails **every** couple waiting on it. Somebody reading this area sees a well-notified feature.

**The PICK was the one waitlist event with no message** — and it is the half that is time-critical,
because `max_waitlist_acceptances` lets the shop pick somebody else. A couple who is never told can
lose a date that was being held for them.

**And the silence was invisible from the couple's side too.** Their own view queried
`status IN ('pending','notified')` and never read `accepted_at` — and the pick writes `accepted_at`
while leaving `status` alone — so after being chosen they still read *"You're on the waitlist for
this date — we'll email you the moment it opens up."*

**What ships:**

- A `waitlist_picked` notification type (enum + union + label + tone), emitted to the picked
  couple, **naming the date in the notice itself** — a notice that makes somebody open a page to
  find out which date is a notice that waits until they have time.
- It is on the email allowlist. Transactional, not marketing.
- Their shop page now says *"{Shop} has kept this date for you. Message them to book it."*
  ⛔ **Held, never "yours"** — the shop may pick more than one couple and nothing here books
  anything; promising more would be a promise the product cannot keep.

**Care taken:** the notify runs **after** the write and is best-effort — a notifier that threw would
roll a real decision back over a message — but it is **reported**, never swallowed, because a
swallowed error is how the silence came back. The date is formatted with the venue's `+08:00`
anchor; `new Date` on a bare DATE reads the day before anywhere west of Greenwich.

🪤 **One of my own guards was decoration and mutation caught it:** the anchor check matched the
file, and `actions.ts` carries a second `+08:00` (a schedule block's `blocked_at`), so dropping the
one that mattered left 1 of 2 standing and the test stayed green. Scoped to the formatter's own
body. *A file-level count cannot say which site.*

🔢 **Safe by arithmetic:** production holds **zero** waitlist rows — none ever created, picked or
notified — and **zero** shops have the waitlist switched on. Nobody has been harmed by the silence,
and this sends nothing to anybody today.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-29. Closes the item that kept a `Waitlist` group off the new
Customers roster — a chip whose only action is silent is a fake door.
