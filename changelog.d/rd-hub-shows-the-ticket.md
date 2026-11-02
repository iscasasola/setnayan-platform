## 2026-09-30 · feat(guest): the pass is the Digital ticket, on Me — Home drops the pass and its duplicates

Owner, verbatim, on the Event Hub's pass section (`#site-pass`): *"i thought this
will be the digital ticket"* — then: the ticket belongs on the guest's **Me** page
only; *"no seat plan on the digital ticket for the moment"*; *"the QR for each
guest must be ready also"*. DECISION_LOG row "THE GUEST'S PASS IS THE DIGITAL
TICKET, AND IT LIVES ON ME — NOT ON HOME".

- **Me shows the ticket card itself** (`GuestTicket`, first in the Me section): the
  same 1080 × 1440 PNG `/api/guest/pass-card` draws and "Save my ticket" saves —
  one source, shown at 300 CSS px in a reserved 3:4 box (no layout jump). A failed
  picture swaps to the plain code and says so (never an empty box). It carries
  `#site-pass`, so the day-of "Show your ticket" link lands on it and the Me "My QR"
  button stays hidden beside it. It follows the couple's "QR card" switch.
- **States reuse `passCardEligibility`**: accepted & coming → the ticket + "Show this
  at the door."; waiting in Requests → the "Request pending" ticket (the card route
  now serves it to that guest's own session only — hosts and everyone else still get
  the one 404); can't come → the one line, no ticket; none → nothing.
- **No table on the digital ticket** (`passCardPass` → `seat: null`; the kit no
  longer reads the seat plan). "It finds your table too." is gone.
- **The couple's ticket style is used** — the single and zip routes defaulted to
  Classic and never read `print_details.pass_design`; now `passCardDesignFor`.
- **Home drops** the pass section, the accepted "Your keepsake" (the after-event
  memento stays), the "Hi again · Your invitation summary" card (`GuestHubCard`
  deleted; its data shape stays), and the "Need to change your reply…" line whenever
  the top "You're going · Change" already opens the sheet.
- **Scan-trail opt-out** moves, unchanged, into the Your details sheet; it stays in
  the page body only when there is no sheet (RA 10173 — moved, never gone).
- **QR readiness** verified: every guest row is born with `qr_token` (column
  `NOT NULL UNIQUE DEFAULT`, no insert supplies its own); the ticket draws it in the
  event's own QR look and it opens that guest (`?invite=` → redeem).
- Guards: `the-hub-shows-the-ticket.test.ts` (renders every state; one source;
  mounted on Me, absent from Home; the ticket QR decodes at phone density for square
  and circle looks, every design and pending, and resolves to that guest). Re-pointed
  to the new truth, protection kept: scan-trail, reply-sheet reachability, first
  arrival, status word, one QR, one seat link, day-of lead, motion, pass facts,
  pass-card gate. `the-wake-never-celebrates` now uses the shared comment stripper
  (its hand-rolled one swallowed the salutation once a JSX comment moved).
- Port baseline regenerated (deliberate removals: the card's `find-my-table` and
  `welcome` quick links; the map stays in Everything else).

⚠ Measured: a **circle** QR on the **Photo poster** ticket does not decode at 1×
(desktop density); it does at 2× and 3× (phones) and in the saved file.
⚠ Open for the owner: the scan-trail notice says the record "is how this page knows
to welcome you when you first arrive" — that greeting was the removed card's.

SPEC IMPACT: `DECISION_LOG.md` — new row "THE GUEST'S PASS IS THE DIGITAL TICKET, AND
IT LIVES ON ME — NOT ON HOME" (owner quotes, states, the open scan-trail sentence).
