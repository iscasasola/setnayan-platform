## 2026-06-20 · feat(onboarding): anonymous-draft onboarding — finish with no sign-in wall (flag-gated, ships dark)

2-step-down program (Wave 7) — onboarding's final step forced account creation before a couple's plan was saved. Behind `NEXT_PUBLIC_ANON_ONBOARDING_ENABLED` (default OFF), that wall is gone: a visitor finishes onboarding, lands straight in the dashboard with the plan saved, and is nudged (not gated) to secure an account later.

Mechanism is **Supabase native anonymous auth**, deliberately chosen over an `is_anonymous` events column + RLS-predicate edit. An anonymous user is a real `auth.uid()`, so every existing RLS policy and ownership read works **unchanged** — no RLS surgery, no claim/merge race. "Securing the account" links the email to the **same uid**, so the event was always theirs.

- **`supabase/migrations/20270205204166_anon_onboarding_null_email_trigger.sql`** — makes `handle_new_auth_user()` tolerate a null email (anonymous users have none; the prior trigger would crash the `NOT NULL` insert into `public.users`). Synthesizes a deterministic placeholder, overwritten on convert. Byte-identical otherwise; safe to apply before the flag flips. **NOT applied to prod** — owner go-live step.
- **`lib/anon-onboarding.ts`** (new) — single flag source for client + server.
- **`app/onboarding/wedding/actions.ts`** — `commitOnboardingWedding`: when unauthenticated + flag on, `signInAnonymously()` then commit (instead of returning `not_authenticated`).
- **`app/onboarding/wedding/_components/onboarding-shell.tsx`** — drops the account-gate screen from the flow when the flag is on (everyone, not just signed-in users); the `not_authenticated` fallback degrades to an inline retry rather than bouncing to the now-absent gate.
- **`app/signup/actions.ts`** — convert-in-place: an active anonymous session attaches email+password to the same uid via the admin API (instead of `signUp()` minting a new uid that would orphan the event), updates the `public.users` placeholder email, then re-login. Non-anon signup path byte-identical.
- **`app/dashboard/_components/secure-account-banner.tsx`** (new) + **`app/dashboard/layout.tsx`** — a calm "secure your plan" banner shown only while `user.is_anonymous`; vanishes on convert.
- **`.env.example`** — documents the flag + the two owner go-live steps.

Owner go-live (until done, flag stays OFF and all of the above is inert): (1) enable anonymous sign-ins in the Supabase Auth dashboard, (2) apply the trigger migration, (3) set `NEXT_PUBLIC_ANON_ONBOARDING_ENABLED=true`.

No behavior change with the flag off. tsc clean.

SPEC IMPACT: onboarding (iteration 0000/0016) auth model — anon-draft + convert-on-signup. Logged in `DECISION_LOG.md`.
