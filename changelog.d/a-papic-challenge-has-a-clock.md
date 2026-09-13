## 2026-09-01 · feat(papic): a challenge gets a concept of time

Papic Build Order § 4a. A challenge had **no concept of time anywhere** — no
window, no countdown, no expiry — so a prompt armed during the first dance was
still exactly as live at 3am. The 500-prompt library, the per-event board and
the completion board all shipped around a challenge that never ended.

**The clock is RELATIVE** (owner ruling 2026-09-01, `DECISION_LOG.md`): the
window opens when a challenge is **ARMED**, one is live at a time per
celebration, arming the next closes the previous, and the last closes when the
capture window ends (`events.papic_window_end`). **No duration column and no
default duration number** — the design does not need one, so none was invented.

- `supabase/migrations/20271188446868_papic_challenge_clock.sql`
  - `papic_missions.armed_at` / `.closed_at` (Pattern B RLS inherited from the
    table's existing `papic_missions_member_all`; no new policy surface).
  - `papic_missions_one_armed_per_event` — a PARTIAL UNIQUE INDEX, so "one live
    at a time" is something the database refuses to break rather than a habit
    every writer has to remember.
  - `papic_challenge_is_open(mission_id)` — **the one place** the question is
    decided, modelled on `papic_guest_spend_ceiling()`. FALSE in four distinct
    ways: never armed · closed by a later arming · hidden from guests · the
    capture window ended. Derived at read time, never stamped.
  - `papic_armed_challenge(event_id)` — the event-shaped question, defined in
    terms of the predicate so the two cannot disagree.
  - `papic_arm_challenge(mission_id)` — close-then-open in ONE transaction.
    SECURITY INVOKER: authorisation is Pattern B and nothing else.
  - Every function is `REVOKE ALL … FROM PUBLIC, anon` — the anon surface does
    not grow (Postgres grants EXECUTE to PUBLIC by default, and silence there
    would have widened it).
- `apps/web/lib/papic-challenge-clock.ts` — the honest reader. `measured:false`
  ≠ "nothing is armed". Contains **no** date comparison, deliberately.
- `apps/web/app/dashboard/[eventId]/studio/papic/` — `armChallengeAction` plus
  an "Ask now" control and a "Being asked now" line, so the clock reaches a
  screen instead of governing nothing.
- Tests: `apps/web/tests/db/a-challenge-stops-being-asked.db.test.ts` (8 cases,
  every one a refusal; five mutations of the migration each turn it red) and
  `apps/web/lib/papic-challenge-clock.test.ts` (6 cases, source guards
  mutation-checked).

**Exposure baseline regenerated** (`supabase/security/exposure-surface.baseline.txt`,
6341 → 6346 facts) — the freeze guard caught this branch and it is a deliberate
widening, reviewed line by line: the two new columns land as
`anon=- authenticated=SIU`, byte-identical in shape to every column
`papic_missions` already had (including `approved` and `is_active`, which decide
whether a challenge reaches a guest at all), and the three functions are
`secdef=no exec=authenticated` — SECURITY INVOKER, no anon, so they grant
nothing a caller could not already do through Pattern B. **No new principal, no
new table, no anon reach.**

🔴 **EXPIRY CLOSES THE PROMPT, NEVER THE SHUTTER.** No capture path was touched
and none may call this — pinned by a test asserting `papic_complete_mission`
still succeeds on a challenge the clock has closed.

🛑 `vendor_profiles.papic_challenge_expires_at` is NOT this clock and never was
— it is a shop's 28-day subscription expiry. Read the column's TABLE.

⚠ **FOLLOW-UP, NOT DONE HERE:** `fetchWallArmedChallenge` (`lib/live-wall.ts`,
PR #5067, a parallel session) picks the board's **first slot** as "the armed
challenge" — the stand-in it had to use because this clock did not exist. Once
both land it should call `papic_armed_challenge` instead, or the wall and the
couple's screen can name different live challenges. Not changed here: those
files belong to that PR.

SPEC IMPACT: `WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 4 — the clock half
of item 4 is built; the wall half is PR #5067. `DECISION_LOG.md` row already
records the ruling; no new decision was taken.
