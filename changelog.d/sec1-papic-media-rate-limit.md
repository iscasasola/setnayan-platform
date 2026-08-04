## 2026-07-30 · fix(security): SEC-1 lanes #4 and #5 — a bandwidth guard on the public media route, and a "do not shorten" pin on the 7-day presigns

The last two small lanes from #3729. One is a fix; the other is a **finding that the register's suggested fix would have broken the public homepage.**

### Lane #4 — a bandwidth guard on `/papic/media/[...key]`

The route is unauthenticated **by design**: crawlers (Facebook, iMessage, Pinterest) re-fetch OG images on their own schedule with no auth, and it exists precisely so a cached preview never pins a soon-dead signed URL. `SERVEABLE_BUCKETS` is media-only, so the register is right that there's no confidentiality delta.

What *is* worth bounding is **bandwidth**: this streams bytes *through the function*, so a caller looping it is a real egress and compute bill in a way a direct R2 hit isn't.

**The limit is deliberately generous and skips revalidations**, because the intended consumers are exactly the traffic a naive limiter would break:

- **conditional requests (`If-None-Match`) are not counted at all** — they short-circuit to a 304 without streaming a byte, and they're the crawler/browser-cache pattern we *want*
- only full-body streams count, at **600/min per IP** — a guest opening a gallery pulls many stills at once, and a household or venue behind one NAT looks like a single IP
- it **fails open**: a limiter fault must never black out a wedding's photos
- the 429 carries `Cache-Control: no-store`, so no intermediary caches a refusal in place of an image

Per `lib/rate-limit.ts`'s own header this is per-instance best-effort defence-in-depth, not a cross-instance guarantee. Stated rather than implied.

### Lane #5 — **must not shorten**, and now pinned

The register says *"admin surfaces still issue 7-day TTLs, `assertAdmin`-gated, so not urgent."* Two corrections after reading the code:

1. **They are not admin-only.** `lib/hero-video.ts` and `lib/background-videos.ts` are consumed by `app/page.tsx` — the **public homepage**, on ISR (`revalidate = 300`). A bad TTL change is a *public* breakage, which makes it more dangerous to touch casually, not less.
2. **The 7 days is load-bearing**, and both files already say why: the signed URL is kept stable across the re-sign interval so a returning visitor re-uses browser-cached frames *"not re-download tens of MB"*. 7d is the SigV4 maximum, sitting deliberately above the ~6d re-sign interval.

So shortening these — the obvious "hardening" — would hand out URLs that **expire before the app next re-signs them**: a dead hero video on the highest-traffic page in the product, appearing hours after the deploy and only for visitors whose cache had gone cold.

**What I pinned is the relationship, not the magic number**, so a future pass *may* shorten these — it just has to do it coherently:

> presign lifetime **>** re-sign interval, with ≥1h margin, and ≤ the SigV4 7-day ceiling

Freezing the value would have traded one hazard for another. Encoding the invariant leaves the door open and makes the requirement impossible to miss.

**Probed with the exact wrong fix:** setting `PRESIGN_TTL_SECONDS` to 1 hour while leaving the re-sign at 6 days fails *"the presign outlives the re-sign interval (the homepage hero frames)"* by name.

**Verification:** `tsc --noEmit` clean · `next lint` clean · **`test:unit` 5,557/5,557 pass**.

**The SEC-1 deferred list is now fully worked**: lane #1 (private-bucket binding) · #2 (all five write paths) · #4 (this) · #5 (won't-fix, pinned). **Lane #3 remains and cannot be fixed by a guard** — `editorial-vendor/` is a flat untenanted prefix, so it needs a tenant segment in the *key layout*, i.e. an uploader change plus a migration of existing objects.

SPEC IMPACT: None — no price, SKU, schema, flag or RLS change. Security register updated.
