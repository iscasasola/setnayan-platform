## 2026-10-22 · fix(legal): the refund page says what the owner ruled — no refunds; a service you cannot use becomes Papic credits

The public `/refunds` page promised a "full refund" before activation and
whenever Setnayan failed to deliver, and the Terms repeated it; Live Watch's
setup and controller said "refunds follow the standard 24-hour SLA". The owner
ruled on 2026-10-08 (reaffirmed 2026-10-22, "yes") that Setnayan does not pay
money back: a paid service the buyer cannot use waits for their next event if
unused, otherwise its value becomes Papic credits for the event. This is the
WORDING only — `app/(shell)/refunds/page.tsx`, the refund line in
`app/(shell)/terms/page.tsx`, three lines in
`app/dashboard/[eventId]/studio/{live-studio-control,panood/setup}/page.tsx`,
and one `/llms.txt` answer. The admin refund tools are untouched (kept for
Apple and legal edge cases). Kept on the page: a double or mistaken charge is
returned (it is not a purchase), Apple handles refunds for anything bought
through Apple, and the Consumer Act (RA 7394) line. Held as a draft until the
owner approves the exact words.

SPEC IMPACT: None in this PR — the ruling rows were added to the corpus
`DECISION_LOG.md` (2026-10-22) by the same session.
