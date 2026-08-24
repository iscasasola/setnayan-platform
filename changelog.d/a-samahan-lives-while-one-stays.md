## 2026-08-24 · fix(samahan): nobody could leave a samahan · and a group lives while one person stays

Owner tried to leave his own samahan and nothing happened.

🚨 **`community_members` has a DELETE POLICY and had no DELETE GRANT.**
Postgres checks the grant first, so every leave was refused before RLS was
ever consulted — the policy had never once been reached. Both shipped callers
were dead: **"Leave this samahan" for every member**, and **an organizer
removing anybody**. Broken since `20271023100000`, whose own comment says it
granted back *"the three verbs the shipped paths actually use"* — a list
written from REMEMBERED PATHS while a DELETE policy sat in the same schema
declaring DELETE is a shipped path. **Enumerate the verbs from the POLICIES.**

⚖ **Owner ruling:** *"the only way to close a group/samahan is when all
members leave the samahan. but for as long as there is one, the group
lives."* Closing is a CONSEQUENCE, not an act performed on other people:
- `archiveCommunity` is **deleted**, and the organizer's Archive button with
  it — replaced by the rule in words, since silence reads as unfinished.
- The database refuses it independently: the field guard raises while any
  membership row remains. **The button is not the door** — `communities` is
  served over PostgREST to a public anon key.
- The leave path now **proves its own delete** (`.select()`) and re-counts
  AFTER it. It previously archived on a count taken BEFORE a delete it never
  verified — a refused delete plus a stale count closes a live samahan.

🛡 New guard `every verb a POLICY declares is a verb the role was GRANTED`,
counting column grants too (ignoring them makes `events` look broken). It
found **7 more** unreachable policies; each is grepped to a service-role
writer and recorded WITH ITS REASON, not silently baselined.

5 db tests · 4 measured mutations.

SPEC IMPACT: DECISION_LOG.md 2026-08-24.
