## 2026-09-20 · fix(pay): the reference stops fusing to its own label

Owner's screenshot of the Papic payment screen read **"YOUR REFERENCESNCNJ1E3Y8"**
— the reference code run together with the label above it, on the one screen
where a payer has to copy a string correctly.

Not a screenshot artefact: `.sn-eye` is `display: inline-flex` (globals.css), so
`<p className="sn-eye">Your reference</p>` stays inline and the `<code>` beside
it butts straight against it. Everywhere else in the app `sn-eye` is followed by
a block element, which is why this was the only place it showed.

- `app/pay/[reference]/page.tsx` — the label and the code are both `block`.
- `app/pay/one-payment-page.test.ts` — a guard that pins BOTH halves: the label
  carries `block`, and `.sn-eye` is still `inline-flex`. If the CSS ever changes,
  whoever changes it is told the `block` is dead weight rather than leaving a
  defensive class nobody dares remove.

SPEC IMPACT: None.
