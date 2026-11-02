## 2026-09-23 · fix(e2e): the signup spec asserts a reachable email field, not the word "Email"

`tests/e2e/signup-routing.spec.ts` pinned `getByLabel(/^Email$/i)`. Its own docblock says the
property under test is that "the email field is reachable for keyboard-first signups" — but the
assertion made the *copy* the contract, so it went red the moment the card started saying
"Email address" instead of "Email".

Now matches the field's purpose (`/email/i`) and asserts `toHaveCount(1)`, so a looser matcher
cannot start passing against two controls or silently resolve the wrong one. Verified static:
`/signup` carries exactly four labelled controls — "Email address", "Create your password",
"I agree to the …", "Stay signed in" — and only one contains "email". The old strict matcher
passing on `main` is independent proof that no second email-labelled control is in that DOM.

SPEC IMPACT: None.
