## 2026-09-16 · fix(papic): the camera says what is true about a guest's credits

**PAP-2 · the refusal tells the truth.** `app/api/upload/route.ts` told a guest
*"This camera has used today's shots — it refills tomorrow."* Nothing refills a
Papic seat. Measured against production: `papic_capture_points_available` =
`papic_seat_dedicated_points` − `papic_seat_point_usage.points_used` +
`papic_event_pool_status(...).remaining_points`; none of them carries a date, a
day boundary, a reset or a `now()`, the usage table has no period column to hold
one, the only three functions that reduce `points_used` are release paths (a
failed capture, a returned split), `cron.job` is empty and none of the 22 job
keys in `cron_job_runs` touches seat usage. The ceiling is CUMULATIVE.

A false reassurance is worse than a refusal: she reads it, stops asking, does
not tell the couple, does not buy more — and the wedding ends that night.

- The old branch condition did not ask the question it looked like it asked.
  `papic_capture_points_available` **already adds the pool in**, so
  `seatGate === 'exhausted'` means "her own balance and the pot together are
  short" — true for a pool guest who never owned a credit, which is the common
  case. The honest discriminator is the `INT4_MAX` sentinel from
  `papic_event_points_remaining_for_seat`, which the route already reads.
- The 409 and `code: 'camera_points_exhausted'` are **unchanged** — terminal
  semantics, no retry, no orphan bytes. A new `reason` field carries the cause,
  because every consumer reads `code` and throws `error` away: a sentence nobody
  renders is a measurement that never reached a pixel.
- A successful presign now returns `ownCamera`, so the **record** seam's refusal
  still names the right cause. That seam is not a race — the presign gates a
  clip at the cheapest band, so a long clip routinely passes it.
- Two sentences, two next steps: she can top up her own camera; only the couple
  can top up the shared pot. Each names a remedy only when it is on the screen
  (`buyOffered` is the same boolean that mounts `<PapicGuestBuyPanel>`).

**PAP-13 · credits count at upload, and the arrival tells her.** The counting
half was **already true and is a no-build**: every reserve runs server-side at
the presign and record seams, and a shot sitting in the offline queue has spent
nothing. What was missing is the consequence. A `capped` shot drew **no overlay
at all** in the roll — a bare thumbnail, indistinguishable from a photograph
that was kept — under a panel reading *"every photo and clip is in the host's
gallery"* while some of them were never saved. It now carries a badge, an
aria-label, and a per-photo tally: *"3 of your 8 shots landed."*

**The couple is told.** New `papic_pool_spent` notification (enum label added by
migration `20271230670036`), on `EMAIL_ENABLED_TYPES` and deliberately **not** in
`MARKETING_GATED_EMAIL_TYPES` — the two halves of one mechanism; having one is
indistinguishable from having neither. Deduped over a 12-hour window so a
reception's hundreds of refusals send one notice, and a couple who top up and run
dry again are still told.

SPEC IMPACT: `DECISION_LOG.md` — records that the 2026-09-16 ruling
*"keep it. it will only count if uploaded"* is what the code already does, and
that the retired "spent at capture" line was never the shipped behaviour.
