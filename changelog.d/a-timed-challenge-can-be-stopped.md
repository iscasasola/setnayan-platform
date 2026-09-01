## 2026-09-01 · feat(papic): stop a timed challenge early, and pin who may start one

Two owner rulings from 2026-09-01 — one built, one measured as already true.

### Stop — the prompt ends, the challenge stays

Until now a timed challenge ended three ways: its timer ran out, somebody armed
the next, or somebody **hid** it. The third was the only way to say "we're done
with that one", and it is the wrong act wearing the right label.

⛔ **Hiding and stopping differ by the guest's board.** `is_active = false`
removes a challenge from every guest's board — nobody can answer it any more.
Stopping ends only what the room is being *asked* and leaves the challenge
exactly where it was, still answerable, like the others ("one challenge, but the
other challenges may still be there").

- `supabase/migrations/20271189144105_papic_stop_a_timed_challenge.sql`
  - `papic_stop_challenge(mission_id)` — SECURITY INVOKER, Pattern B.
  - `papic_close_open_challenge(event_id, at, only_mission)` — the ONE place
    `closed_at` is written, so arming (close-then-open) and stopping (close
    only) cannot drift about what "close" means.
- A db test asserts the guest's board is **byte-identical across a stop**.
  Without it, `is_active = false` is the cheapest implementation of "stop" and
  passes every other assertion in the file.

🔴 **Two flaws in the first draft, both found by mutation, neither by reading:**

1. The stale-Stop guard checked **after** closing whether it had closed the
   right row. Under a real race — a coordinator's page goes stale while the host
   arms a different challenge — the other challenge is already closed by then,
   and returning "failed" does not un-close it. The predicate now lives **inside
   the UPDATE**, so a close can only ever land on the mission the button was
   rendered for.
2. An early-return fast path made that guard **unreachable by any test**:
   mutating the scope argument to NULL left the entire suite green while
   re-introducing the race. The branch changed no outcome and hid the guard from
   its own tests, so it is gone. Both mutations now turn cases red.

### Who may start one — measured, not built

Owner: *"the timed challenge will be set by the host of the event and the
coordinator"* … *"not the guests."* `papic_missions_member_all` (Pattern B)
**already** admitted exactly `member_type IN ('couple','coordinator')` plus
admin, so no code changed — but nothing said so, and the rule was true only by
accident of a policy written for another purpose. Four db cases pin it now:
host ✅ · coordinator ✅ · a legitimately-invited guest ❌ · a booked vendor ❌.
Widening the policy to every event member turns exactly the two ❌ cases red.

Two traps written down rather than left to be rediscovered:

- **"Host" is `member_type = 'couple'` at every event type.** There is no
  `'host'` member type — the enum is `('couple','guest','vendor','coordinator')`
  and `'couple'` is the organiser's row at a birthday and a wake alike. Only the
  on-screen word varies (`the-couple-is-not-every-host.test.ts`). Reading the
  enum value as wedding-only is how somebody concludes a celebrant cannot run
  their own party.
- **A coordinator passes two doors on two different rows** — the dashboard shell
  on an accepted `event_moderators` row, the challenge policy on an
  `event_members` coordinator row minted by the `sync_delegate_membership`
  trigger (owner 2026-08-24). A door that writes one and not the other yields
  somebody who can see a control that does nothing.

Tests: 21 db cases (was 16) and the full suite at 2022/2022.
Exposure baseline 6348 → 6350: two new `secdef=no exec=authenticated`
functions, no new principal, no anon reach.

SPEC IMPACT: `DECISION_LOG.md` rows for both rulings;
`WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 4 updated.
