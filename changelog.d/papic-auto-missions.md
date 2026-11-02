## 2026-07-22 · feat(papic-games): Phase 2 — auto booth missions from event_vendors

The FREE, zero-authoring core (spec §3.1): a "Get a photo at <vendor>'s booth" mission
per BOOKED vendor, generated from `event_vendors`. Flag-gated at the call site
(`NEXT_PUBLIC_PAPIC_GAMES_V1`) — nothing runs until the app wires it (Phase 3).

- **Migration** `20270901331963_papic_auto_missions_from_event_vendors.sql`:
  `public.ensure_papic_auto_missions(p_event_id)` — SECURITY DEFINER, idempotent, returns
  #created. Auth-guarded (couple/coordinator/admin/service_role; not anon), per-event advisory
  lock + a partial unique index (`uq_papic_missions_auto_booth`) as the dedup backstop.
  "Booked" = `event_vendors.status IN ('contracted','deposit_paid','delivered','complete')` (§3.3).
- **`apps/web/lib/papic-missions.ts`** — pure types + helpers (`boothMissionPrompt`,
  `MISSION_TYPE_LABELS`, `isMissionLive`), unit-tested.
- **`apps/web/lib/papic-games.ts`** — `ensureAutoMissions` / `fetchEventMissions` DB wrappers,
  flag-guarded (no-op when off), fail-soft.

SPEC IMPACT: None — implements Phase 2 of the existing spec. (Custom paid challenges + the
consent tap + the guest UI are later phases; auto missions are FREE for every booked vendor.)
