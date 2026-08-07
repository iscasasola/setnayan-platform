## 2026-08-07 · chore(security): regenerate the exposure baseline after rebasing onto main

The PR was red on `THE FREEZE: the exposure surface has not widened against the
committed baseline` — the usual cross-PR collision. This branch was **130
commits behind main**, so the baseline generated on it no longer described the
merged result. Rebased and **regenerated**, never hand-merged.

The delta is exactly this PR's own change: one added function,
`vendor_tier_rank(vendor_tier_state)`.

**Left anon-executable, deliberately, and the reasoning is the point.** The
sibling change to `call_rtc_can_access` in #4191 got a
`REVOKE ALL … FROM PUBLIC` in the same migration. This one does not, and the
difference is not inconsistency:

- `call_rtc_can_access` **queries a table** (`chat_threads`). It was already safe
  because its body returns FALSE for anon — but *"safe because the body checks"*
  and *"unreachable"* are different guarantees, and only the second survives
  somebody editing the body later. Worth the revoke.
- `vendor_tier_rank` is `LANGUAGE sql IMMUTABLE` with `SET search_path = ''` and
  a single `CASE` over an enum. It reads nothing, touches no table, and consults
  no session state. There is no data behind it to reach, so a revoke would
  remove a line from a report without removing any access.

🔑 **The baseline is a record, not a prohibition.** Recording a genuinely inert
function is the honest entry; revoking to keep the number down would make the
file describe the system less accurately, which is the one thing it exists not
to do.

Verified: exposure-freeze + anon-rpc-surface + rpc-argument-names 15/15,
typecheck clean.

SPEC IMPACT: None — regenerated baseline only. The subscription-downgrade and
partnerships fixes in this PR are unchanged.
