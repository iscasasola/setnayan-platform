## 2026-07-18 · fix(security): durable per-IP throttle on anonymous-draft onboarding mints (anon-onboarding hardening PR-2)

Pre-enable bot/flood protection for the `NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`
feature. With the flag on, the onboarding commit mints a Supabase native
anonymous session — a real account + event from nothing — and the commit is a
plain server-action POST a script can hit directly (no widget). The only bot
gate was Supabase's global captcha switch; the in-memory limiter
(`lib/rate-limit.ts`) is per-instance and keyed on `user.id`, so it does nothing
here (every mint gets a fresh uid). This adds a durable, cross-instance per-IP
cap that bounds abuse regardless of whether the owner has enabled Supabase
captcha.

- **Migration `20270822205100`** — `anon_onboarding_ip_throttle` table (RLS on,
  zero policies = deny-all) + `claim_anon_mint_slot(ip_hash, max, window_seconds)`
  SECURITY DEFINER RPC (pinned `search_path`, granted only to `service_role`).
  Atomic rolling-fixed-window compare-and-swap via `INSERT … ON CONFLICT`;
  opportunistic per-window reset, so no cron/sweep is needed.
- **`lib/anon-mint-throttle.ts`** — `allowAnonMint(admin)`: hashes the caller's
  IP (salted SHA-256, **never the raw IP** — RA 10173 data-minimization),
  claims a slot, and returns whether the mint may proceed. **Fails OPEN** on a
  missing IP header or any infra error — a throttle glitch must never lock a
  real couple out of creating their event. Current limit: 5 mints / IP / 24h.
- **Wiring** — both anon-mint call sites (`onboarding/_shared/commit-event.ts`,
  `onboarding/wedding/actions.ts`) call `allowAnonMint()` before
  `signInAnonymously()`; over-limit returns `{ ok: false, error: 'rate_limited' }`.

Papic/Panood anon claims are intentionally untouched — they already require a
valid, unclaimed (paid) seat/camera token, so they can't be used for unbounded
account creation. Feature stays flag-OFF; nothing calls the RPC until it flips,
so the table stays empty. Non-anonymous behavior is unchanged.

SPEC IMPACT: None. (Launch-posture hardening; new internal throttle table + RPC,
no product/pricing/SKU change.)
