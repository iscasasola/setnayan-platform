## 2026-07-11 · fix(seating): guest venue walk renders linked-serpentine chairs even

Completes the even-chairs work (2D editor #3003, PDF #3019) on the last surface —
the public guest 3D venue walk. It hardcoded `linkGroupId: null`, so a couple's
LINKED serpentine chain drew endpoint-bunched chairs there while every other
surface showed the uniform even spacing.

The `public_venue_scene` RPC (v4) never returned `link_group_id`, so this needs a
DB change too:
- **Migration `20270717889621_public_venue_scene_v5`** — `CREATE OR REPLACE` of
  the RPC, taken VERBATIM from the live prod definition (`pg_get_functiondef`)
  plus exactly ONE added field `'linkGroupId', t.link_group_id` in the tables
  block. Adversarially verified by two independent agents: byte-faithful to v4,
  every PII/security gate (token block, photo-visibility branches, anonymised
  occupancy, SECURITY DEFINER, search_path) unchanged. `link_group_id` is a uuid
  — non-PII geometry-grade data, safe on the public page.
- **`guest-venue-3d.tsx`** — carry `linkGroupId` through `VenueScene.tables` + the
  table mapping, and pass `even = table.linkGroupId != null` to both
  `chairPlacements` call sites (which route to `serpentineChairs(cap, even)`).

`tsc` + guards + migration timestamp guard clean.

⚠ OWNER ACTION: apply the migration on deploy (`supabase db push`). It's a pure
`CREATE OR REPLACE` (idempotent, same signature) — safe to apply after merge; do
NOT apply before merge (ORPHAN rule).

SPEC IMPACT: None (RPC now returns the existing link_group_id; even-chairs parity).
