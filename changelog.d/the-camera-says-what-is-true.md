## 2026-09-16 · fix(papic): the camera says what is true about a guest's credits

**PAP-2 · the refusal tells the truth.** `app/api/upload/route.ts` told a guest
*"This camera has used today's shots — it refills tomorrow."*

⚠ **The first correction is to the REASON, not the verdict.** An earlier pass of
this work asserted *"nothing refills a seat, anywhere in the schema"* — **false
as stated.** `papic_tier_config.points_per_day` minus
`papic_seat_day_usage.points_used WHERE usage_date = CURRENT_DATE` is a genuine
daily allowance, read by `papic_camera_points_remaining` and enforced by
`papic_reserve_camera_points`. It resets with **no job at all** — tomorrow is
simply a different row. Searching for a scheduled job, finding none, and reading
that absence as proof was the wrong mechanism.

**Why the sentence is still false for every guest who exists** (measured in
production, the tier table re-measured independently after the correction):
`free` is the only active tier and the only tier any of the 23 production seats
is on, and its `points_per_day` is **NULL**; `ltd` (70) / `roll` (200) /
`unlimited` (500) are all `is_active = false` with zero seats;
`papic_seat_day_usage` holds **zero rows, ever**; and the only two functions that
read the daily budget have **no caller anywhere** — 0 in `apps/`, 0 in RLS
policies, views, CHECK clauses or other functions. (`papic_reserve_camera_capture`
appears once inside `papic_record_guest_capture` — **in a comment**.) What
`api/upload` actually resolves is `papic_capture_points_available` (dedicated −
used + pool) and `papic_event_points_remaining_for_seat`; neither carries a date,
and the dedicated bucket is "a lifetime bucket, not a daily one" in the live
SQL's own words.

⛔ **So the honest sentence is not hardcoded either.** "It refills tomorrow" is
TRUE on a tier that carries a `points_per_day`, and three of them are one
`is_active` flip away. `exhaustionDetail` takes a `dailyBudget` the route reads
from **this seat's own tier row** (failing to `false`), and when a daily
allowance does exist the copy says so *and* says which budget it is not — so
"tomorrow" can never be read as applying to the one that just refused.

A false reassurance is worse than a refusal: she reads it, stops asking, does
not tell the couple, does not buy more — and the wedding ends that night. With
one shared pool (owner: *"the guests or anyone connected to the papic app via
event hub except vendors share the same pool"*) the pool case is the **common**
one, so both sentences name **who can act**: she cannot top up a pool she shares;
the couple can.

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
