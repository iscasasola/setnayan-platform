## 2026-07-22 · fix(admin): RA 10173 erasure — delete the user's own uploaded files from R2

Follow-up to #3544 (owner-confirmed). Erasure nulled the DB pointers to a user's
uploaded files but left the actual objects in R2 (a nulled `profile_photo_url` /
`logo_url` orphans the file). `eraseUserAccount` now, as a new best-effort step,
deletes the objects behind the user's **own** files: their **profile photo** and
their **shop logo**.

- Captures the two `r2://` refs BEFORE the anonymize nulls the columns, then
  `r2Delete`s them after the DB scrubs.
- Best-effort: `r2Delete` throws only if R2 is unconfigured → caught + audit
  logged, so a storage hiccup can't trap the erasure. Only current-flow `r2://`
  refs are removed (a legacy/external URL is left — may not be ours). Idempotent
  (S3 delete is a no-op for a missing key; a re-run finds the pointers already
  nulled).

Scope note (owner-verified 2026-07-22): the "scary" R2 items the schema audit
surfaced are **not live** — gov-ID scans + selfies were RETIRED 2026-07-03 (never
stored), biometric vectors are dormant (feature flag off / no face model), and
Google/TikTok/IG connected-login tokens are dormant (flag-gated / not_configured).
So the real user-uploaded files today are profile photos, shop logos, and shared
event/Papic photos — and only the first two are cleanly the user's OWN (event
photos are shared → left for the DPO shared-record ruling).

SPEC IMPACT: completes the owner-scoped erasure (files, not just DB rows);
DECISION_LOG row appended.
