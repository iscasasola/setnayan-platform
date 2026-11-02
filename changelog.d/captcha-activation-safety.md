## 2026-08-12 · fix(auth): the bot check no longer locks people out on the day it is switched on

Third pass on the captcha work (after #4352 and #4371). An adversarial review of
those two PRs found that the holes were genuinely closed but the *activation day*
was not safe, and that the guards written to hold them shut had five ways to stay
green over a real hole. Three of those were reproduced by hand before fixing.

Still inert: no site key is set, so none of this changes anything for anyone today.

### Five ways a real person was still going to get stuck

**1 · A refused crew member was told their invitation was dead.** A captcha
refusal on the Papic seat claim and the Live Studio camera join redirected to
`?state=error`, which renders *"This link isn't active — ask the host for your
latest link"* — a terminal screen with no form and no retry. Their link was
perfect; the most ordinary way to hit it is tapping a second before the check
finishes. Refusals now route to a distinct retryable state that keeps the form and
says what happened. `isCaptchaRefusal()` (new, in `lib/turnstile.ts`) tells the two
apart and **fails toward the harsher screen**, never toward letting someone in.

**2 · The token is single-use, and a failed submit did not mint a new one.** Every
one of these forms is a server action ending in `redirect()` back to the same
route — an RSC navigation, not a page load, so `<TurnstileField>`'s effect never
re-ran and the hidden input still held the token the server had just consumed.
Second attempt fails no matter what you type. The field now spends its token
locally on form submit and asks Cloudflare for a fresh one. (`submit` fires after
the browser has serialised the POST, so this cannot rob the in-flight request.)

**3 · Nothing waited for the check before the button worked.** Combined with 1+2
this is now a single clear retry that succeeds, rather than a silent refusal.

**4 · The signup follow-through, corrected in the DOC not the code.** The waiver is
unchanged and still correct — but `OWNER_ACTIONS.md` said all five post-flip test
flows "should behave normally", which contradicts our own waiver. It now says
plainly that new signups will be asked for their password once more, and why.

**5 · Preview and local builds would stop letting anyone in.** Supabase's switch is
per-project, so every environment pointed at it demands a stamp the moment it is
flipped, and previews have no site key. `OWNER_ACTIONS.md` now documents
Cloudflare's non-production testing key for Preview/Development, with an explicit
warning never to use it in Production.

### The guards had five holes; all closed, each mutation-tested

- **The widget only had to be in the same FILE, not inside the form.** Moving it
  one line above the opening `<form>` kept the suite green — and a hidden input
  outside its form is never submitted. That is the original bug passing the test
  written to catch it. Now checked against the form body.
- **Three of the five anonymous paths had no coverage at all** — the ones where the
  token is minted by a client tap rather than posted as a form field (guest camera
  pick, and both onboarding funnels). Deleting a mint left everything green. New
  test: any module that spends a token it did not read off a form must have a
  caller that mints one, resolved through the real import graph.
- **Four genuinely gated methods were missing from the list** — `verifyOtp`,
  `signInWithIdToken`, `signInWithSSO` added. `reauthenticate` deliberately NOT
  added: supabase-js declares it with no parameters, so it cannot carry a token and
  listing it would make the guard cry wolf.
- **`csp-embeds-are-allowed.test.ts` claimed "NO SILENT CAP" and was undercounting
  itself** — 9 iframe files exist, only 6 were accounted for. Three were dropped by
  a branch that assumed "no absolute URL found" means "same-origin". All 9 are now
  named. (Checked by hand: all three are safe — one YouTube, two same-origin.)

### Verified

12 guard assertions green · 7689 unit tests · `tsc --noEmit` clean · eslint +
16 lint scripts clean. Every new assertion broken on purpose and confirmed red,
with the sabotage verified as applied first.

SPEC IMPACT: None — no product behaviour, pricing, SKU or schema change.
