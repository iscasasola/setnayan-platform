## 2026-07-15 · feat(samahan): communities schema foundation (PR-1 of the minimal cut)

Samahan (Communities) minimal foundation — migration
`20270808218211_samahan_communities_foundation.sql`, per the owner-locked model
in `Composable_Event_Build_Map_2026-07-15.md` §6 and the build plan
`Samahan_Minimal_Build_Plan_2026-07-15.md` §2:

- `communities` (public_id `S89C-…`, kind barkada|parish|clan|org|other,
  soft-archive only, creator survives account deletion via ON DELETE SET NULL)
- `community_members` (role organizer|member, UNIQUE (community_id, user_id))
- `community_invite_tokens` — ONE standing rotating link per community
  (UNIQUE community_id; mirrors `event_join_tokens` service-role redemption)
- 2 new SECURITY DEFINER helpers `current_community_ids()` /
  `current_organizer_community_ids()` (mirror `current_event_ids()` exactly)
- Full RLS: membership-scoped read · organizer write · admin override; roster
  visible ONLY to fellow members (RA 10173); invite token organizer-only;
  member INSERT is service-role-only (token redemption path)
- `events.community_id` (ON DELETE SET NULL — killing a community never
  deletes its events) + `events_community_class_consistency` CHECK: only the
  7 community_eligible types (simple_event · corporate · travel · celebration ·
  tournament · reunion · anniversary) may carry a community_id — a Samahan can
  NEVER own a personal milestone (owner lock 2026-07-15)
- Additive `community_member_can_read_events` SELECT policy — community events
  visible to all members (read-only; event WRITE stays with event membership)

**Behavior-neutral:** nothing reads the tables yet; `community_id` defaults
NULL everywhere. Verified against the prod schema in a rolled-back transaction
(applies clean, re-applies clean, 22/22 checks incl. the 4-persona RLS matrix,
wedding-rejected/reunion-accepted CHECK probes, ON DELETE SET NULL probe).
Deferred by design (plan §1): nesting (`parent_community_id`), chat (0019
reuse), guest-group fan-out, memories tab, logo upload, discovery/slug,
hard delete.

SPEC IMPACT: `Samahan_Minimal_Build_Plan_2026-07-15.md` §2 shipped as specced;
DECISION_LOG.md row appended ("Samahan minimal cut — schema landed; nesting +
chat + invite-as-group deferred").
