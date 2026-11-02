## 2026-08-07 · sec(calls): rebase onto main, regenerate the freeze baseline, and revoke the default PUBLIC grant

The PR was red on `THE FREEZE: the exposure surface has not widened against the
committed baseline` — the usual cross-PR collision: other PRs merged their own
policies while this branch was open, so the baseline generated here no longer
described the merged result. Rebased onto main and **regenerated** (never
hand-merged: two sides editing the same running totals is what makes this file
conflict, and regenerating is the only resolution that stays truthful).

**Also tightened one real thing.** `call_rtc_can_access` shipped with
`GRANT EXECUTE … TO authenticated` and no REVOKE. Postgres grants EXECUTE to
PUBLIC on every new function, so the GRANT was not what decided who could call
it — the default was, and `anon` could. The baseline recorded exactly that:

    -func … call_rtc_can_access … exec=anon,authenticated
    +func … call_rtc_can_access … exec=authenticated

The function was already safe (`auth.uid() IS NULL` returns FALSE on its first
line), but 🔑 **"safe because the body checks" and "unreachable" are different
guarantees, and only the second survives someone editing the body later.** With
the REVOKE, this PR adds no new anon-reachable surface at all.

SPEC IMPACT: None — narrowing only. The call channel's authorisation rule is
unchanged; `chat_threads` RLS remains the single definition of who may join.
