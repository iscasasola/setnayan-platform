## 2026-08-12 · fix(auth): "forgot my password" no longer says a link was sent when none was

**A pre-flip blocker, fixed while it is still inert.** `/forgot-password` deliberately
collapses every error to the neutral *"if that email exists, we've sent a link"* so the page
can never be used to discover whether an account exists. **That rule is correct and is
unchanged.** But the same fallthrough also swallowed a **failed bot check** — so the moment
captcha is switched on, a real person who fails it would be told a link was sent, and nothing
would be sent.

That lands on **the one page someone reaches when they already cannot get into their account**,
and the failure is silent on both sides: no email, no error, no reason to try again.

🔑 **A captcha failure is the one error here that is safe to name.** GoTrue rejects the request
**before any account lookup**, so saying "the bot check didn't pass" reveals nothing about
whether the email is registered. It is precisely the error that must *not* hide behind the
neutral confirmation.

- New `isCaptchaVerificationError` in `lib/account-security.ts`, a sibling of the existing
  `isAuthRateLimitError` and following its shape.
- `/forgot-password` checks it **before** the neutral fallthrough and redirects to
  `?error=captcha`; the page renders honest copy that does **not** claim anything was sent.

⚠ **Matched on the message, not the status — deliberately narrower.** A failed check is a
`400`, and so are `User not found` and several other errors that **must** stay neutral. Matching
the status would have quietly turned this page into an account-existence oracle. There is a test
asserting exactly that, and it fails if anyone widens the match.

**Inert today** — no site key means no captcha means this error cannot occur. It exists so the
page is honest the moment the owner turns the bot check on.

**Mutation-tested, both directions:**
- widening the helper to match status `400` → **2 tests fail** (the enumeration guard)
- deleting the captcha branch from the action → **1 test fails** (the wiring guard)
- restored → 11/11 green

The wiring is asserted against source because a correct helper proves nothing if nothing calls
it — and it asserts the branch sits **before** the neutral redirect, since after it the branch
could never fire.

Verified: typecheck clean · 7,654 unit tests pass.

SPEC IMPACT: None.
