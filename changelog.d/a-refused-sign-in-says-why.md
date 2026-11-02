## 2026-08-20 · fix(auth): a refused sign-in says why — and the callback stops swallowing it

Owner 2026-08-20, screenshotting the sign-in panel with a red banner reading
exactly `{}`: *"a blank error"*.

### Three faults, one experience

**1 · Two switches for one feature, and they disagree.** Google sign-in is
gated by `NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED` (draws the button) **and** by the
Supabase project (answers the request). The first is ON, the second is OFF.
Production auth log, 2026-08-20T06:59:40Z:
`{"error":"provider is not enabled","error_code":"validation_failed","path":"/authorize","status":400}`.
⇒ **"Continue with Google" is a door that cannot open.** ⏭ **OWNER ACTION —
no code will fix it:** either enable Google in Supabase → Auth → Providers, or
turn the Vercel flag off so the button stops being drawn.

**2 · The callback threw the reason away.** A provider refusal arrives at
`/auth/callback` with `?error=` / `?error_description=` and **no `code`**, so
the `if (code)` block was skipped and the route fell through to a bare
redirect. **Measured live:**
`/auth/callback?error=validation_failed&error_description=provider+is+not+enabled`
answered **307 → `/`**, silently. The person presses the button, the screen
flickers, and they are exactly where they were, still signed out.
🔑 **The desktop twin already read `error_description ?? error`** — one of two
twins handled the failure and the other did not. This is the sibling catching
up, not a new mechanism.

**3 · The banner printed whatever it was handed.** `{}` is the fingerprint of a
stringified error object (`JSON.stringify(new Error(…))` is `'{}'` — an Error's
own properties are not enumerable). Verified live: `/login?error=%7B%7D`
renders `hr-si-banner--error">{}</p>`, while `?error=Test%20message%20here`
renders the sentence — so the banner worked and was fed junk.

### The fix is ONE GATE, not N checks

Messages reach that banner from at least four producers — the `/login` route's
`?error=`, the in-place panel action, the OAuth start action and the desktop
loopback — and `?error=` is a **query param anyone can type into**. Sanitising
per producer is four chances to forget and the next one makes five. So
`humanAuthError()` runs at the single point they converge: the render.

It judges **shape, not a deny-list** — a deny-list is a bill you keep paying,
and the next machine string will not be `{}`. Serialized data, letterless
strings and bare tokens (`validation_failed`) all fall back to one actionable
sentence. ⚖ It fails toward the generic line, **never toward silence**: a
refusal nobody can read is bad, a refusal that renders nothing is worse.
⚠ `null` in means `null` out — it is a formatter, not a detector; inventing a
failure would paint a banner over a form nobody submitted.

🛡 4 mutations, each landed by occurrence count, all RED: bypass the gate
(1→0) · callback stops reading `error_description` (5→4) · delete the
serialized-data shape test (1→0) · make the mapped message leak our
configuration back to the customer.

SPEC IMPACT: None (auth copy + error routing; no SKU, price or schema change).
