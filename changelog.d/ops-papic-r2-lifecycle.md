## 2026-06-25 · ops(papic): script to apply the R2 lifecycle rules (sampler-byte cleanup)

Adds `apps/web/scripts/apply-papic-r2-lifecycle.mjs` — the cron-free guaranteed cleanup for abandoned free-Papic-sampler bytes (the only per-couple marginal cost). Turns the owner action into one command (with the Vercel R2 creds in the env): `--verify` (read-only, default) → `--dry-run` → `--apply`.

Applies TWO lifecycle rules on bucket `setnayan-media` — prefixes `papic-sampler/` AND `derivatives/papic-sampler/` (the derivatives live in a parallel tree, so a single-prefix rule would miss them), each Expire/delete after 37 days (30-day retention + 7-day grace). Safety: **MERGES** the two rules into the bucket's existing lifecycle config (matched by rule ID), never clobbering other rules; uses the same R2 client config as `lib/r2.ts`.

This is now DATA-LOSS-SAFE (it was NOT before #2160): on convert, `makeSamplerPermanent` relocates a kept couple's bytes OFF both ephemeral prefixes onto `papic/`, and the record-layer cap + 5-key sweep ensure only genuinely-ephemeral bytes remain under `papic-sampler/`. So the age-based expiry can only reap abandoned sampler bytes. Requires #2138/#2145/#2150/#2160 (all merged + deployed).

Not run here — no R2 creds in the build session (they live in Vercel). Owner runs it once (or uses the Cloudflare dashboard: R2 → setnayan-media → Object lifecycle rules → two delete rules, those prefixes, 37 days). Syntax-checked + load-verified (imports resolve, hits the cred guard).

SPEC IMPACT: None (ops tooling; the rule itself is the long-noted owner action).
