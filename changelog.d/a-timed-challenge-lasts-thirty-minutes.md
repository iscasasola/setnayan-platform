## 2026-09-01 · feat(papic): a timed challenge lasts 30 minutes, an hour, or two

Owner, 2026-09-01, refining the clock that shipped hours earlier (#5070):
*"timed challenges by default lasts for 30 mins. but they can pick whether, 30
mins, 1 hr, 2 hrs"* and *"one challenge, but the other challenges may still be
there."*

⚠ **This supersedes the same day's "no duration column, no default duration
number" — deliberately, and the old rule's own reasoning is why it is safe to.**
That rule was never "durations are wrong"; it was the `DEFAULT_CAPTURE_MIX`
rule — *don't guess a number that governs something*. The number was missing
because nobody had chosen it. It is not missing any more. The original ruling
even anticipated this: a duration "may be added later without redoing the
schema, since `armed_at` is already the anchor" — and nothing about the clock's
shape changed.

- `supabase/migrations/20271188710305_papic_timed_challenge_duration.sql`
  - `papic_missions.armed_duration_minutes` — `NOT NULL DEFAULT 30`, `CHECK IN
    (30, 60, 120)`. A fourth length is a decision and now fails at the database
    rather than appearing quietly on a wall.
  - `papic_challenge_ends_at(mission_id)` — **the one place an end instant is
    computed**, split out of the verdict because a screen now needs the instant
    too. Three things can end a timed challenge and **the earliest wins**: its
    own timer · the next arming · the capture window.
  - `papic_challenge_is_open()` now delegates its time term entirely to that
    function and re-derives none of it.
  - `papic_armed_challenge()` returns `duration_minutes` + `expires_at` — an
    **instant, not a remaining-minutes count**, which is stale the moment it is
    painted.
  - `papic_arm_challenge(mission_id, duration_minutes DEFAULT 30)` — dropped and
    recreated rather than overloaded, so the codebase does not end up with two
    ways to arm a challenge, one of which ignores the duration.

⛔ **"One challenge, but the other challenges may still be there."** Arming, and
expiring, take **nothing** off a guest's board. `papic_challenge_is_open()` means
"is this the timed challenge running", never "may a guest do this" — that is
`papic_guest_missions`, untouched here. Pinned by a db test that arms a
challenge, runs its clock out, and asserts the guest's board is identical
throughout; a mutation that filters the board by the timed challenge turns it
red.

**The wall now uses the real clock.** `fetchWallArmedChallenge` (`lib/live-wall.ts`)
had been picking the board's **first slot** as "the armed challenge" — the honest
stand-in it needed before the clock existed, and flagged as such when #5070 landed.
Both PRs have merged, so the divergence was live: the wall could project one
challenge while the couple's screen named another. Its guard test inverted with
it — it used to require the ordering rule to be present in that file, and now
requires it to be **absent**. The wall goes quiet between challenges, which is a
true statement it was previously unable to make.

- `lib/papic-challenge-clock.ts` — the three lengths, their labels, and
  `expiresAt`. Still contains no date comparison.
  `lib/papic-challenge-clock-lengths.test.ts` reads the **migration text** and
  fails if the picker and the CHECK constraint ever disagree.
- The couple's manager gets a length picker on each "Ask now" and an
  "until 10:30 PM" on the live challenge — formatted in the **celebration's own
  timezone**, because this renders on the server and would otherwise have shown
  a Manila couple their reception's challenge ending at "2:30 PM".

**Exposure baseline** 6346 → 6348: one new column in the same
`anon=- authenticated=SIU` shape as every other on the table, one new
`secdef=no exec=authenticated` function, and `papic_arm_challenge`'s signature
replaced. No new principal, no anon reach.

Tests: 12 db cases (was 8) and 10 unit cases. Three mutations of the migration
each turn the db test red — removing the timer term, ignoring the couple's pick,
and filtering the guest board by the timed challenge.

SPEC IMPACT: `DECISION_LOG.md` — new row superseding the "no duration" clause of
the earlier 2026-09-01 ruling. `WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 4 —
4a extended and 4b's stand-in retired.
