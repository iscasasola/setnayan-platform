## 2026-08-06 · fix(guest-session): the signing seal refuses a junk value instead of using it, and a blank `GUEST_SESSION_SECRET` stops short-circuiting its own fallback

An audit flagged `lib/guest-session.ts` for signing guest cookies with the database key when its own secret is unset — `process.env.GUEST_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''` — and rated it MEDIUM after a challenge refuted both claimed consequences. Treated as hygiene, not an emergency.

**The audit's remaining claim is ALSO refuted, and the file is more interesting than the claim.** It said: both vars unset ⇒ the seal is `''` ⇒ "signs and verifies happily". It does not. The `?? ''` tail was immediately followed by `if (!secret) throw`, so the all-unset case already failed closed. Probed rather than read (`signGuestSession` called under five patched envs), the resolver did three things nobody had claimed:

| env | old behaviour |
|---|---|
| both unset | **threw** — the audit's claim, refuted |
| `GUEST_SESSION_SECRET=''` + valid service-role key | **threw** |
| `GUEST_SESSION_SECRET='   '` + valid service-role key | **signed, seal = three spaces** |
| `GUEST_SESSION_SECRET='x'` | **signed, seal = one byte** |

Two real defects, neither of them the one reported.

**1 · `if (!secret)` is a PRESENCE check standing in for a STRENGTH check.** Three spaces and the single letter `x` are truthy, so both were accepted as HS256 signing keys. `jose` does not enforce a key length for raw `Uint8Array` secrets, so nothing downstream caught it either. A one-byte seal is trivially forgeable — and forging this cookie is impersonating a named guest at a specific event.

**2 · A blank variable short-circuits the fallback standing right behind it.** `??` is nullish coalescing, so a present-but-empty `GUEST_SESSION_SECRET=` is a *value*: the resolver stops there and hard-throws while a perfectly good service-role key goes unread. This shape is not hypothetical in this repo — `.env.example` shipped that line blank, and `money-writer-refuses-fallback.test.ts` already documents that `vercel env pull` writes `NAME=` with no value. Copy the template to `.env.local` and every guest session breaks, with the fallback sitting unused.

**Fix — `resolveGuestSessionSecret(env = process.env)`**, a pure exported resolver returning `{ ok: true, material, source }` or `{ ok: false, reason }` instead of throwing, so callers (and tests, and any future health surface) can ask "is this configured?" and get an answer. Blank/whitespace reads as **absent** (the fallback is reached); anything under 32 characters is **refused outright** rather than used weakly. The floor sits under every legitimate value — `openssl rand -hex 32` is 64 chars, a Supabase `sb_secret_…` key ~50, a legacy service-role JWT ~200 — so nothing valid is near it, and CI sets no dummy value (checked `.github/workflows` + `turbo.json`).

⚠ **Trimming informs the JUDGEMENT only, never the material.** The seal is the raw bytes of the value; a value pasted with a stray newline is still what production signs with *right now*, so the signer always receives the original untrimmed string. Trimming it would change the seal and sign out every live guest — the exact outcome this PR exists to avoid. Locked by a test.

**The service-role fallback is deliberately KEPT.** Two unrelated secrets sharing one value is poor hygiene and should end, but ending it *here, in code* is the wrong lever: production has no dedicated `GUEST_SESSION_SECRET`, so deleting the fallback would not improve anything — it would sign out every live guest the moment the deploy landed, mid-wedding, with no re-issue path (a guest gets back in only by re-scanning a QR they may no longer have). Correct order: set the var in Vercel first, take the one-time sign-out at a chosen quiet hour, then retire the fallback. Carries a loud comment and a one-per-process `console.warn` naming the real cost: **while the fallback is in use, rotating the database key silently signs out every guest** — nothing in the database rotation runbook has any reason to mention cookies.

**Misconfiguration no longer looks like a forged cookie.** `readGuestSession()` resolved the seal *inside* its `try { … } catch { return null }`, so a missing secret was swallowed: every guest signed out, on every request, with nothing in the logs. The resolution now happens outside that catch — still fail-closed (`return null`), but on the record via `console.error`.

**Tests** — new `lib/guest-session-secret.test.ts`, 11 cases, **watched failing against the unmodified file first** (7 red, 4 already green): whitespace never becomes the seal · a short secret is refused rather than signed with · a short secret does not silently borrow the fallback either · a blank var falls through to the fallback · the fallback still mints a verifiable cookie (the sign-out guard) · usable material reaches the signer byte-for-byte untrimmed · a dedicated secret wins over the service-role key · both-unset refuses (locking the refutation in place so nobody "fixes" it again). Full unit suite green (6,732), typecheck clean, lint clean.

**Two same-shape sites left alone, deliberately** — both outside this PR's ownership, neither cross-verifies with guest sessions (different cookie names, no shared tokens), so the divergence is safe: `lib/live-wall.ts` carries a byte-identical resolver for the venue display cookie, and `lib/vendor-funnel.ts` uses the same `?? SUPABASE_SERVICE_ROLE_KEY ?? ''` pattern for `VIEWER_HASH_SALT`. Worth a follow-up that extracts one shared resolver rather than a third copy.

**Also observed, not changed:** `GUEST_SESSION_SECRET` is absent from the `/admin/secrets` rotation registry (`lib/secrets/rotation-registry.ts`) even though `GUEST_CLAIM_OTP_SECRET` — which that file itself notes no runtime path reads — is listed; and it is undeclared in `turbo.json`'s env list (cache-key only, read at request time, so no correctness impact).

SPEC IMPACT: None — no schema, no migration, no pricing, no SKU, no locked decision touched. Behaviour change is confined to which env values are accepted as a signing seal; every currently-valid deployment keeps signing with the same bytes.
