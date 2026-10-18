# HANDOVER — rd/google-login-same · started 2026-10-18 ~12:40 PHT by the controller

Owner, 2026-10-18, verbatim: "another thing about typing in a google account and tapping the log in via google should run
similarly." → "we want people to login via google and typing their google account be same."

GOAL: a person who TYPES their Google address (gmail.com, googlemail.com, or a Google Workspace domain) at sign-in /
sign-up lands in exactly the same place as one who taps "Continue with Google": the SAME account (never a second
account for the same person), the same next screen, the same account type, the same onboarding.

STEP 1 — MEASURE (read the code; prod SELECT-only via the Supabase MCP for counts; never write): what happens today
when an address is typed (OTP / magic link / password?) vs Google (apps/web/app/auth/oauth-actions.ts,
app/auth/callback/route.ts, lib/native-oauth.ts, lib/desktop-oauth.ts, the login/sign-up pages). Does Supabase link the
two identities to one user when the email matches (identity linking), or can the same person end up with two users?
Count in prod (SELECT only) users whose email appears twice / users with both identities. Write what you find into
this HANDOVER before changing anything.
STEP 2 — FIX, the simplest honest way, e.g.: when the typed address is a Google account (gmail/googlemail by domain;
a Workspace domain by its MX pointing at Google, checked server-side, cached), send the person through the SAME Google
sign-in (`signInWithOAuth` with `login_hint` = the typed address) instead of the email-code path; and make sure an
existing email-code account and a Google sign-in for the same verified address resolve to ONE user. Keep every
protection the current flows have (memory: "a flow that leaves its provider drops its protections") — safeNext,
account_type seeding, the internal-owner trigger, rate limits. Web, desktop (Tauri) and the installable app must all
behave the same. If an existing person already has two users, do NOT merge data in this PR — list them for the owner.
Proof: walks of both paths at 375 px (WebKit) up to Google's own page (never enter credentials — stop at Google's
screen; that is enough to show the same door), plus tests. Never sign in as or change a real account.
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Changelog fragment changelog.d/rd-google-login-same.md.

---

## STEP 1 — MEASURED 2026-10-18 (code on origin/main 3412d22 + prod SELECT-only via the Supabase MCP)

### What happens today
- **Typed address at sign-in** (`app/login/_components/sign-in-card.tsx` → `app/login/actions.ts` `exchangeCredentials`):
  email + PASSWORD only (`signInWithPassword`). No OTP / magic link. A Google-only account that types its address
  and any password is refused, and only THEN told "This account signs in with Google. Use the Google button above."
  (`lib/sign-in-door.ts`, owner 2026-09-23 rule). So a Google person who types is sent round a failed attempt.
- **Typed address at sign-up** (`app/signup/actions.ts` `signUp`): creates an email+password user, auto-confirmed
  (`updateUserById email_confirm`), Terms stamped, then signs in → You card (couple) / `/open-shop` (vendor).
  If the address ALREADY has a Google-only account, GoTrue returns an obfuscated fake user (no error), the code
  sends a "Welcome to Setnayan" email and lands them on `/login?ready=` ("Your account is ready. Sign in below"),
  where the password they just chose is refused. No second user — but a wrong, confusing path.
- **"Continue with Google"**: web = `app/auth/oauth-actions.ts` server action → Google → `/auth/callback`
  (vendor promotion via `?as=vendor`, You card for brand-new couples, RSVP terms, last-login). Desktop (Tauri) =
  `lib/desktop-oauth.ts` loopback, exchanges the code in the web view and goes straight to `next` (skips
  `/auth/callback` — pre-existing, see PR body). Phone app = `lib/native-oauth.ts` (system browser → `/auth/callback`).
- **Does one address ever make two users?** No. Supabase links identities with the same verified email
  automatically. Prod proves it: a user created by email on 2026-05-12 gained a `google` identity on 2026-05-23
  (same user, then facebook + apple); another created by Google 2026-09-22 gained an `email` identity 2026-09-24.

### Prod counts (auth.users / auth.identities, SELECT only)
- 21 users · 3 anonymous · 18 with an email.
- Emails on two or more users: **0**. Gmail-normalised (dots / +tag stripped) duplicates: **0**.
- Users with both google + email identities: **2** (linking works). Google-only: 6. Email-only: 9. Apple on any: 2.
- Google addresses (gmail.com + Workspace by MX): **10** users — 6 Google-only, 1 linked, **3 password-only**
  (2 gmail.com, 1 Workspace domain whose MX is aspmx.l.google.com). Unconfirmed email identities: 0.
- Both non-gmail company domains in prod (2) have Google MX → Workspace detection is worth having.
→ **Nobody has two users today. Nothing to list for the owner as a merge.**

### The fix (STEP 2 plan)
- `lib/google-address.ts` (pure): gmail.com / googlemail.com = Google by its name; a Workspace domain = Google when
  its lowest-preference MX hosts are all `*.google.com` / `*.googlemail.com`.
- `app/api/sign-in/google-domain/route.ts` (GET `?domain=`, domain only — never the address): server-side MX
  lookup, cached, rate-limited. A static route (no new server action; the action budget is 12 under its ceiling).
- One client piece `GoogleAddressDoor` inside BOTH the sign-in card form and the /signup form: when the typed
  address is a Google one AND this shell shows the Google button, the password part folds away and the card's
  button becomes "Continue with Google", which runs EXACTLY the shell's Google flow (web server action /
  desktop loopback / phone system browser) with `login_hint` = the typed address. Signup carries account_type.
  Same callback, same landing, same account (Supabase linking). A small "Use a password instead" link keeps the
  three password-only Google-address accounts from being stranded if Google refuses (e.g. a Workspace admin block).
- Decision recorded (not in the record): the domain check reveals nothing about any ACCOUNT (it is a property of
  the address's domain, public DNS), so the 2026-09-23 "reveal the provider only after a failed attempt" rule is
  untouched — the account lookup still runs only after a refused password.
