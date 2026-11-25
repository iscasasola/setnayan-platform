## 2026-11-25 · fix(area 7): final-check lane A batch 1 — 3D demo, venue walk, Spaces, seat plan, workspace money words

Final check (25 Nov), area 7 (coordinator, Spaces, maps), lane A — no screen redesign, each fix names its finding:

- A7-03 — an expired 3D demo code points to the demo room (`/pa3d/try`, new `routes.pa3d`) with one button; a failed guests read says "We couldn't open this demo" with Try again instead of "expired".
- A7-04 — the demo guest line no longer promises the walk to "every real Setnayan guest".
- A7-28 — /pa3d calls the sample room a sample; /pa3d/try says it once (`Pa3dRoom introduced`), title "Stand in a sample reception."
- A7-06 — "Tap any seated guest": a failed code says "Couldn't make their code" with Try again.
- A7-02 — the venue walk's "Try again" keeps the guest's `?t=` token.
- A7-13 — Spaces: a refused date read keeps the old day's heading and says the day couldn't be read (never "Saved, but…").
- A7-30 — Spaces: a refused save shows its reason inside the sheet (it was drawn behind it).
- A7-31 — Spaces: the empty state offers one "Add a space" button.
- A7-14 — Spaces: both locks show the Plus price from the catalogue (`getVendorPrices` + `monthlyPlanPrice`).
- A7-29 — the supplier's "not confirmed on Setnayan yet" lock has one button into the client's chat.
- A7-33 — no "Amount to pay: Next payment" line without a peso; stored method codes read as words ("Bank transfer").
- A7-10 — the couple's 2D seat plan and 3D room stop on a refused floor-plan / fixtures / signs read (`fetch*Measured`).

Tests: `lib/amount-to-pay.test.ts` (new case), `lib/payment-method-words.test.ts`, `app/dashboard/[eventId]/seating/floor-plan-read-is-honest.test.ts`.

SPEC IMPACT: None — fixes to already-drawn pages, words and honest states only.
