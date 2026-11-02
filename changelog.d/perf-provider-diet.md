## 2026-07-02 · perf(analytics): don't resolve Supabase user until analytics consent is granted

From the 2026-07-02 load-delay sweep (finding #19). `PostHogProvider` mounts on
every page — including the anonymous marketing homepage — and, because
`providers.tsx` never passes a `userId`, it eagerly spun up a Supabase browser
client, called `auth.getUser()`, and subscribed to `onAuthStateChange` on every
first paint, for a visitor who has not (yet) accepted analytics cookies.

PostHog itself is already consent-gated (it never initializes or identifies
until `consentReady`), so resolving the user_id before consent is pure wasted
work on the first-paint path. Gated the user-resolution effect on `consentReady`:
the logged-in user is now resolved the moment they accept analytics (unchanged
behavior for consented users), and skipped entirely for the majority of
first-time, pre-consent visitors.

SPEC IMPACT: None (perf only — analytics identification behavior for consented
users is unchanged; RA 10173 consent gating is unaffected).
