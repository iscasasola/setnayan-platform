## 2026-07-11 · fix(security): Postgres-backed rate limiting + timing-safe secret compares

From a parallel security audit. No new infra (Postgres is the durable store).

**Rate limiting (two-layer, fails open):**
- Migration `20270717007780` — UNLOGGED `rate_limit_hits` + a service-role `check_rate_limit()` SECURITY DEFINER RPC (atomic sliding window; modeled on the repo's existing `register_guest_claim_otp_attempt` limiter). **⚠ Not yet applied to prod** (Supabase MCP was disconnected mid-session; `supabase db push` would apply a concurrent session's pending migrations too — apply this one migration when the DB is stable). The limiter **fails open** if the RPC is absent, so shipping the code first is safe (degrades to the in-memory L1 layer).
- `lib/with-rate-limit.ts` — `enforceRateLimit(bucket, ident, {limit, windowSecs})` = in-memory L1 short-circuit (`lib/rate-limit.ts`) then durable L2 RPC; `rateLimited429()`. `lib/client-ip.ts` consolidates the ad-hoc XFF parsing.
- **Wired the 3 highest-risk anon surfaces:** `POST /api/wall/claim` (the anon 6-char code-guessing oracle — per-IP 10/min **and** per-event 30/hr so the code space can't be brute-forced across IPs), `GET /api/slugs/check` (60/min per IP; deleted the false "Vercel edge limits" comment), and the couple-waitlist action (5/min per IP — junk-list-poisoning guard).

**Timing-safe secret compares:**
- `lib/secure-compare.ts` (length-guarded `crypto.timingSafeEqual`). Replaced the plain `!==` secret checks in `/api/admin/cron/dispute-counter` and `/api/internal/patiktok/process-job` (the two routes that weren't already constant-time).

**Deferred (flagged, not in this PR):** per-key rate-limiting on the `/api/v1` bearer SDK (that SDK is gated OFF by default — see the breach PR — so it's moot until blessed); login/signup app-level limits (Turnstile is the primary gate there); the `/api/upload` generic-branch authorization scoping (a medium finding that needs careful per-bucket ownership checks — deferred for a focused follow-up rather than shipped blind); persona/veriff webhook HMAC (inert stubs today, no present exploit).

SPEC IMPACT: None (security hardening). Every other cron/webhook/admin route was audited and verified already correct.
