## 2026-07-17 · feat(people): the 2°→1° upgrade — Connect on samahan co-members

Completes the degree model's natural next step: a second-degree person (a samahan co-member) can be proposed as a first-degree friend connection with one tap.

- Second-degree chips on `/dashboard/people` gain a **Connect** button when the connections flag is on (`NEXT_PUBLIC_PEOPLE_CONNECTIONS` — still OFF in prod, counsel-gated, so this ships dark like the rest of the connections flow). Chips for people you already have a pending/confirmed edge with render no button.
- New `proposeSamahanConnection` action: the target is addressed by `community_members.id` (bigserial — the roster rule: never a UUID or email from the client). The member-row read under the USER client doubles as the second-degree proof (RLS only returns rows for samahans the caller belongs to); the target's person-spine row resolves server-side (admin `user_id → person`, email-resolver fallback — emails never leave the server); the edge inserts under the user client exactly like `proposeConnection` (relation `friend`, pending, mutual-confirm).
- `fetchSamahanSecondDegree` now returns the safe `member_row_id` handle + a `known` mark computed from the viewer's live edges.

Behavior today (flag off): identical read-only strip as before. Typecheck clean; no schema changes.

SPEC IMPACT: DECISION_LOG.md 2026-07-17 degree-model row (the "future natural extension" is now built, still flag-dark)
