## 2026-07-22 · feat(papic-games): Phase 3a — guest-facing mission RPCs

The anon data layer under the guest capture surface (spec §5#3 / §4). Guests are the
zero-account model, so these are `SECURITY DEFINER` granted to `anon`, mirroring
`papic_record_guest_capture`. Flag-gated at the call site.

- **Migration** `20270902047075_papic_guest_mission_rpcs.sql`:
  - `public.papic_guest_missions(p_guest_id)` — a guest reads their OWN event's live
    (`is_active AND approved`) missions + own completion flags. Targeted (roster) missions
    show only to the targeted guest. Returns nothing for an unknown/deleted guest.
  - `public.papic_complete_mission(p_guest_id, p_mission_id, p_capture_id, p_consent_to_share)`
    — records/updates a completion + the **§4 per-photo share consent** (RA 10173 explicit
    opt-in). Validates guest↔mission same-event, mission live, and that a supplied capture
    belongs to THIS guest (no cross-guest photo attach). Per-guest advisory lock; upsert one
    per (mission, guest).
- **`apps/web/lib/papic-games.ts`** — `fetchGuestMissions` / `completeMission` anon-RPC
  wrappers (flag-guarded, fail-soft). **`papic-missions.ts`** — new `GuestMissionRow` type.

SPEC IMPACT: None — implements Phase 3a (the guest RPCs). The React guest UI (list →
tap-to-shoot → completed) + leaderboard is Phase 3b; the custom paid challenge is Phase 4.
