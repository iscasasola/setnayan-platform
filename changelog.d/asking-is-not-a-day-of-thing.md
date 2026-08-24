## 2026-08-25 · fix(vendor): a coordinator can ask for access before the wedding, not only on it

The owner's rule for the guest list is *"only the owner of the event and
coordinator (by request)."* Every piece of the request half already shipped —
the coordinator's ask, the host's line-by-line answer, the grant it writes.

**The only screen that mounted the ask was the live floor console, and that page
redirects unless the booking is dated today.** So a planner working a wedding
for six months could not ask for the guest list until the morning of it — the
one day nobody wants to be waiting on an answer.

🔑 **A handle that exists for twenty-four hours is the gate-with-no-handle
family in a different costume.** Nothing was rebuilt: the same component, the
same action and the same host-side answering screen are now also mounted on the
supplier's client card, which has no day gate. Booked suppliers only, and the
action re-checks that server-side, so the new condition is a display rule and
not the gate.

Copy corrected in passing: the confirmation promised the tools would "appear
here", which was true on a console and false on a client card. It is mounted
twice now, so it says neither "here" nor "on the day".

3 mutations, measured by occurrence count before → after, all red — including
one that proves the premise itself (if the live console ever stops being
day-gated, the guard says so rather than quietly becoming redundant).

SPEC IMPACT: None.
