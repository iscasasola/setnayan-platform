## 2026-09-26 · fix(signup): one sign-up door — the onboarding account screen stops bouncing, Google/Apple first, one landing rule

Owner, 2026-09-25: *"When a new account is created via website must be similar to
the event invitation"* · *"these are builds that needs to be fixed asap."* Audit:
`audits/GUEST_SIGNUP_FLOW_MAP_2026-09-25.md` §C.

- **Bug fixed — the homepage "Start" flow's account screen always bounced.** Its
  email form (`onboarding-shell.tsx`, `#screen-account`) posted to `signUp` with no
  `terms_agreed` and no `remember`, so `signUp` refused every submission and sent
  the couple to `/signup?error=terms_required` to retype everything; and the login
  only lasted until the browser closed. It now carries the same clickwrap as
  `/signup` (a checkbox, unticked, `required`, above the button — never a hidden
  field) and "Stay signed in", ticked by default.
- **One look and order on both website doors** (`/signup` and the onboarding
  account screen): Google / Apple FIRST, then the email form, one Terms line,
  Stay signed in. Both use the shared `<OAuthButtonRow>` with one shared verb
  (`SIGNUP_OAUTH_VERB`, "Sign in with" — the owner's 2026-09-23 words). The
  onboarding screen's hand-built, ungated Google button is replaced, so it gains
  Apple and can no longer offer a provider that is switched off; like `/signup`, it
  hides the providers inside the phone app shell. ⚠ This reverses the 2026-09-23
  ORDER on `/signup` (email first) in favour of the 2026-09-25 instruction and
  DECISION_LOG 2026-09-10 (providers on top — a redirect under a half-filled form
  loses the form); the 09-23 WORDS are kept.
- **Phone:** the Google / Apple buttons now have a 44px minimum height (they
  measured ~42px) — `oauth-button-row.tsx`, `desktop-oauth-buttons.tsx`.
- **One landing rule.** `signupLanding` and the You card (`/signup/you`, Done and
  Later) now resolve `next` through `signInDestination`, the rule `/login` and
  `/auth/callback` already used: came from an event / the onboarding resume →
  back there; came from nowhere (`/`) → `/dashboard` (which opens the person's own
  event when they organise exactly one). Before, a new couple from `/signup` landed
  on the front door while Google/Apple landed on the dashboard.
- **Found on the way — the Terms agreement was not being RECORDED for `/signup`
  email sign-ups.** The write of `terms_accepted_at` + `terms_version` sat inside a
  block that only ran when a name or the Stories consent was posted; both left
  `/signup` on 2026-09-22, so the gate passed but nothing was written. The write is
  now unconditional (and the flag-off anonymous-convert path records it too).
- **The You card is unchanged on purpose.** The approved one_door_FINAL_2026-09-22
  prototype already makes it "display name + everything else optional, with
  Later": photo, @account name ("Optional — you can set it later"), formal name
  (folded) and phone are all optional today.
- The couple welcome email ("Your couple account is ready… create your event") is
  untouched.

Guards: `app/signup/every-signup-door-agrees.test.ts` (NEW — keyed on the ACTION:
every `<form action={signUp}>` in `app/` must carry the Terms checkbox and
remember, with Google/Apple above it in the shared wording; sabotage-checked) ·
`lib/signup-landing.test.ts` (the landing rule executed, and the You card's two
exits pinned to it).

SPEC IMPACT: None to the corpus rules — this builds the 2026-09-25 DECISION_LOG
row (L4195, item 3) and the approved 2026-09-22 one-door prototype. Flag for the
owner: `/signup` button order changes from his 2026-09-23 layout (email first) to
providers first.
