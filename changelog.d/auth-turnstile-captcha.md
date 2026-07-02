## 2026-07-03 · feat(auth): wire Cloudflare Turnstile captcha into every auth call (graceful-off)

Enabling Supabase "anonymous sign-ins" opens the bot-abuse vector the dashboard
warns about; the fix is Supabase's built-in captcha — but that switch is GLOBAL,
so once on it gates EVERY auth call (password sign-in, sign-up, change-password
re-auth, and anonymous sign-in). This wires Cloudflare Turnstile through all of
them so activating captcha keeps every flow working.

- New `lib/turnstile.ts` (`captchaOptions()` · `captchaTokenFromForm()`),
  `<TurnstileField>` (writes a solved token into a hidden `captcha_token` field),
  and `lib/turnstile-client.ts` `mintTurnstileToken()` (headless mint for the
  formless anon flows / future Inquire funnel).
- Token threaded into all 7 auth call sites: `signInWithPassword` (login),
  `signUp`, change-password re-auth, and the four `signInAnonymously` calls
  (onboarding wedding + generic commit, Papic claim, Panood claim). Widget added
  to all 7 auth forms (login ×3, signup ×2, change-password ×2).
- **GRACEFUL-OFF invariant:** with `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset, the
  widget renders nothing and every `captchaOptions()` returns `{}` — a strict
  no-op identical to today. Feature is inert until the key is set AND Supabase
  captcha is enabled. Safe activation order documented in OWNER_ACTIONS.md.
- Anon programmatic flows (Papic/Panood/onboarding) accept the token server-side;
  their client mint lands with the Inquire-funnel build. All three anon flags are
  OFF in prod today, so enabling captcha is safe and fully blocks the bot vector.

SPEC IMPACT: None (auth-hardening; no schema/pricing/SKU change). The null-email
anon trigger migration (`20270205204166`) already exists. Logged in DECISION_LOG.md.
