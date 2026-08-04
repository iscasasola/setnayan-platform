## 2026-07-24 · feat(marketing,signup): retire the "launching Dec 1" waitlist (we're live) + persist signup name

Market-introduction polish, two owner decisions (2026-07-24):

- **"We're live now" — kill the waitlist contradiction.** The public site told
  two stories: `/waitlist` said *"Setnayan opens to couples on December 1,
  2026"* with an email-capture form, while the homepage + working sign-up said
  *"Plan your wedding free."* Reframed `/waitlist` into a truthful **"Setnayan
  is live — plan your wedding free"** landing (same URL, kept the feature list,
  dropped the countdown + email form; primary CTA → `/onboarding/wedding`), and
  changed the global footer link from "Join the waitlist" → "Plan your wedding"
  (`/onboarding/wedding`). The old `joinCoupleWaitlist` action is no longer
  wired to a page. (Internal "Dec 1, 2026" demo-data-cleanup comments are
  unrelated and left as-is.)

- **Persist the signup name.** The sign-up screen collects First/Last name but
  `signUp` only saved email + password, so couples re-typed their name in
  create-event. Now `users.display_name` is written from `first_name` +
  `last_name` (capped 200 chars, optional) in both signup paths — the anon-draft
  convert-in-place update and the fresh-signup post-insert profile write. The
  RA 10173 public-summary consent write is preserved and now shares one
  poll-then-update with the name write. (Mobile/wedding-date on the signup
  screen are visual-template decoration only — no real inputs — so nothing else
  to carry through.)

SPEC IMPACT: Public marketing posture change — /waitlist is no longer a
pre-launch waitlist; the product is presented as live to couples (owner
decision 2026-07-24). Logged in DECISION_LOG; no iteration-spec file tracks this
page so no corpus stub edit is required.
