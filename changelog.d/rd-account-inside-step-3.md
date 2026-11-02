## 2026-09-22 · feat(open-shop): the account is created inside step 3 — one submit opens the account and the shop

Owner, 2026-09-22, on the approved one-door prototype: *"approved. account inside step 3, consent per event, small card for signup"*. This is the first of those three (Redesign bundle · build `rd-account-inside-step-3`).

- `/open-shop` no longer bounces a stranger to `/login?next=/open-shop&as=vendor` (the 2026-07-10 login-first routing). The wizard renders signed out; every account-bound read is guarded on the session, and the vocab reads are anon-readable (the tree still falls back to the flat select).
- Step 3 *Who you are*, signed out, carries a **password** under the company email ("You'll sign in with this"), Google / Apple by the same shell gate `/login` uses, and *"Have an account? Sign in — what you typed stays"*, which opens the sign-in **popup over the wizard**; on success the page re-renders with the account and the wizard keeps its state.
- **ONE submit** creates the account and then the shop: `becomeVendor` → `decideOpenShopAccount` (pure, `lib/open-shop-account.ts`) → `createVendorAccountForShop` (`lib/open-shop-account.server.ts`, which reuses `/signup`'s own helpers: breach check, blacklist, Turnstile, `account_type: 'vendor'` metadata, the V1 auto-confirm, the welcome email, a direct sign-in). A taken email is refused with *"sign in to keep going"* on step 3, from both shapes Supabase uses.
- The Terms agreement (CTRL-B3, PR #5867: `lib/terms-agreement.ts`) rides on the last step of the guest path, unticked, above the one button that creates anything; the server refuses without it via the SAME `hasAgreedToTerms`, and records `terms_accepted_at` + `terms_version` on the new row.
- Google / Apple leave the page, so the typed steps are parked in a one-hour same-tab draft (`lib/open-shop-draft.ts`, never the password) and restored when the OAuth callback lands back on `/open-shop`.
- Guards: `lib/open-shop-account.test.ts` EXECUTES the decision and the draft (three sabotages watched red); `four-steps.test.ts` now also owns the account refusals' steps, pins that the action forwards the module's step, and that password + terms are gated on `guest`.

Depends on `lib/terms-agreement.ts` from PR #5867 — this build lands after it. `signup/actions.ts` is untouched (its vendor branch should later import `createVendorAccountForShop` rather than keep its own copy).

SPEC IMPACT: `DECISION_LOG.md` 2026-09-22 🚪 ONE DOOR row (already recorded); `prototypes/one_door_signin_signup_shop_2026-09-22.html` is the approved drawing.
