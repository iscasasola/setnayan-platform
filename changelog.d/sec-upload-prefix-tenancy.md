## 2026-08-02 · fix(security): you may not name an upload id you do not hold — SEC-1 lane #1

The last genuinely open item on the `#3729` deferred presign list
(`SECURITY_HANDOFF_2026-07-26.md` §4). **The other seven were verified closed
first** — see the sweep note at the bottom.

**The hole.** `/api/upload`'s GENERIC branch takes a client-chosen `bucket` +
`pathPrefix`. The bucket is whitelisted, the prefix sanitised (plus SEC-6's
structural refusals), and the final key carries a server-side `randomUUID()` — so
this was never disclosure and never overwrite. It **was** cross-tenant write
pollution: any signed-in user could presign a PUT under
`deposit-proof/<another-couple's-event-id>` or `chat/<someone-else's-thread-id>`,
landing bytes in a space the victim's own surfaces read from.

**The fix — shape-based, not an allowlist.** New pure module
`lib/upload-prefix-tenancy.ts`: if a sanitised prefix contains a **UUID segment**,
the caller must be entitled to it. `chat/*` resolves to a thread; everything else
resolves to an event — the conservative direction, since an unknown root then
fails toward the stricter check.

⚠ **Why not an allowlist of prefixes.** `<FileUpload>` takes `pathPrefix` as a
**prop**; 57 files reference it and several pass it through as a function
parameter, so the caller set is open-ended. An allowlist built by grep would be a
guess whose failure mode is **a broken upload on a surface nobody tested**. The
shape rule fails the other way: a new `receipts/<eventId>` surface is covered the
day it ships, with no registry to update — and silence is exactly what created
this lane.

**RLS is the tenancy check**, not a second bespoke rule: the verification read
runs on the **caller's** client, so it returns a row only if they could already
read that event/thread. Same pattern `lib/r2-client-ref.ts` documents. Refusal is
non-specific (403, house style) so this cannot become an existence oracle.
**Seat mode is exempt** — its prefix is derived server-side from the seat, so
there is no client-named id to verify, and forcing it through an events read
would break anonymous seat claimers.

**Deliberately unchanged:** flat prefixes (`locked-qr-proof`, `merchant-qr/*`,
admin hero/background video, `editorial-vendor` — itself separately tenanted by
key layout in lane #3) keep today's behaviour: authenticated, sanitised,
UUID-suffixed, non-overwriting. Closing the cross-tenant half is the half with a
victim; the rest would need the allowlist guess this deliberately avoids.

**Tests — 9, mutation-checked.** The shape rule against every prefix shipped
today; the UUID matcher against near-misses (a loose matcher would make every
flat prefix demand an entitlement nobody holds and break uploads app-wide); that
the route calls the rule, returns 403, and reads on the **caller's** client not
the admin one; that seat mode stays exempt; and a repo scan that every
identifier-headed prefix resolves to a string literal in its own file. Removing
the `!seatMode` guard turns test 8 red; stubbing the rule call turns test 7 red.

`lib` suite **6047 pass / 0 fail**; both changed files parse clean via the
TypeScript compiler API. ⚠ Full `tsc --noEmit` still cannot run on this machine
(heap exhaustion) — **no green typecheck is claimed**; CI is the authority.

### The sweep — 7 of 8 items were already closed

Verified against `origin/main` before writing any code, because this handoff was
wrong on three items last time:
`paperwork` · `budget` proof · `invite` proofs · `site-chrome` ·
`portfolio_r2_keys[]` all route through `requireClientRef`/`parseClientRef`
already · `editorial-vendor/` was tenanted by key layout (lane #3) ·
`/papic/media/[...key]` already rate-limits per IP · `our_photos` is covered by
the events column-privileges work. **Lane #5 (admin 7-day TTLs) is a
"must not shorten" finding with a test guarding it** — those TTLs feed the PUBLIC
homepage on ISR and the long expiry is load-bearing for browser caching.
Shortening them would have broken the homepage.

SPEC IMPACT: None. Closes the last open lane; no schema, pricing or policy change.
