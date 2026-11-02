## 2026-09-22 · docs(r2): the public media host says what production actually serves

Two docblocks stated, as current fact, things production contradicted — **stale in opposite
directions on the same subject**:

| file | claimed | measured 2026-09-22 |
|---|---|---|
| `lib/r2-client-ref.ts` | ``R2_PUBLIC_URL` → `media.setnayan.com`` | it is the `r2.dev` dev URL; `media.setnayan.com` does not resolve |
| `next.config.ts` | "`R2_PUBLIC_URL` is unset in production today" | it **is** set (`vercel env ls production` — Secret, 2026-09-07) |

Measured in the Cloudflare dashboard: `setnayan-media` (2.1k objects, 1.11 GB, APAC) has **no
custom domain**, and its Public Development URL is the **only** public path. `samples` and
`thread-files` have it disabled — private, presigned-only, exactly as `lib/r2.ts` documents.

🔑 **The cost is not the wrong hostname, it is the lost trust.** `r2-client-ref`'s docblock is
the security argument for why presigning a media key is safe — an argument that turns on the
bucket being *public*, not on which hostname serves it, so the reasoning stayed correct. But a
reader checking the one verifiable claim in it would have found a host resolving to nothing, and
no way to tell which neighbouring claims were also stale.

Also: `CLAUDE.md` said **4** R2 buckets. There are **5**, and `lib/r2.ts` has always known it.

### The guard — a property, not a phrasing ban

`the-public-media-host-is-one-fact.test.ts` asserts **no file states that string as the VALUE of
`R2_PUBLIC_URL`**. ⚠ It deliberately does *not* ban the hostname: it appears legitimately in the
CSP allowlist, in retirement notes, in "does not resolve" warnings, and in `publicUrlFor`'s own
advice about what a custom domain *could* be. A ban would convict all of those and still miss a
reword. It also checks that `CLAUDE.md`'s bucket count equals `R2_BUCKETS`.

🪤 **Its first run convicted itself** — this changelog's own table and the test's docblock quote
the bad pattern to document it. Tests are excluded, same as every other tree-scanner here: a test
naming the binding is recording history, not claiming it.

Two sabotages, two catches, each with the count printed so the mutation is proven to have applied:
restoring the dead-host claim (0 → 1 asserting files) and putting the bucket count back to 4
(`R2_BUCKETS has 5; CLAUDE.md claims 4`).

### ⚠ What this change deliberately does NOT do

It does not move anything off `r2.dev`. **The owner ruled 2026-09-05 that `media.setnayan.com` is
not being set up**, and `next.config.ts` already recorded that ruling. Moving would require
`setnayan.com` to become a Cloudflare zone — the Domains list is empty, confirmed today — and a
partial (CNAME) setup that would keep DNS at GoDaddy is Business-plan-only. The only free path is
a full nameserver migration, which carries the iCloud MX records that `noreply@` depends on. At
current volume r2.dev's rate limits are nowhere near binding.

🛑 If that migration ever happens: **add the custom domain, verify, THEN disable the dev URL.**
It is the only public path today — disabling it first blacks out 1.11 GB of media instantly.

SPEC IMPACT: None.
