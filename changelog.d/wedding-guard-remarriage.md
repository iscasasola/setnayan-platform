## 2026-07-12 · fix(create-event): wedding guard frees the slot for a settled wedding + guided second-wedding router

Flow-check fix (owner-decided 2026-07-12). The shipped one-wedding-at-a-time guard (#3183) freed the slot only when a wedding was `archived`, so a **completed / widowed / annulled** wedding still blocked a new one — a widow had to "archive" their wedding to remarry. Now the guard blocks only a wedding still **IN PLANNING**; a **settled** wedding (archived, or `event_date` in the past) does not block, so remarriage works without archiving.

- **`wedding-guard.ts`** — `isInPlanningWedding(ev, today)` (pure, tested): blocks iff `event_type=wedding` AND not archived AND (`event_date` null or ≥ today). `getInPlanningWedding()` returns the blocking wedding (id/name/date) for the router; `hasInPlanningWeddingForUser()` is the authoritative boolean. Manila-tz day boundary.
- **Server action** (`createWeddingEvent`) — rejects a new wedding only when one is IN PLANNING (settled ones pass).
- **Picker** — replaces the flat "one wedding at a time" wall with a **guided router** when a wedding is in planning: *the church/civil ceremony of the same marriage* → edit the existing wedding (one wedding, two ceremonies) · *a vow renewal / anniversary* → routes to the Anniversary type · *a different new marriage* → "finish or archive it first" with a link to it. No dead-end.
- **7 unit tests** for the predicate (in-planning blocks; completed/archived don't; today still blocks; non-weddings never).

Same-marriage civil+church is one wedding with two ceremonies; Muslim-rite concurrency stays blocked in V1 (accepted). No change to non-wedding creation.

SPEC IMPACT: reconciles Event_Anchor_Minimalist_Setup_Design §4b to the shipped guard + this fix (corpus already updated).
