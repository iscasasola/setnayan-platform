## 2026-09-20 · fix(pay): the verifying screen carries a way back to the celebration

Owner, looking at his own `/pay/<ref>` screen after logging a payment: *"after
paying, there is no way to return to that event overview."*

`payable.back` had always rendered — as a small underlined link ABOVE the first
tile. By the time somebody has read what they bought, the amount, the reference
and the "We're verifying your purchase" card, that link is off the top of the
screen, and `/pay` carries no site chrome (SiteChrome self-gates to the
marketing routes). Past that point the browser's back button was the whole of
the navigation.

One of the two flows already had the fix and the other did not: `setup &&
waiting` drew a "Finish setting up" button at the bottom, so the buyer who paid
during onboarding was handed back to their celebration and the buyer who paid
from inside it was left staring at a card. The exit is now gated on `waiting`
itself, with the set-up arm unchanged and the ordinary arm built from the same
`payable.back` the top link uses — never a second spelling of where this buyer
came from (a hard-coded `/dashboard` would send a supplier who paid on a
couple-scoped order to the wrong place).

- `apps/web/app/pay/[reference]/page.tsx` — one exit, two arms, gated on `waiting`.
- `apps/web/app/pay/the-waiting-page-is-not-a-dead-end.test.ts` — new guard:
  the exit is not re-gated on `setup`, both arms carry a destination, and the
  ordinary arm reuses `payable.back`. Proven red under three sabotages
  (re-gate on `setup`; delete the ordinary arm; hard-code its href).
- `apps/web/app/pay/onboarding-ends-when-the-bill-is-settled.test.ts` — the
  assertion that pinned the old `{setup && waiting && payable.eventId && (`
  spelling now pins the new one. Same door, same words, one more person
  reaches it.

SPEC IMPACT: None — no priced item, schema or locked decision moves; this is an
exit that was present in one flow and absent in the other.
