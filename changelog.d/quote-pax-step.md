## 2026-09-11 · fix(quote): a 200-guest couple could not be quoted

`proposal-maker.tsx`'s pax field was `type="number" min={1} step={10}`. HTML
number validity only accepts `min + k*step`, so the only valid values were
1, 11, 21 … 191, 201 — every round guest count (100, 150, 200) was refused by
the browser ("the two nearest valid values are 191 and 201"), and the field
is seeded from the couple's live pax count, so an ordinary round-number
wedding could never be quoted. Fixed to `step={1}` so every whole number from
1 up is valid.

Audited every `type="number"` input in `proposal-maker.tsx`, the send-proposal
card, and the vendor-side quote/payment-schedule builders for the same
min/step mismatch shape; no other instance found. Added
`apps/web/lib/number-input-step-guard.test.ts`, a source-scan test that parses
each `<input>` JSX tag's own `min`/`step` attributes (brace/quote-aware tag
boundaries, decimal-safe divisibility — not a whole-file regex) and fails if
any literal `min`/`step` pair under `app/` isn't on the same lattice, unless
`min` is 0 or `step` is 1.

SPEC IMPACT: None
