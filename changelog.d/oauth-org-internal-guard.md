## 2026-07-27 · fix(oauth): translate Google's `org_internal` instead of forwarding it as a failure

Prepares the Internal-audience cutover (owner: "go internal"). Small, and it closes a
window that opens by construction during that cutover.

**The window.** The couple-facing BYO route (`/api/oauth/youtube/start`) and the pool
route both resolve **one** OAuth client via `getYoutubeOAuthConfig()`. So the moment
Internal-audience credentials are configured, the BYO door starts answering Google's
`org_internal` — and keeps doing so until `NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY` is
flipped. Those are two human actions, in two different systems (Google Cloud and
Vercel), with nothing enforcing their order.

**What a couple saw in that window.** The callback forwarded Google's error verbatim,
so the setup page rendered:

> YouTube connection failed (`org_internal`). Try again, or contact support if this
> persists.

Three untrue things in one sentence: nothing failed, retrying cannot help, and support
cannot fix it either. `org_internal` is the *correct* answer under the Setnayan-owned
channel model — arriving through the one door that model closes.

**The fix.** The callback translates `org_internal` → `pool_only`, checked **before**
the verbatim catch-all (a test pins that ordering, since the generic branch would
otherwise win). The setup page renders it as a `role="status"` using the **same shared
`POOL_ONLY_CONNECT_NOTICE`** the closed door and the controller already use — one
wording across all three, so it cannot drift.

Nothing else changes: every other Google error still forwards verbatim.

2 new tests (8 in the pool-only suite). 4551/4551 unit green, typecheck + lint +
production build pass. No migration.

SPEC IMPACT: none. Recorded in `Live_Studio_Internal_Consent_Cutover_2026-07-27.md`,
which tells the owner to flip the flag and set the credentials in the same change —
this makes the wrong order survivable rather than merely discouraged.
