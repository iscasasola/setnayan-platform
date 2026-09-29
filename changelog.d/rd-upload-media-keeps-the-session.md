## 2026-09-29 · fix(auth): a failed sign-in check no longer sends a signed-in couple to /login

Owner, live on production: *"when i used the upload media on the background, i
went back to login"*. Vercel logs: the Maker's first save of the session
(`POST /dashboard/<event>/launch`, the draft save `hubDraftAction`) answered
**303** — a server-action `redirect()` — and the next request was `GET /login`.
The only `/login` redirect on that path is `getHostUserId` (`lib/host-gate.ts`):
`if (!user) redirect('/login')`.

`supabase.auth.getUser()` returns no user both when the visitor is signed out
AND when the check itself fails. Measured with the shipped `@supabase/ssr`
client against a local auth server: a dropped connection and a 503 return
`AuthRetryableFetchError`, a 429 returns `AuthApiError` 429, and none of them
clears the session cookie — the couple is still signed in, and was being sent
to sign in again. Now a failed check throws a retryable error (the Maker shows
"That change could not be saved" in place); only a real absence of a session
goes to /login (`lib/auth-read.ts` `authReadFailed`). Covers every host-gated
action, not only Upload media.

Not proven for this one incident: Supabase's auth logs were not readable from
this session, so whether the owner's check failed transiently or his session
had truly ended cannot be told from the Vercel logs alone.

Guard: `lib/a-failed-sign-in-check-is-not-a-sign-out.test.ts` (real client,
local auth server; each case seen red once).

SPEC IMPACT: None.
