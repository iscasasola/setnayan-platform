## 2026-11-16 · fix(supplier-walk): W1 walk batch — sign-up door, confirm link on any device, /v/ story forward

One batch for the 16 Nov supplier walk (W1). The other items in this PR have their own fragments
(`owner-rulings-16-nov-names-ceremonies-link-waived.md`, `walker-w1-b14-b15-b6.md`, `supplier-walk-w1-b9-b13.md`).

- **W1-B3** (sign-up blocker) — a breached password redirected to `/open-shop?step=5&error=…` and the wizard drew
  another step with no sentence: the server action's redirect is a soft navigation, so the wizard was not remounted
  and its seeds never re-ran. The page now stamps each refused render (`refusalStamp`); the wizard puts the refusal
  under its box on the step that owns it (`refusalStep`, `lib/open-shop-error-field.ts`). The quiet password field
  now says `/reset-password`'s "Not a known leaked password · checked when you continue" (one `LeakRuleWords`), red
  when refused.
- **W1-B1** — `SignInHereLink` built `/login?next=%2Fopen-shop&as=vendor?next=%2Fopen-shop`; the fallback is built once
  (`lib/sign-in-fallback-href.ts`).
- **W1-B4** — `?check_inbox=<email>` → `?check_inbox=1`; the address rides a short-lived http-only cookie
  (`lib/open-shop-sent-to.ts`), on both the wizard and the claim door.
- **W1-B2** — the service rows under an opened category carry an explicit accessible name (`serviceRowName`).
- **W1-B19** — `legacyShopRedirect` forwards `/v/{shop}/story/{event}` → `/{shop}/story/{event}` (308, query kept).
- **W1-B24** (walk 2) — the confirm-signup email used `{{ .ConfirmationURL }}` (PKCE, finishable only in the sign-up
  browser; the phone's first open spent the token). The template now links `/auth/confirm?token_hash=…&type=email`
  (works on any device; `confirmNextFrom` unwraps `.RedirectTo`). A dead link (expired / spent / PKCE elsewhere) from
  `/auth/callback` or `/auth/confirm` lands on `/login?link=expired`: plain words and "Send a new link"
  (`signInInPlace` intent=relink → `sendSignInLink`, an admin-minted magic link to `/auth/confirm`). No new server action.
  ⚠ OWNER ACTION: re-paste `supabase/templates/confirm-signup.html` into Supabase › Auth › Email Templates.

- **W1-B23** (walk 2, sign-up) — "Application error" right after "Open my shop — free" though the account and
  email were made, and a reload drew fine. A submit from the wizard now never swaps the form for the sent screen in
  place: the form stays drawn and the page loads afresh onto `?check_inbox=1` (the load the walker saw work).
  Not reproduced off live (the lab's in-place swap did not crash) — the fix takes the known-good path.
- **W1-B25** (walk 2) — the fault log's `SecurityError: … history.replaceState() more than 100 times per 10 seconds`
  on /dashboard/create-event (build afcef1e): the board redirected a console user with no events to
  /dashboard/create-event, which its own `@modal/(.)create-event` intercepts on a client navigation, re-rendering the
  board, which redirected again. Now a supplier goes to /vendor-dashboard (an admin to /admin), and an email link with
  no destination lands a supplier on the shop (`landingForAccount`, /auth/callback + /auth/confirm).
- **W1-B9** — dropped: fixed on live (walkthrough 2).

SPEC IMPACT: None for the code. The template re-paste is an owner action (Supabase dashboard), not a spec edit.
