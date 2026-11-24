## 2026-11-24 · feat(auth): Sign in and Create account, simple and dark, with the forming mark

The owner approved the simple sign-in and create-account cards on 24 Nov. Drawing: specs `prototypes/login_simple_dark_2026-11-24/login_simple_dark_2026-11-24_fable.html`. It is built on the shipped cards (`app/login/_components/sign-in-card.tsx`, `sign-in-card-modal.tsx`, `app/_components/auth/sign-in-here-panel.tsx`, `app/signup/page.tsx`). No second card.

- **Fewer words:**
  - Sign in: the title "Sign in" only. The guest card keeps its one title, "Sign in to open it."
  - Create account: the title "Create account" only. The wordmark line, eyebrow and sub are gone. The button says "Create account".
  - The labels are kept for screen readers only. The boxes say "Email" and "Password" ("Password, 8+ characters" on Create account).
  - The divider says "or". The footers say "New here? Create account" and "Have an account? Sign in".
- **The forming mark:** `app/_components/auth/forming-mark.tsx`, one piece for both cards. Four gold arcs circle once and become the ring, then the inside grows inward. It plays once on the motion tokens (Rise, Settle), and reduced motion shows the finished mark. Each card gets its own mask id (`useId`).
- **"Use email":** `app/_components/auth/use-email-fold.tsx`. The email and password boxes wait under Google and Apple behind a native `<details>`. It starts open when there is something to show (an error, a typed or recalled address, an "account ready" line, a provider refusal). The email half is always rendered, so the bot check still solves in the background. With Google and Apple off there is no switch. Every function is kept: the password-only fold, the Google-address door, Turnstile, the relink and reset forms, "Stay signed in" (on by default) and Forgot password.
- **The Terms tick sits above Google and Apple** on Create account. It is still one unticked, required box. It belongs to the email form through `form=`, and `TermsFirst` still gates all three doors.
- **The password checks show only while typing**, in short words: "8+ characters", "Not your name or email", "Not a leaked password". This is `PasswordField`'s new `brief` prop. Other callers keep the full words.
- **Concentric corners:**
  - The card keeps the popup radius (22) and sits 8 in.
  - Google, Apple, the boxes and "Use email" are 48 tall with radius 14. The ✕ is a 44 square with radius 14, 8 from the corner.
  - Continue and Create account stay the one round accent button.
  - The shadow is layered and warm, in light and dark.
  - The card rises in.
- **The scene:** behind /login and /signup only, the hero photo is blurred under a warm veil. In dark it is darkened, with drawn string lights (`public/hero/string-lights.svg`). It is a CSS background on fixed layers, so nothing shifts. The pop-up keeps the page behind it, under the one scrim.
- **Dark for signed-out visitors:**
  - /login and /signup follow the phone for a signed-out visitor with no choice. An explicit `sn-theme=light` still wins. The list is `SIGNED_OUT_FOLLOWS_PHONE` in `lib/appearance.ts`, mirrored in the inline head script.
  - The pop-up over any other page gets the dark card through `.sn-dark-scope` on its overlay. The dark token block now serves both `html.dark` and `.sn-dark-scope`, so no dark value is copied. The sign-in dark rules serve both from one rule set.
  - In dark, Google and Apple get their dark pair.
- **Guards changed:**
  - `app/signup/one-tick-covers-every-door.test.ts`: the box is now ABOVE every door. It still checks one box, unticked, required, owned by the form and gating all three doors.
  - `app/signup/the-sign-in-cards-wear-the-house-shape.test.ts`: a new concentric-corners test. The field-radius test now reads the You card's base rules.
  - `lib/appearance.test.ts`: the new (c2) test covers the signed-out phone cases. (b) also walks a ready-list holding the sign-in pages.
  - `lib/first-run-screens-carry-the-brand.test.ts`: Create account wears the forming mark, not the wordmark line.
  - Four dark-block parsers read `.sn-dark-scope, html.dark` as `html.dark`.
  - `lint:contrast` skips `.sn-dark-scope …` token rules in its light pass, as it already skips `html.dark …`. Each one is the twin of an `html.dark` selector, which the dark pass judges.
  - `lib/the-journey-words-say-what-happens.test.ts` and `lib/the-sign-in-card-says-only-our-words.test.ts` now take the "Email" box word and the guest's one title.
- **No migration.** No new server action. No email.

SPEC IMPACT: Builds DECISION_LOG 2026-11-24 "Sign in and Create account: simple, dark, a forming logo (owner)". It amends 22 Oct's Terms placement (now above Google and Apple) and 13 Oct call 4 / K2 (the two sign-in cards follow the phone signed out). Both amendments are in that ruling. No further corpus edit is needed.
