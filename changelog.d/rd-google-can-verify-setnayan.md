## 2026-10-22 · fix(google-verify): /privacy details the Google user data; the home page names Setnayan in its <h1> and says what it does

Google refused OAuth branding verification (22 Oct) on three counts: /privacy did not detail the data Google
sends us, the home page did not explain the app's purpose, and the consent-screen name "Setnayan" did not
match the home page.

- `/privacy` gains a **Google user data** section (`/privacy#google-user-data`), read off the code: Sign in with
  Google asks only for the default `email` + `profile` scopes (neither `signInWithOAuth` call passes `scopes`);
  what we receive (name, email, profile photo, Google account id); how each is used (account + sign-in, account
  name / RSVP prefill, the guest's photo on an event they join, matching a host-recorded address); the two optional
  connections (YouTube `auth/youtube`, Drive `auth/drive.file`) with links to their full sections; not sold, not for
  ads, not for AI training; processors (Supabase, Vercel, Resend); the Limited Use statement; retention + the real
  delete path (`/dashboard/profile` → Delete my account, or dpo@setnayan.com). "What we collect" gains the Google
  line and a short "Why we collect it". Sections gain anchor ids.
- Home (signed-out hero, `front-door-anchor.tsx`): the eyebrow moves INSIDE the `<h1>` as title-case "Setnayan"
  (capitals now from CSS — it was typed "SETNAYAN", the rejected variant); one purpose sentence ("Setnayan is a
  free app for planning and running your event in one place: …"); a Privacy Policy · Terms of Service line.
- Guard `app/google-can-verify-the-home-page.test.ts` (8 tests, rendered HTML): h1 contains "Setnayan", a
  purpose sentence, /privacy + /terms links, the title leads with the name, the Google section's contents,
  every `#fragment` on /privacy resolves, and sign-in passes no extra `scopes`. 9 sabotages, all red.
- Ugat: `/privacy/google-access` now has a door (dropped from the no-door baseline).

SPEC IMPACT: DECISION_LOG.md row 2026-10-22 (Google OAuth branding re-verification fixes).
