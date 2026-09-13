## 2026-09-08 · docs(encoder): S14–S17 prompts, and the plan of record stops lying

The 2026-09-07 hand-off said two build sessions remained, both "0 commits — relaunch them".
**Both were already merged**: S12 the auto-updater (#5252) and S13 as a pre-flight readiness
check (#5250). It read `git rev-list origin/main..<branch>` as `0` and concluded "never
started" — **a MERGED branch and a NEVER-STARTED branch both read zero.** Acting on it would
have rebuilt two finished sessions.

Measured 2026-09-08 while checking that:

- **Nobody can install the desktop app.** `/api/download/mac` and `/api/download/windows` both
  answer **503**; the whole `desktop/` prefix **404s** on the live R2 host; `gh secret list`
  shows **none** of the four R2 secrets in the GitHub Actions store (X0 item 6, now marked
  BLOCKING).
- **The updater points at a hostname that does not exist.** `media.setnayan.com` is NXDOMAIN
  from three independent public resolvers. The owner had **already ruled it is not being set
  up** (`scripts/upload-decor-pilot-to-r2.ts`, MB14b) — but `tauri.conf.json`'s updater endpoint
  and `updater.rs`'s `EXPECTED_ENDPOINT_HOST` guard both pin it, and that guard would refuse the
  host production actually serves R2 from. Both strings ship inside the signed binary. New X0
  item 7; **S14** fixes it.
- **`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is ON in production** — measured, not asked: the paid
  `LIVE_STUDIO` row renders on the anonymous `/pricing` page, and `lib/v2-catalog.ts` excludes
  that SKU by name whenever the flag is off. X0 item 4 is half closed.
- **`build-sessions/encoder/README.md` was still the retired E0–E9 plan** while every S-series
  prompt's rule 17 called it the S-series plan of record. Rewritten to the real state.

Adds `S14.md` (repoint the host + the CSP that names the dead one), `S15.md` (the first real
publish), `S16.md` (the real YouTube publish; replaces the guessed `DEFAULT_GRACE = 120s`),
`S17.md` (60-minute thermal, memory, the OS matrix, Windows). Docs only — no code change.

SPEC IMPACT: None — session prompts and status corrections, not a product decision.
