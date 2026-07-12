## 2026-07-12 · fix(auth): OAuth vendor signups no longer misclassified as customers

A vendor signing up via Google/Apple landed as `account_type='customer'` — `signInWithOAuth` can't seed the `raw_user_meta_data.account_type` that the `handle_new_auth_user` trigger reads (unlike email/password `signUp`), so the trigger defaulted them, and no vendor path ever fired. (Latent today — OAuth is flag-gated OFF; this fixes it for when Google/Apple are enabled.)

Fix, in three layers, all deterministic + guarded:
- **UI bridge** — the Couple/Vendor radio lives in the email/password form; the OAuth buttons are separate forms. New client `<OAuthAccountTypeMirror>` copies the checked radio into a hidden `account_type` input inside each OAuth form (only on /signup via `withAccountType`; /login byte-identical). The input is **SSR'd to the URL-derived intent** (`/signup?as=vendor` → `vendor`) so a deep-linked vendor is correct even pre-hydration / with JS off.
- **Action** (`oauth-actions.ts`) — `buildOAuthCallbackUrl` threads the intent as `?as=vendor` on the callback URL + routes a vendor's default `next` to `/open-shop`.
- **Callback** (`auth/callback/route.ts`) — `shouldPromoteToVendor` gates an admin-client `account_type='vendor'` update: only on explicit vendor intent, a **brand-new** account (`|now − created_at| < 2 min`), and only a `customer` (never re-classifies an established account). The promote is wrapped in try/catch so a missing service-role key or a rejected write **falls through as customer, never 500s the login**.
- **Self-heal** (`open-shop/actions.ts`) — `becomeVendor` now sets `account_type='vendor'` for a `customer` row (guarded, idempotent), so any customer-typed shop creator (a promote-failed edge, or a legacy pre-fix OAuth vendor) is corrected.

Pure guard logic extracted to `lib/oauth-signup.ts` with 10 unit tests (hijack-prevention, clock-skew, fail-closed). Adversarially reviewed (hijack-safety · security · regression · UI-wiring); the 3 confirmed low findings (uncaught admin-client throw, pre-hydration/no-JS window, and the self-heal gap) are all fixed above. Desktop (Tauri) loopback-OAuth threading is a scoped follow-up (that flow posts no form).

SPEC IMPACT: None — auth bug fix; no schema/pricing/roster change.
