## 2026-07-30 · feat(ugat): Samahan joins the entity map as its tenth node — groups are entities, members are people

`/admin/ugat/map` documented nine entity types. The Samahan cluster — communities, their memberships, their events — shipped in `20270808218211` and was invisible on the map, so the one surface meant to answer "what is connected to what" simply omitted a whole subsystem.

**The node.** `TYPE-SAMAHAN`, entity type `community`, table `communities`, hand-placed at (250, 60) — clear of Threads (260, 210) and Users (520, 120), which the existing bbox auto-fit absorbs without touching the other nine positions. New teal hue (`--ug-e-community`), the one gap left in the warm-to-cool ladder, and a new three-figure `group` icon rather than reusing Guests' `users` — two nodes that look identical are worse than one node too many.

**Deliberately scoped to communities, not "People & Samahan".** The person spine (`people` / `person_connections` / dependents) is a separate cluster behind a counsel gate. Folding both under one node would have given the map **two contradictory ideas of what a person is** — one a group membership, one a kin relationship. The dependents joint belongs with the person spine and lands with it, not here.

**Two joints, authored from the migration rather than from prose:**

- **J14 · Samahan ↔ User** — `community_members`, `UNIQUE(community_id, user_id)`, roles organizer/member, both FKs `CASCADE` (no tombstone on delete). Guarded by `current_organizer_community_ids()`. Trap recorded: `community_invite_tokens` is **UNIQUE per community with no expiry** — one live token per samahan, forever, until rotated.
- **J15 · Samahan → Event** — a *direct FK* (`events.community_id`), so `joint: null`. Guarded by `CHECK events_community_class_consistency`, the bypass-proof half the app gate alone can't provide. Trap recorded: `ON DELETE SET NULL` means deleting a samahan **silently orphans its events into personal ones** rather than failing — the events survive, their ownership doesn't.

**Privacy line, drawn deliberately.** A samahan is an entity and may be listed. Its **roster is personal data about third parties** (RA 10173). So the Samahan table renders group-level rows only — name, kind, member **tally** — and `community_members` is touched by exactly two reads in the whole file: a head-count with no columns, and a `select('community_id')`. **No `user_id` is selected anywhere.** Naming members needs its own stated basis and its own surface, not a widened select here.

**Cache key bumped `ugat-type-counts-v1` → `v2`** for the new `community` and `detail.communityMembers` fields. Without the bump a cached v1 payload keeps serving for up to 60s and the new sub-figures read as `undefined` — which renders as a plausible-looking blank rather than an error, the worst kind of wrong.

**Two tests changed, and the reason matters.** `graph.test.ts` pinned "exactly nine type nodes" **three separate ways**, so adding a node failed CI three times for no defect. A count that must be hand-edited to add a node is a speed bump, not a guard. Replaced with the invariant it was actually protecting: one node per entity type, distinct ids, and — new — **every type in the union has both a node and a vocab entry**, which catches the real failure (a type added to the union renders as a blank chip). Added a wiring test pinning J14 to `community_members` and J15 to a direct FK.

**Adjacent finding, surfaced not fixed:** migration `20270808218211` contains **no `REVOKE ALL`** for `communities` / `community_members` / `community_invite_tokens`. Verified independently — the default ACL grants `arwdDxtm` to `anon` + `authenticated`, the known root cause of the 368-table exposure. That belongs in a migration PR of its own, not folded into a UI change.

Note prod is pre-launch-empty (communities verified empty): every new count renders 0. That's correct behaviour, not a broken read.

SPEC IMPACT: None — no schema, no RLS policy edit, no flag, no pricing. Pure additive TS/CSS delta, so no exposure-baseline regeneration.
