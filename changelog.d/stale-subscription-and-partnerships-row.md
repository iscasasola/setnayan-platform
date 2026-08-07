## 2026-08-05 · fix(admin): a stale upgrade can no longer demote a vendor, and Partnerships stops showing a deadline nobody can meet

**1 · 🚨 APPROVING A STALE SUBSCRIPTION SILENTLY DOWNGRADED A PAYING VENDOR.**
`approve_vendor_subscription` writes `tier_state = <the purchase's tier>`
unconditionally. A vendor who starts a Pro upgrade, never pays, then later buys
and pays for Enterprise leaves the Pro row at `pending_payment` forever. One tap
on it puts them back to **Pro** — Enterprise features gone, and neither the admin
nor the vendor is told. The expiry stacks, so the clock looks healthy; only the
tier drops. **Live on the page today**, not introduced by this week's work.

🔑 **A STALE ROW IS NOT A DECISION ABOUT TODAY.** It records what somebody wanted
weeks ago; applying it blind overwrites a LATER, PAID decision with an earlier,
unpaid one.

Fixed **at the database**, as a trigger on the profile rather than inside the
approve function — there are TWO writers (the admin action and a webhook entry
point) and a guard in one leaves the other open. The webhook is the one nobody
is watching. Upgrades, same-tier renewals and activations over a LAPSED higher
tier all pass untouched; a deliberate downgrade needs a per-statement
acknowledgement, so the default stays closed.

**2 · PARTNERSHIPS PROMISED SOMETHING NO ADMIN COULD DELIVER.** The queue carried
a 72-hour clock, but its rows wait on the RECIPIENT VENDOR to accept or decline —
the only admin control is a veto. No admin action could ever meet that deadline,
so every solo admin was shown a permanently red past-promise row. **The same
noise that got payouts taken off this list, arriving by a different route.**

`slaHours` can now be `null` = *this queue has no clock, because the admin is not
who clears it.* The row still shows its count, so nothing is hidden; it just
stops claiming a promise nobody made. A test names Partnerships as the ONLY
clockless queue, so "no clock" stays an argued exception rather than a habit.

Both mutation-checked. The tier guard is tested against a real replayed database
because the rule lives in SQL and a TypeScript test would prove nothing about
the webhook path.

SPEC IMPACT: None.
