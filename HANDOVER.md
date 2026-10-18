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
