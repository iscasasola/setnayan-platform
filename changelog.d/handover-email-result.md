## 2026-07-17 · fix(people): "Email it" surfaces real send outcomes (no silent success)

`emailHandoverLink` ignored `sendEmail`'s result — with no Resend key configured (the prod Integration Console slot is currently empty), the action redirected to "saved" while no email left, and the guardian would wait on a message that never existed. The action now checks the result and surfaces it: `email_not_configured` points an admin at Admin → Integrations (and reminds the guardian the copy-link button still works); provider errors read "didn't send — try again or copy the link." Also adds the missing human copy for the hand-over error keys (`email`, `no_active_link`, `not_of_age`).

SPEC IMPACT: None
