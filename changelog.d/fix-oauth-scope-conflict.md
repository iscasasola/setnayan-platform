## 2026-07-25 · fix(oauth): stop sending `include_granted_scopes` — it made Google refuse the YouTube consent for anyone who had connected Drive

Connecting Live Studio's YouTube on an account that had already connected Papic's Google Drive died at Google's consent screen:

```
Access blocked: Authorization Error
This request contains scopes that cannot be requested together :
[https://www.googleapis.com/auth/youtube, https://www.googleapis.com/auth/drive.file]
Error 400: invalid_request
```

**We never asked for both.** `buildYoutubeAuthorizeUrl` sends only `auth/youtube` and `buildDriveAuthorizeUrl` only `drive.file` — but both also set **`include_granted_scopes: 'true'`**. That's incremental authorization: it asks Google to fold every scope the user has *already* granted into this consent. So on an account holding both grants, the YouTube request silently became `youtube + drive.file`, which Google refuses to issue together.

**The nastiest property of this bug is that it is ORDER-DEPENDENT.** Whichever integration is connected SECOND is the one that breaks, and a fresh account tests perfectly clean — so it reads as "works on my machine" and only appears once a real user has both. It was found the hard way: it blocked the demo-video recording for the Google OAuth verification submission.

**Fix — drop the flag, and stop duplicating the rule.** Neither integration ever needed it: Drive and YouTube keep independent grants (separate `oauth_grants` rows, refresh tokens, and OAuth clients), so each token only has to carry its own scope. Omitting it also matches the minimum-scope posture Google reviews.

Rather than delete the line twice and hope both stay deleted, the consent-URL construction is extracted to a new pure module **`lib/google-oauth-authorize.ts`** (`buildGoogleAuthorizeUrl`), which both server-only wrappers now delegate to. The rule is enforced in one place instead of relying on two callers independently remembering not to re-add a parameter. `prompt` stays configurable so Drive keeps its `select_account consent` account-chooser branch.

No `server-only` import on the new module — deliberately, so it's unit-testable. That mirrors the existing convention (`review-fraud-screener.ts` keeps its scoring core in a separate module for exactly this reason); the original builders couldn't be tested at all because importing them fails under the tsx runner with `Cannot find module 'server-only'`.

**Tests — `lib/google-oauth-scope-conflict.test.ts` (4 cases):** neither builder emits `include_granted_scopes` (both Drive prompt variants covered); no single consent request ever pairs a YouTube scope with a Drive scope; and each builder still sends its own scope, `access_type=offline`, and the forced `prompt` that guarantees a fresh refresh_token. **Verified falsifiable** — re-adding `include_granted_scopes` to the shared builder turns 4 passes into 2 passes / 2 failures.

Full unit suite green (3659), typecheck + lint clean.

⚠ Scope of the fix: this repairs the CONSENT REQUEST. Any user who already hit the error simply retries; there is no bad state to clean up, and existing valid grants are untouched. The wave-9 platform-pool route (`/api/oauth/youtube/pool/start`) shares `buildYoutubeAuthorizeUrl`, so it inherits the fix.

SPEC IMPACT: None — no SKU, price, schema, or scope-list change. The scopes requested are identical; only the incremental-authorization flag is removed.
