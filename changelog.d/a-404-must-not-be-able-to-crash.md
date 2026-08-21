## 2026-08-21 · fix(routing): a wrong address can no longer crash instead of 404ing

On 2026-08-21 **every unknown top-level address on the live site returned a
server error with an empty body** — `/connect`, `/zzz-not-a-real-page-9x8`,
`/definitely-not-real-abc123`, all 500, measured three times. `/blog/anything`
404ed correctly, which pointed at the bare-root catch-all.

By evening the same addresses returned a correct 404, **sampled 38 ways across
six words plus eight never-before-seen ones — all 404**, with a real
"Link not found · Setnayan" page. Nothing in the day's commits touched that
route. **Whatever failed was transient, and that is precisely the problem: the
404 DEPENDED on a read that can fail.**

🔑 **THE MISS PATH USES THE ADMIN CLIENT EXACTLY ONCE**, for retired-address
forwarding — a kindness to whoever printed an old link. `createAdminClient()`
**throws** when its env vars are absent (`lib/supabase/admin.ts:45`, and that
exact string appears in a CI log from today). A kindness must not be able to
escalate a not-found into a crash, so the lookup is now wrapped and falls
through to the vendor check, which `notFound()`s.

**Why it matters beyond tidiness:** Google reads a 5xx as *"the site is broken,
come back later"* and KEEPS the URL; it reads a 404 as *"that page is gone."*
Widespread 5xx can slow crawling of the whole site. A person got a blank crash
page instead of a sentence.

⚠ **NARROW ON PURPOSE — `redirect()` STAYS OUTSIDE THE TRY.** Next implements
`redirect()` by THROWING; catching around it would swallow every forward and
silently strand the printed QR the block exists to rescue. The guard asserts
that ordering explicitly, because it is the exact mistake a later tidy-up makes.

⛔ **NOT RESTRUCTURED, and named rather than smuggled in:** `createAdminClient()`
is called at the top of the route and used **20 times on the hit path**. If it
throws, every event page breaks, not just unknown words — a larger fragility
than this change addresses. Rewriting the client lifecycle on the most important
public route, to chase a fault that no longer reproduces, is speculative surgery
on shipped code. Flagged for the owner instead.

🛡 `a-404-must-not-be-able-to-crash.test.ts` — mutation-proved outside the
toolchain: removing the try turns three checks red; moving `redirect()` inside
it turns the ordering check red; restoring returns all four to green.

Not verified locally: no `node_modules` and `npm run build` cannot complete here.

SPEC IMPACT: None.
